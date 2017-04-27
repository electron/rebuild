import { spawnPromise } from 'spawn-rx';
import * as debug from 'debug';
import * as EventEmitter from 'events';
import * as fs from 'fs-promise';
import * as nodeAbi from 'node-abi';
import * as os from 'os';
import * as path from 'path';
import { readPackageJson } from './read-package-json';

const d = debug('electron-rebuild');

const defaultMode = process.platform === 'win32' ? 'sequential' : 'parallel';

const locateNodeGyp = async () => {
  let testPath = __dirname;
  for (let upDir = 0; upDir <= 20; upDir++) {
    const nodeGypTestPath = path.resolve(testPath, `node_modules/.bin/node-gyp${process.platform === 'win32' ? '.cmd' : ''}`);
    if (await fs.exists(nodeGypTestPath)) {
      return nodeGypTestPath;
    }
    testPath = path.resolve(testPath, '..');
  }
  return null;
};

class Rebuilder {
  ABI: string;
  nodeGypPath: string;
  prodDeps: Set<string>;
  rebuilds: (() => Promise<void>)[];

  constructor(
      public lifecycle: EventEmitter,
      public buildPath: string,
      public electronVersion: string,
      public arch = process.arch,
      public extraModules: string[] = [],
      public forceRebuild = false,
      public headerURL = 'https://atom.io/download/electron',
      public types = ['prod', 'optional'],
      public mode = defaultMode) {
    this.ABI = nodeAbi.getAbi(electronVersion, 'electron');
    this.prodDeps = extraModules.reduce((acc, x) => acc.add(x), new Set());
    this.rebuilds = [];
  }

  async rebuild() {
    if (!path.isAbsolute(this.buildPath)) {
      throw new Error('Expected buildPath to be an absolute path');
    }
    d('rebuilding with args:', this.buildPath, this.electronVersion, this.arch, this.extraModules, this.forceRebuild, this.headerURL, this.types);

    this.lifecycle.emit('start');

    const rootPackageJson = await readPackageJson(this.buildPath);
    const markWaiters: Promise<void>[] = [];
    const depKeys = [];

    if (this.types.indexOf('prod') !== -1) {
      depKeys.push(...Object.keys(rootPackageJson.dependencies || {}));
    }
    if (this.types.indexOf('optional') !== -1) {
      depKeys.push(...Object.keys(rootPackageJson.optionalDependencies || {}));
    }
    if (this.types.indexOf('dev') !== -1) {
      depKeys.push(...Object.keys(rootPackageJson.devDependencies || {}));
    }

    depKeys.forEach((key) => {
      this.prodDeps[key] = true;
      markWaiters.push(this.markChildrenAsProdDeps(path.resolve(this.buildPath, 'node_modules', key)));
    });

    await Promise.all(markWaiters);

    d('identified prod deps:', this.prodDeps);

    this.rebuildAllModulesIn(path.resolve(this.buildPath, 'node_modules'));

    if (this.mode !== 'sequential') {
      await Promise.all(this.rebuilds.map(fn => fn()));
    } else {
      for (const rebuildFn of this.rebuilds) {
        await rebuildFn();
      }
    }
  }

