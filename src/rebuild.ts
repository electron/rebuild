import { spawnPromise } from 'spawn-rx';
import * as crypto from 'crypto';
import * as debug from 'debug';
import * as detectLibc from 'detect-libc';
import * as EventEmitter from 'events';
import * as fs from 'fs-extra';
import * as nodeAbi from 'node-abi';
import * as os from 'os';
import * as path from 'path';
import { readPackageJson } from './read-package-json';
import { lookupModuleState, cacheModuleState } from './cache';

export type ModuleType = 'prod' | 'dev' | 'optional';
export type RebuildMode = 'sequential' | 'parallel';

export interface RebuildOptions {
  buildPath: string;
  electronVersion: string;
  arch?: string;
  extraModules?: string[];
  onlyModules?: string[] | null;
  force?: boolean;
  headerURL?: string;
  types?: ModuleType[];
  mode?: RebuildMode;
  debug?: boolean;
  useCache?: boolean;
  cachePath?: string;
}

export type HashTree = { [path: string]: string | HashTree };

export interface RebuilderOptions extends RebuildOptions {
  lifecycle: EventEmitter;
}

const d = debug('electron-rebuild');

const defaultMode: RebuildMode = process.platform === 'win32' ? 'sequential' : 'parallel';
const defaultTypes: ModuleType[] = ['prod', 'optional'];
// Update this number if you change the caching logic to ensure no bad cache hits
const ELECTRON_REBUILD_CACHE_ID = 1;

