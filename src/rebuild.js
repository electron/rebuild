import { spawnPromise } from 'spawn-rx';
import debug from 'debug';
import EventEmitter from 'events';
import fs from 'fs-promise';
import os from 'os';
import path from 'path';
import readPackageJSON from './read-package-json';

const d = debug('electron-rebuild');

const defaultMode = process.platform === 'win32' ? 'sequential' : 'parallel';

const _rebuild = async (lifecycle, buildPath, electronVersion, arch = process.arch, extraModules = [], forceRebuild = false, headerURL = 'https://atom.io/download/electron', types = ['prod', 'optional'], mode = defaultMode) => {
  if (!path.isAbsolute(buildPath)) {
    throw new Error('Expected buildPath to be an absolute path');
  }
  d('rebuilding with args:', buildPath, electronVersion, arch, extraModules, forceRebuild, headerURL, types);
  const prodDeps = {};
  const rebuilds = [];

  (extraModules || []).forEach((moduleName) => {
    if (!moduleName) return;
    prodDeps[moduleName] = true
  });

  lifecycle.emit('start');

  const rebuildModuleAt = async (modulePath) => {
    if (await fs.exists(path.resolve(modulePath, 'binding.gyp'))) {
      const metaPath = path.resolve(modulePath, 'build', 'Release', '.forge-meta');
      lifecycle.emit('module-found', path.basename(modulePath));
      if (!forceRebuild && await fs.exists(metaPath)) {
        const meta = await fs.readFile(metaPath, 'utf8');
        if (meta === arch) {
          d(`skipping: ${path.basename(modulePath)} as it is already built`);
          lifecycle.emit('module-done');
          lifecycle.emit('module-skip');
          return;
        }
      }
      d('rebuilding:', path.basename(modulePath));
      const rebuildArgs = [
        'rebuild',
        `--target=${electronVersion}`,
        `--arch=${arch}`,
        `--dist-url=${headerURL}`,
        '--build-from-source',
      ];

      const modulePackageJSON = await readPackageJSON(modulePath);
      Object.keys(modulePackageJSON.binary || {}).forEach((binaryKey) => {
        let value = modulePackageJSON.binary[binaryKey];
        if (binaryKey === 'module_path') {
          value = path.resolve(modulePath, value);
        }
        rebuildArgs.push(`--${binaryKey}=${value}`);
      });

      await spawnPromise(path.resolve(__dirname, `../node_modules/.bin/node-gyp${process.platform === 'win32' ? '.cmd' : ''}`), rebuildArgs, {
        cwd: modulePath,
        env: Object.assign({}, process.env, {
          HOME: path.resolve(os.homedir(), '.electron-gyp'),
          USERPROFILE: path.resolve(os.homedir(), '.electron-gyp'),
          npm_config_disturl: 'https://atom.io/download/electron',
          npm_config_runtime: 'electron',
          npm_config_arch: arch,
          npm_config_target_arch: arch,
          npm_config_build_from_source: true,
        }),
      });

      d('built:', path.basename(modulePath));
      await fs.mkdirs(path.dirname(metaPath));
      await fs.writeFile(metaPath, arch);
      lifecycle.emit('module-done');
    }
  };

  const rebuildAllModulesIn = (nodeModulesPath, prefix = '') => {
    d('scanning:', nodeModulesPath);
    for (const modulePath of fs.readdirSync(nodeModulesPath)) {
      if (prodDeps[`${prefix}${modulePath}`]) {
        rebuilds.push(() => rebuildModuleAt(path.resolve(nodeModulesPath, modulePath)));
      }
      if (modulePath.startsWith('@')) {
        rebuildAllModulesIn(path.resolve(nodeModulesPath, modulePath), `${modulePath}/`);
      }
      if (fs.existsSync(path.resolve(nodeModulesPath, modulePath, 'node_modules'))) {
        rebuildAllModulesIn(path.resolve(nodeModulesPath, modulePath, 'node_modules'));
      }
    }
  };

  const findModule = async (moduleName, fromDir, foundFn) => {
    let targetDir = fromDir;
    const foundFns = [];

    while (targetDir !== buildPath) {
      const testPath = path.resolve(targetDir, 'node_modules', moduleName);
      if (await fs.exists(testPath)) {
        foundFns.push(foundFn(testPath));
      }
      targetDir = path.dirname(targetDir);
    }
    await Promise.all(foundFns);
  };

  const markChildrenAsProdDeps = async (modulePath) => {
    if (!await fs.exists(modulePath)) return;
    const childPackageJSON = await readPackageJSON(modulePath);
    const moduleWait = [];

    Object.keys(childPackageJSON.dependencies || {}).concat(Object.keys(childPackageJSON.optionalDependencies || {})).forEach((key) => {
      if (prodDeps[key]) return;
      prodDeps[key] = true;
      moduleWait.push(findModule(key, modulePath, markChildrenAsProdDeps));
    });
    await Promise.all(moduleWait);
  };

  const rootPackageJSON = await readPackageJSON(buildPath);
  const markWaiters = [];
  const depKeys = [];
  if (types.indexOf('prod') !== -1) {
    depKeys.push(...Object.keys(rootPackageJSON.dependencies || {}));
  }
  if (types.indexOf('optional') !== -1) {
    depKeys.push(...Object.keys(rootPackageJSON.optionalDependencies || {}));
  }
  if (types.indexOf('dev') !== -1) {
    depKeys.push(...Object.keys(rootPackageJSON.devDependencies || {}));
  }
  depKeys.forEach((key) => {
    prodDeps[key] = true;
    markWaiters.push(markChildrenAsProdDeps(path.resolve(buildPath, 'node_modules', key)));
  });

  await Promise.all(markWaiters);

  d('identified prod deps:', prodDeps);

  rebuildAllModulesIn(path.resolve(buildPath, 'node_modules'));

  if (mode !== 'sequential') {
    await Promise.all(rebuilds.map(fn => fn()));
  } else {
    for (const rebuildFn of rebuilds) {
      await rebuildFn();
    }
  }
};

const rebuild = (...args) => {
  const lifecycle = new EventEmitter();
  d('rebuilding with args:', args);
  const rebuilder = _rebuild(lifecycle, ...args);
  rebuilder.lifecycle = lifecycle;
  return rebuilder;
}

export const rebuildNativeModules = (electronVersion, modulePath, whichModule='', headersDir=null, arch=process.arch, command, ignoreDevDeps=false, ignoreOptDeps=false, verbose=false) => {
  d('rebuilding in:', modulePath);
  console.warn('You are using the old API, please read the new docs and update to thew new API');
  return rebuild(modulePath, electronVersion, arch, whichModule.split(','));
};

export default rebuild;