  async rebuildModuleAt(modulePath: string) {
    if (!(await fs.exists(path.resolve(modulePath, 'binding.gyp')))) {
      return;
    }

    const nodeGypPath = await locateNodeGyp();
    if (!nodeGypPath) {
      throw new Error('Could not locate node-gyp');
    }

    const metaPath = path.resolve(modulePath, 'build', 'Release', '.forge-meta');
    const metaData = `${this.arch}--${this.ABI}`;

    this.lifecycle.emit('module-found', path.basename(modulePath));

    if (!this.forceRebuild && await fs.exists(metaPath)) {
      const meta = await fs.readFile(metaPath, 'utf8');
      if (meta === metaData) {
        d(`skipping: ${path.basename(modulePath)} as it is already built`);
        this.lifecycle.emit('module-done');
        this.lifecycle.emit('module-skip');
        return;
      }
    }
    if (await fs.exists(path.resolve(modulePath, 'prebuilds', `${process.platform}-${this.arch}`, `electron-${this.ABI}.node`))) {
      d(`skipping: ${path.basename(modulePath)} as it was prebuilt`);
      return;
    }
    d('rebuilding:', path.basename(modulePath));
    const rebuildArgs = [
      'rebuild',
      `--target=${this.electronVersion}`,
      `--arch=${this.arch}`,
      `--dist-url=${this.headerURL}`,
      '--build-from-source',
    ];

    const modulePackageJson = await readPackageJson(modulePath);

    Object.keys(modulePackageJson.binary || {}).forEach((binaryKey) => {
      let value = modulePackageJson.binary[binaryKey];

      if (binaryKey === 'module_path') {
        value = path.resolve(modulePath, value);
      }

      value = value.replace('{configuration}', 'Release')
        .replace('{node_abi}', `electron-v${this.electronVersion.split('.').slice(0, 2).join('.')}`)
        .replace('{platform}', process.platform)
        .replace('{arch}', this.arch)
        .replace('{version}', modulePackageJson.version);

      Object.keys(modulePackageJson.binary).forEach((binaryReplaceKey) => {
        value = value.replace(`{${binaryReplaceKey}}`, modulePackageJson.binary[binaryReplaceKey]);
      });

      rebuildArgs.push(`--${binaryKey}=${value}`);
    });

    d('rebuilding', path.basename(modulePath), 'with args', rebuildArgs);
    await spawnPromise(nodeGypPath, rebuildArgs, {
      cwd: modulePath,
      env: Object.assign({}, process.env, {
        HOME: path.resolve(os.homedir(), '.electron-gyp'),
        USERPROFILE: path.resolve(os.homedir(), '.electron-gyp'),
        npm_config_disturl: 'https://atom.io/download/electron',
        npm_config_runtime: 'electron',
        npm_config_arch: this.arch,
        npm_config_target_arch: this.arch,
        npm_config_build_from_source: true,
      }),
    });

    d('built:', path.basename(modulePath));
    await fs.mkdirs(path.dirname(metaPath));
    await fs.writeFile(metaPath, metaData);

    const moduleName = path.basename(modulePath);

    d('searching for .node file', path.resolve(modulePath, 'build/Release'));
    d('testing files', (await fs.readdir(path.resolve(modulePath, 'build/Release'))));
    const nodePath = path.resolve(modulePath, 'build/Release',
      (await fs.readdir(path.resolve(modulePath, 'build/Release')))
        .find((file) => file !== '.node' && file.endsWith('.node'))
      );

    const abiPath = path.resolve(modulePath, `bin/${process.platform}-${this.arch}-${this.ABI}`);
    if (await fs.exists(nodePath)) {
      d('found .node file', nodePath);
      d('copying to prebuilt place:', abiPath);
      await fs.mkdirs(abiPath);
      await fs.copy(nodePath, path.resolve(abiPath, `${moduleName}.node`));
    }

    this.lifecycle.emit('module-done');
  }

  rebuildAllModulesIn(nodeModulesPath: string, prefix = '') {
    d('scanning:', nodeModulesPath);

    for (const modulePath of fs.readdirSync(nodeModulesPath)) {
      if (this.prodDeps[`${prefix}${modulePath}`]) {
        this.rebuilds.push(() => this.rebuildModuleAt(path.resolve(nodeModulesPath, modulePath)));
      }

      if (modulePath.startsWith('@')) {
        this.rebuildAllModulesIn(path.resolve(nodeModulesPath, modulePath), `${modulePath}/`);
      }

      if (fs.existsSync(path.resolve(nodeModulesPath, modulePath, 'node_modules'))) {
        this.rebuildAllModulesIn(path.resolve(nodeModulesPath, modulePath, 'node_modules'));
      }
    }
  };

  async findModule(moduleName: string, fromDir: string, foundFn: ((p: string) => Promise<void>)) {
    let targetDir = fromDir;
    const foundFns = [];

    while (targetDir !== path.dirname(this.buildPath)) {
      const testPath = path.resolve(targetDir, 'node_modules', moduleName);
      if (await fs.exists(testPath)) {
        foundFns.push(foundFn(testPath));
      }

      targetDir = path.dirname(targetDir);
    }

    await Promise.all(foundFns);
  };

  async markChildrenAsProdDeps(modulePath: string) {
    if (!await fs.exists(modulePath)) {
      return;
    }

    d('exploring', modulePath);
    const childPackageJson = await readPackageJson(modulePath);
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
  };
}

export function rebuild(
    buildPath: string,
    electronVersion: string,
    arch = process.arch,
    extraModules: string[] = [],
    forceRebuild = false,
    headerURL = 'https://atom.io/download/electron',
    types = ['prod', 'optional'],
    mode = defaultMode) {

  d('rebuilding with args:', arguments);
  const lifecycle = new EventEmitter();
  const rebuilder = new Rebuilder(lifecycle, buildPath, electronVersion, arch, extraModules, forceRebuild, headerURL, types, mode);

  let ret = rebuilder.rebuild() as Promise<void> & { lifecycle: EventEmitter };
  ret.lifecycle = lifecycle;

  return ret;
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
};