const locateBinary = async (basePath: string, suffix: string) => {
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

const locateNodeGyp = async () => {
  return await locateBinary(__dirname, `node_modules/.bin/node-gyp${process.platform === 'win32' ? '.cmd' : ''}`);
};

const locatePrebuild = async (modulePath: string) => {
  return await locateBinary(modulePath, 'node_modules/prebuild-install/bin.js');
};

class Rebuilder {
  ABI: string;
  nodeGypPath: string;
  prodDeps: Set<string>;
  rebuilds: (() => Promise<void>)[];
  realModulePaths: Set<string>;
  realNodeModulesPaths: Set<string>;

  public lifecycle: EventEmitter;
  public buildPath: string;
  public electronVersion: string;
  public arch: string;
  public extraModules: string[];
  public onlyModules: string[] | null;
  public force: boolean;
  public headerURL: string;
  public types: ModuleType[];
  public mode: RebuildMode;
  public debug: boolean;
  public useCache: boolean;
  public cachePath: string;

  constructor(options: RebuilderOptions) {
    this.lifecycle = options.lifecycle;
    this.buildPath = options.buildPath;
    this.electronVersion = options.electronVersion;
    this.arch = options.arch || process.arch;
    this.extraModules = options.extraModules || [];
    this.onlyModules = options.onlyModules || null;
    this.force = options.force || false;
    this.headerURL = options.headerURL || 'https://electronjs.org/headers';
    this.types = options.types || defaultTypes;
    this.mode = options.mode || defaultMode;
    this.debug = options.debug || false;
    this.useCache = options.useCache || false;
    this.cachePath = options.cachePath || path.resolve(os.homedir(), '.electron-rebuild-cache');

    if (this.useCache && this.force) {
      console.warn('[WARNING]: Electron Rebuild has force enabled and cache enabled, force take precedence and the cache will not be used.');
      this.useCache = false;
    }

    if (typeof this.electronVersion === 'number') {
      if (`${this.electronVersion}`.split('.').length === 1) {
        this.electronVersion = `${this.electronVersion}.0.0`;
      } else {
        this.electronVersion = `${this.electronVersion}.0`;
      }
    }
    if (typeof this.electronVersion !== 'string') {
      throw new Error(`Expected a string version for electron version, got a "${typeof this.electronVersion}"`);
    }

    this.ABI = nodeAbi.getAbi(this.electronVersion, 'electron');
    this.prodDeps = this.extraModules.reduce((acc, x) => acc.add(x), new Set<string>());
    this.rebuilds = [];
    this.realModulePaths = new Set();
    this.realNodeModulesPaths = new Set();
  }

  async rebuild() {
    if (!path.isAbsolute(this.buildPath)) {
      throw new Error('Expected buildPath to be an absolute path');
    }
    d(
      'rebuilding with args:',
      this.buildPath,
      this.electronVersion,
      this.arch,
      this.extraModules,
      this.force,
      this.headerURL,
      this.types,
      this.debug
    );

    this.lifecycle.emit('start');

    const rootPackageJson = await readPackageJson(this.buildPath);
    const markWaiters: Promise<void>[] = [];
    const depKeys = [];

    if (this.types.indexOf('prod') !== -1 || this.onlyModules) {
      depKeys.push(...Object.keys(rootPackageJson.dependencies || {}));
    }
    if (this.types.indexOf('optional') !== -1 || this.onlyModules) {
      depKeys.push(...Object.keys(rootPackageJson.optionalDependencies || {}));
    }
    if (this.types.indexOf('dev') !== -1 || this.onlyModules) {
      depKeys.push(...Object.keys(rootPackageJson.devDependencies || {}));
    }

    depKeys.forEach((key) => {
      this.prodDeps[key] = true;
      markWaiters.push(this.markChildrenAsProdDeps(path.resolve(this.buildPath, 'node_modules', key)));
    });

    await Promise.all(markWaiters);

    d('identified prod deps:', this.prodDeps);

    await this.rebuildAllModulesIn(path.resolve(this.buildPath, 'node_modules'));
    this.rebuilds.push(() => this.rebuildModuleAt(this.buildPath));

    if (this.mode !== 'sequential') {
      await Promise.all(this.rebuilds.map(fn => fn()));
    } else {
      for (const rebuildFn of this.rebuilds) {
        await rebuildFn();
      }
    }
  }

  private hashDirectory = async (dir: string, relativeTo = dir) => {
    d('hashing dir', dir);
    const dirTree: HashTree = {};
    await Promise.all((await fs.readdir(dir)).map(async (child) => {
      d('found child', child, 'in dir', dir);
      // Ignore output directories
      if (dir === relativeTo && (child === 'build' || child === 'bin')) return;
      // Don't hash nested node_modules
      if (child === 'node_modules') return;

      const childPath = path.resolve(dir, child);
      const relative = path.relative(relativeTo, childPath);
      if ((await fs.stat(childPath)).isDirectory()) {
        dirTree[relative] = await this.hashDirectory(childPath, relativeTo);
      } else {
        dirTree[relative] = crypto.createHash('SHA256').update(await fs.readFile(childPath)).digest('hex');
      }
    }));
    return dirTree;
  }

  private dHashTree = (tree: HashTree, hash: crypto.Hash) => {
    for (const key of Object.keys(tree).sort()) {
      hash.update(key);
      if (typeof tree[key] === 'string') {
        hash.update(tree[key] as string);
      } else {
        this.dHashTree(tree[key] as HashTree, hash);
      }
    }
  }

  private generateCacheKey = async (opts: { modulePath: string }) => {
    const tree = await this.hashDirectory(opts.modulePath);
    const hasher = crypto.createHash('SHA256')
      .update(`${ELECTRON_REBUILD_CACHE_ID}`)
      .update(path.basename(opts.modulePath))
      .update(this.ABI)
      .update(this.arch)
      .update(this.debug ? 'debug' : 'not debug')
      .update(this.headerURL)
      .update(this.electronVersion);
    this.dHashTree(tree, hasher);
    const hash = hasher.digest('hex');
    d('calculated hash of', opts.modulePath, 'to be', hash);
    return hash;
  }

  async rebuildModuleAt(modulePath: string) {
    if (!(await fs.pathExists(path.resolve(modulePath, 'binding.gyp')))) {
      return;
    }

    const nodeGypPath = await locateNodeGyp();
    if (!nodeGypPath) {
      throw new Error('Could not locate node-gyp');
    }

    const buildType = this.debug ? 'Debug' : 'Release';

    const metaPath = path.resolve(modulePath, 'build', buildType, '.forge-meta');
    const metaData = `${this.arch}--${this.ABI}`;

    this.lifecycle.emit('module-found', path.basename(modulePath));

    if (!this.force && await fs.pathExists(metaPath)) {
      const meta = await fs.readFile(metaPath, 'utf8');
      if (meta === metaData) {
        d(`skipping: ${path.basename(modulePath)} as it is already built`);
        this.lifecycle.emit('module-done');
        this.lifecycle.emit('module-skip');
        return;
      }
    }

    // prebuild already exists
    if (await fs.pathExists(path.resolve(modulePath, 'prebuilds', `${process.platform}-${this.arch}`, `electron-${this.ABI}.node`))) {
      d(`skipping: ${path.basename(modulePath)} as it was prebuilt`);
      return;
    }

    let cacheKey!: string;
    if (this.useCache) {
      cacheKey = await this.generateCacheKey({
        modulePath,
      });

      const applyDiffFn = await lookupModuleState(this.cachePath, cacheKey);
      if (applyDiffFn) {
        await applyDiffFn(modulePath);
        this.lifecycle.emit('module-done');
        return;
      }
    }

    const modulePackageJson = await readPackageJson(modulePath);

    if ((modulePackageJson.dependencies || {})['prebuild-install']) {
      d(`assuming is prebuild powered: ${path.basename(modulePath)}`);
      const prebuildInstallPath = await locatePrebuild(modulePath);
      if (prebuildInstallPath) {
        d(`triggering prebuild download step: ${path.basename(modulePath)}`);
        let success = false;
        try {
          await spawnPromise(
            process.execPath,
            [
              path.resolve(__dirname, 'prebuild-shim.js'),
              prebuildInstallPath,
              `--arch=${this.arch}`,
              `--platform=${process.platform}`,
              '--runtime=electron',
              `--target=${this.electronVersion}`
            ],
            {
              cwd: modulePath,
            }
          );
          success = true;
        } catch (err) {
          d('failed to use prebuild-install:', err);
        }
        if (success) {
          d('built:', path.basename(modulePath));
          await fs.mkdirs(path.dirname(metaPath));
          await fs.writeFile(metaPath, metaData);
          if (this.useCache) {
            await cacheModuleState(modulePath, this.cachePath, cacheKey);
          }
          this.lifecycle.emit('module-done');
          return;
        }
      } else {
        d(`could not find prebuild-install relative to: ${modulePath}`);
      }
    }
    if (modulePath.indexOf(' ') !== -1) {
      console.error('Attempting to build a module with a space in the path');
      console.error('See https://github.com/nodejs/node-gyp/issues/65#issuecomment-368820565 for reasons why this may not work');
      // FIXME: Re-enable the throw when more research has been done
      // throw new Error(`node-gyp does not support building modules with spaces in their path, tried to build: ${modulePath}`);
    }
    d('rebuilding:', path.basename(modulePath));
    const rebuildArgs = [
      'rebuild',
      `--target=${this.electronVersion}`,
      `--arch=${this.arch}`,
      `--dist-url=${this.headerURL}`,
      '--build-from-source',
    ];

    if (this.debug) {
      rebuildArgs.push('--debug');
    }

    Object.keys(modulePackageJson.binary || {}).forEach((binaryKey) => {
      let value = modulePackageJson.binary[binaryKey];

      if (binaryKey === 'module_path') {
        value = path.resolve(modulePath, value);
      }

      value = value.replace('{configuration}', buildType)
        .replace('{node_abi}', `electron-v${this.electronVersion.split('.').slice(0, 2).join('.')}`)
        .replace('{platform}', process.platform)
        .replace('{arch}', this.arch)
        .replace('{version}', modulePackageJson.version)
        .replace('{libc}', detectLibc.family || 'unknown');

      Object.keys(modulePackageJson.binary).forEach((binaryReplaceKey) => {
        value = value.replace(`{${binaryReplaceKey}}`, modulePackageJson.binary[binaryReplaceKey]);
      });

      rebuildArgs.push(`--${binaryKey}=${value}`);
    });

    if (process.env.GYP_MSVS_VERSION) {
      rebuildArgs.push(`--msvs_version=${process.env.GYP_MSVS_VERSION}`);
    }

    d('rebuilding', path.basename(modulePath), 'with args', rebuildArgs);
    await spawnPromise(nodeGypPath, rebuildArgs, {
      cwd: modulePath,
      env: Object.assign({}, process.env, {
        USERPROFILE: path.resolve(os.homedir(), '.electron-gyp'),
        npm_config_disturl: 'https://electronjs.org/headers',
        npm_config_runtime: 'electron',
        npm_config_arch: this.arch,
        npm_config_target_arch: this.arch,
        npm_config_build_from_source: 'true',
        npm_config_debug: this.debug ? 'true' : '',
        npm_config_devdir: path.resolve(os.homedir(), '.electron-gyp'),
      }),
    });

    d('built:', path.basename(modulePath));
    await fs.mkdirs(path.dirname(metaPath));
    await fs.writeFile(metaPath, metaData);

    const moduleName = path.basename(modulePath);
    const buildLocation = 'build/' + buildType;

    d('searching for .node file', path.resolve(modulePath, buildLocation));
    d('testing files', (await fs.readdir(path.resolve(modulePath, buildLocation))));

    const nodeFile = (await fs.readdir(path.resolve(modulePath, buildLocation)))
      .find((file) => file !== '.node' && file.endsWith('.node'));
    const nodePath = nodeFile ? path.resolve(modulePath, buildLocation, nodeFile) : undefined;

    const abiPath = path.resolve(modulePath, `bin/${process.platform}-${this.arch}-${this.ABI}`);
    if (nodePath && await fs.pathExists(nodePath)) {
      d('found .node file', nodePath);
      d('copying to prebuilt place:', abiPath);
      await fs.mkdirs(abiPath);
      await fs.copy(nodePath, path.resolve(abiPath, `${moduleName}.node`));
    }

    if (this.useCache) {
      await cacheModuleState(modulePath, this.cachePath, cacheKey);
    }
    this.lifecycle.emit('module-done');
  }

  async rebuildAllModulesIn(nodeModulesPath: string, prefix = '') {
    // Some package managers use symbolic links when installing node modules
    // we need to be sure we've never tested the a package before by resolving
    // all symlinks in the path and testing against a set
    const realNodeModulesPath = await fs.realpath(nodeModulesPath);
    if (this.realNodeModulesPaths.has(realNodeModulesPath)) {
      return;
    }
    this.realNodeModulesPaths.add(realNodeModulesPath);

    d('scanning:', realNodeModulesPath);

    for (const modulePath of await fs.readdir(realNodeModulesPath)) {
      // Ignore the magical .bin directory
      if (modulePath === '.bin') continue;
      // Ensure that we don't mark modules as needing to be rebuilt more than once
      // by ignoring / resolving symlinks
      const realPath = await fs.realpath(path.resolve(nodeModulesPath, modulePath));

      if (this.realModulePaths.has(realPath)) {
        continue;
      }
      this.realModulePaths.add(realPath);

      if (this.prodDeps[`${prefix}${modulePath}`] && (!this.onlyModules || this.onlyModules.includes(modulePath))) {
        this.rebuilds.push(() => this.rebuildModuleAt(realPath));
      }

      if (modulePath.startsWith('@')) {
        await this.rebuildAllModulesIn(realPath, `${modulePath}/`);
      }

      if (await fs.pathExists(path.resolve(nodeModulesPath, modulePath, 'node_modules'))) {
        await this.rebuildAllModulesIn(path.resolve(realPath, 'node_modules'));
      }
    }
  }

  async findModule(moduleName: string, fromDir: string, foundFn: ((p: string) => Promise<void>)) {
    let targetDir = fromDir;
    const foundFns = [];

    while (targetDir !== path.dirname(this.buildPath)) {
      const testPath = path.resolve(targetDir, 'node_modules', moduleName);
      if (await fs.pathExists(testPath)) {
        foundFns.push(foundFn(testPath));
      }

      targetDir = path.dirname(targetDir);
    }

    await Promise.all(foundFns);
  }

  async markChildrenAsProdDeps(modulePath: string) {
    if (!await fs.pathExists(modulePath)) {
      return;
    }

    d('exploring', modulePath);
    let childPackageJson: any;
    try {
      childPackageJson = await readPackageJson(modulePath, true);
    } catch (err) {
      return;
    }
    const moduleWait: Promise<void>[] = [];

    const callback = this.markChildrenAsProdDeps.bind(this);
    Object.keys(childPackageJson.dependencies || {}).concat(Object.keys(childPackageJson.optionalDependencies || {})).forEach((key) => {
      if (this.prodDeps[key]) {
        return;
      }

      this.prodDeps[key] = true;

      moduleWait.push(this.findModule(key, modulePath, callback));
    });

    await Promise.all(moduleWait);
  }
}

function rebuildWithOptions(options: RebuildOptions) {
  d('rebuilding with args:', arguments);
  const lifecycle = new EventEmitter();
  const rebuilderOptions: RebuilderOptions = Object.assign({}, options, { lifecycle });
  const rebuilder = new Rebuilder(rebuilderOptions);

  let ret = rebuilder.rebuild() as Promise<void> & { lifecycle: EventEmitter };
  ret.lifecycle = lifecycle;

  return ret;
}

function doRebuild(options: any, ...args: any[]) {
  if (typeof options === 'object') {
    return rebuildWithOptions(options as RebuildOptions);
  }
  console.warn('You are using the deprecated electron-rebuild API, please switch to using the options object instead');
  return rebuildWithOptions((<Function>createOptions)(options, ...args));
}

export type RebuilderResult = Promise<void> & { lifecycle: EventEmitter };
export type RebuildFunctionWithOptions = (options: RebuildOptions) => RebuilderResult;
export type RebuildFunctionWithArgs = (
  buildPath: string,
  electronVersion: string,
  arch?: string,
  extraModules?: string[],
  force?: boolean,
  headerURL?: string,
  types?: ModuleType[],
  mode?: RebuildMode,
  onlyModules?: string[] | null,
  debug?: boolean
) => RebuilderResult;
export type RebuildFunction = RebuildFunctionWithArgs & RebuildFunctionWithOptions;

export const rebuild = (doRebuild as RebuildFunction);

export function createOptions(
    buildPath: string,
    electronVersion: string,
    arch: string,
    extraModules: string[],
    force: boolean,
    headerURL: string,
    types: ModuleType[],
    mode: RebuildMode,
    onlyModules: string[] | null,
    debug: boolean ): RebuildOptions {

  return {
    buildPath,
    electronVersion,
    arch,
    extraModules,
    onlyModules,
    force,
    headerURL,
    types,
    mode,
    debug
  };
}

export function rebuildNativeModules(
    electronVersion: string,
    modulePath: string,
    whichModule= '',
    _headersDir: string | null = null,
    arch= process.arch,
    _command: string,
    _ignoreDevDeps= false,
    _ignoreOptDeps= false,
    _verbose= false) {
  if (path.basename(modulePath) === 'node_modules') {
    modulePath = path.dirname(modulePath);
  }

  d('rebuilding in:', modulePath);
  console.warn('You are using the old API, please read the new docs and update to the new API');

  return rebuild(modulePath, electronVersion, arch, whichModule.split(','));
}
