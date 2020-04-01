import * as debug from 'debug';
import * as detectLibc from 'detect-libc';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { cacheModuleState } from './cache';
import { readPackageJson } from './read-package-json';
import { Rebuilder } from './rebuild';
import { spawn } from '@malept/cross-spawn-promise';

const d = debug('electron-rebuild');

const locateBinary = async (basePath: string, suffix: string): Promise<string | null> => {
  let testPath = basePath;
  for (let upDir = 0; upDir <= 20; upDir ++) {
    const checkPath = path.resolve(testPath, suffix);
    if (await fs.pathExists(checkPath)) {
      return checkPath;
    }
    testPath = path.resolve(testPath, '..');
  }
  return null;
};

let nodeGypPath: string | null | undefined;

async function locateNodeGyp(): Promise<string | null> {
  if (nodeGypPath === undefined) {
    nodeGypPath = await locateBinary(__dirname, `node_modules/.bin/node-gyp${process.platform === 'win32' ? '.cmd' : ''}`);
  }

  return nodeGypPath;
}

async function locatePrebuild(modulePath: string): Promise<string | null> {
  return await locateBinary(modulePath, 'node_modules/prebuild-install/bin.js');
}

export enum BuildType {
  Debug = 'Debug',
  Release = 'Release',
}

export class ModuleRebuilder {
  private modulePath: string;
  private packageJSON: object;
  private rebuilder: Rebuilder;

  constructor(rebuilder: Rebuilder, modulePath: string) {
    this.modulePath = modulePath;
    this.rebuilder = rebuilder;
  }

  get buildType(): BuildType {
    return this.rebuilder.debug ? BuildType.Debug : BuildType.Release;
  }

  get metaPath(): string {
    return path.resolve(this.modulePath, 'build', this.buildType, '.forge-meta');
  }

  get metaData(): string {
    return `${this.rebuilder.arch}--${this.rebuilder.ABI}`;
  }

  get moduleName(): string {
    return path.basename(this.modulePath);
  }

  get nodeGypEnv(): Record<string, string> {
    /* eslint-disable @typescript-eslint/camelcase */
    return {
      ...process.env,
      USERPROFILE: path.resolve(os.homedir(), '.electron-gyp'),
      npm_config_disturl: 'https://www.electronjs.org/headers',
      npm_config_runtime: 'electron',
      npm_config_arch: this.rebuilder.arch,
      npm_config_target_arch: this.rebuilder.arch,
      npm_config_build_from_source: 'true',
      npm_config_debug: this.rebuilder.debug ? 'true' : '',
      npm_config_devdir: path.resolve(os.homedir(), '.electron-gyp'),
    }
    /* eslint-enable @typescript-eslint/camelcase */
  }

  async alreadyBuiltByRebuild(): Promise<boolean> {
    if (await fs.pathExists(this.metaPath)) {
      const meta = await fs.readFile(this.metaPath, 'utf8');
      return meta === this.metaData;
    }

    return false;
  }

  async buildNodeGypArgs(): Promise<string[]> {
    const args = [
      'rebuild',
      `--target=${this.rebuilder.electronVersion}`,
      `--arch=${this.rebuilder.arch}`,
      `--dist-url=${this.rebuilder.headerURL}`,
      '--build-from-source',
    ];

    if (this.rebuilder.debug) {
      args.push('--debug');
    }

    args.push(...(await this.buildNodeGypArgsFromBinaryField()));

    if (process.env.GYP_MSVS_VERSION) {
      args.push(`--msvs_version=${process.env.GYP_MSVS_VERSION}`);
    }

    return args;
  }

  async buildNodeGypArgsFromBinaryField(): Promise<string[]> {
    const binary = await this.packageJSONField('binary', {}) as Record<string, string>;
    const flags = await Promise.all(Object.entries(binary).map(async ([binaryKey, binaryValue]) => {
      if (binaryKey === 'napi_versions') {
        return;
      }

      let value = binaryValue

      if (binaryKey === 'module_path') {
        value = path.resolve(this.modulePath, value);
      }

      value = value.replace('{configuration}', this.buildType)
        .replace('{node_abi}', `electron-v${this.rebuilder.electronVersion.split('.').slice(0, 2).join('.')}`)
        .replace('{platform}', process.platform)
        .replace('{arch}', this.rebuilder.arch)
        .replace('{version}', await this.packageJSONField('version') as string)
        .replace('{libc}', detectLibc.family || 'unknown');

      for (const [replaceKey, replaceValue] of Object.entries(binary)) {
        value = value.replace(`{${replaceKey}}`, replaceValue);
      }

      return `--${binaryKey}=${value}`;
    }))

    return flags.filter(value => value) as string[];
  }

  async cacheModuleState(cacheKey: string): Promise<void> {
    if (this.rebuilder.useCache) {
      await cacheModuleState(this.modulePath, this.rebuilder.cachePath, cacheKey);
    }
  }

  async isPrebuildNativeModule(): Promise<boolean> {
    const dependencies = await this.packageJSONField('dependencies', {});
    return !!dependencies['prebuild-install']
  }

  async packageJSONField(key: string, defaultValue?: string | object): Promise<string | object> {
    if (!this.packageJSON) {
      this.packageJSON = await readPackageJson(this.modulePath);
    }

    return this.packageJSON[key] || defaultValue;
  }

  /**
   * Whether a prebuild-based native module exists.
   */
  async prebuildNativeModuleExists(): Promise<boolean> {
    return fs.pathExists(path.resolve(this.modulePath, 'prebuilds', `${process.platform}-${this.rebuilder.arch}`, `electron-${this.rebuilder.ABI}.node`))
  }

  async rebuildNodeGypModule(cacheKey: string): Promise<void> {
    const nodeGypPath = await locateNodeGyp();
    if (!nodeGypPath) {
      throw new Error('Could not locate node-gyp');
    }

    if (this.modulePath.includes(' ')) {
      console.error('Attempting to build a module with a space in the path');
      console.error('See https://github.com/nodejs/node-gyp/issues/65#issuecomment-368820565 for reasons why this may not work');
      // FIXME: Re-enable the throw when more research has been done
      // throw new Error(`node-gyp does not support building modules with spaces in their path, tried to build: ${modulePath}`);
    }

    const nodeGypArgs = await this.buildNodeGypArgs();

    d('rebuilding', this.moduleName, 'with args', nodeGypArgs);
    await spawn(nodeGypPath, nodeGypArgs, {
      cwd: this.modulePath,
      env: this.nodeGypEnv,
    });

    d('built:', this.moduleName);
    await this.writeMetadata();
    await this.replaceExistingNativeModule();
    await this.cacheModuleState(cacheKey)
  }

  async rebuildPrebuildModule(cacheKey: string): Promise<boolean> {
    if (!(await this.isPrebuildNativeModule())) {
      return false;
    }

    d(`assuming is prebuild powered: ${this.moduleName}`);
    const prebuildInstallPath = await locatePrebuild(this.modulePath);
    if (prebuildInstallPath) {
      d(`triggering prebuild download step: ${this.moduleName}`);
      let success = false;
      const shimExt = process.env.ELECTRON_REBUILD_TESTS ? 'ts' : 'js';
      const executable = process.env.ELECTRON_REBUILD_TESTS ? path.resolve(__dirname, '..', 'node_modules', '.bin', 'ts-node') : process.execPath;
      try {
        await spawn(
          executable,
          [
            path.resolve(__dirname, `prebuild-shim.${shimExt}`),
            prebuildInstallPath,
            `--arch=${this.rebuilder.arch}`,
            `--platform=${process.platform}`,
            '--runtime=electron',
            `--target=${this.rebuilder.electronVersion}`,
            `--tag-prefix=${this.rebuilder.prebuildTagPrefix}`
          ],
          {
            cwd: this.modulePath,
          }
        );
        success = true;
      } catch (err) {
        d('failed to use prebuild-install:', err);
      }
      if (success) {
        d('built:', this.moduleName);
        await this.writeMetadata();
        await this.cacheModuleState(cacheKey);
        return true;
      }
    } else {
      d(`could not find prebuild-install relative to: ${this.modulePath}`);
    }

    return false;
  }

  async replaceExistingNativeModule(): Promise<void> {
    const buildLocation = path.resolve(this.modulePath, 'build', this.buildType);

    d('searching for .node file', buildLocation);
    const buildLocationFiles = await fs.readdir(buildLocation);
    d('testing files', buildLocationFiles);

    const nodeFile = buildLocationFiles.find((file) => file !== '.node' && file.endsWith('.node'));
    const nodePath = nodeFile ? path.resolve(buildLocation, nodeFile) : undefined;

    if (nodePath && await fs.pathExists(nodePath)) {
      d('found .node file', nodePath);
      const abiPath = path.resolve(this.modulePath, `bin/${process.platform}-${this.rebuilder.arch}-${this.rebuilder.ABI}`);
      d('copying to prebuilt place:', abiPath);
      await fs.ensureDir(abiPath);
      await fs.copy(nodePath, path.resolve(abiPath, `${this.moduleName}.node`));
    }
  }

  async writeMetadata(): Promise<void> {
    await fs.ensureDir(path.dirname(this.metaPath));
    await fs.writeFile(this.metaPath, this.metaData);
  }
}
