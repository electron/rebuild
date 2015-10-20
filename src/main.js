import path from 'path';
import _ from 'lodash';
import childProcess from 'child_process';
import spawn from './spawn';
import promisify from './promisify';
import os from 'os';
import { getCachedBuildVersions, getInstalledModules, upsertCache } from './cache';

const fs = promisify(require('fs'));

const getHeadersRootDirForVersion = (version) => {
  return path.resolve(__dirname, 'headers');
};

const checkForInstalledHeaders = async function(nodeVersion, headersDir) {
  const canary = path.join(headersDir, '.node-gyp', nodeVersion, 'common.gypi');
  let stat = await fs.stat(canary);

  if (!stat) throw new Error("Canary file 'common.gypi' doesn't exist");
  return true;
};

const spawnWithHeadersDir = async (cmd, args, headersDir, cwd) => {
  let env = _.extend({}, process.env, { HOME: headersDir });
  if (process.platform === 'win32')  {
    env.USERPROFILE = env.HOME;
  }

  try {
    let opts = {env};
    if (cwd) {
      opts.cwd = cwd;
    }

    return await spawn({cmd, args, opts});
  } catch (e) {
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.log(e.stderr);

    throw e;
  }
};

const getElectronModuleVersion = async (pathToElectronExecutable) => {
  let args = [ '-e', 'console.log(process.versions.modules)' ]
  let env = { ATOM_SHELL_INTERNAL_RUN_AS_NODE: '1' };

  let result = await spawn({cmd: pathToElectronExecutable, args, opts: {env}});
  let versionAsString = (result.stdout + result.stderr).replace(/\n/g, '');

  if (!versionAsString.match(/^\d+$/)) {
    throw new Error(`Failed to check Electron's module version number: ${versionAsString}`);
  }

  return toString(versionAsString);
}

export async function installNodeHeaders(nodeVersion, nodeDistUrl=null, headersDir=null, arch=null) {
  headersDir = headersDir || getHeadersRootDirForVersion(nodeVersion);
  let distUrl = nodeDistUrl || 'https://gh-contractor-zcbenz.s3.amazonaws.com/atom-shell/dist';

  try {
    await checkForInstalledHeaders(nodeVersion, headersDir);
    return;
  } catch (e) { }

  let cmd = 'node';
  let args = [
    require.resolve('npm/node_modules/node-gyp/bin/node-gyp'), 'install',
    `--target=${nodeVersion}`,
    `--arch=${arch || process.arch}`,
    `--dist-url=${distUrl}`
  ];

  await spawnWithHeadersDir(cmd, args, headersDir);
}

export async function shouldRebuildNativeModules(pathToElectronExecutable, explicitNodeVersion=null) {
  // Try to load our canary module - if it fails, we know that it's built
  // against a different node module than ours, so we're good
  //
  // NB: Apparently on OS X, this not only fails to be required, it segfaults
  // the process, because lol.
  try {
    let args = ['-e', 'require("nslog")']
    await spawn({cmd: process.execPath, args});

    require('nslog');
  } catch (e) {
    return true;
  }

  // We need to check the native module version of Electron vs ours - if they
  // happen to be the same, we're good
  let version = explicitNodeVersion ||
    (await getElectronModuleVersion(pathToElectronExecutable));

  if (version === process.versions.modules) {
    return false;
  }

  // If we loaded nslog and the versions don't match, we've got to rebuild
  return true;
}

export async function rebuildNativeModules(cfg) {
  let opts = _.isString(cfg) ? { nodeVersion: cfg } : _.assign({}, cfg);
  opts = _.defaults(opts, { headersDir: null, arch: null });
  opts.headersDir = opts.headersDir || getHeadersRootDirForVersion(opts.nodeVersion);
  await checkForInstalledHeaders(opts.nodeVersion, opts.headersDir);

  if (opts.quick) {
      return rebuildNativeModulesQuick(opts);
  }
  return rebuildNativeModulesDefault(opts);
}

/**
 * Rebuilds modules one-by-one, conditionally, if they are not already built
 * per the cache table
 * @param {object} opts cli-ops
 * @return {Promise}
 */
export async function rebuildNativeModulesQuick(opts) {
  const { nodeModulesPath } = opts;
  const [ installedPkgs, builtPkgs ] = await Promise.all([
      getInstalledModules(nodeModulesPath),
      getCachedBuildVersions(nodeModulesPath)
  ]);
  let toBuild = installedPkgs.filter(pkg => {
    // test if installed pkg has matching built pkg, per the cache.
    // include pkg in the `toBuild` list if no matching built module, or if
    // the module folder has changed since last build
    return !builtPkgs.some(builtPkg => {
        return (
            builtPkg.package === pkg.package &&
            builtPkg.nodeVersion === opts.nodeVersion &&
            builtPkg.ctime === pkg.stat.ctime.toISOString()
        );
    });
  });

  if (opts.ignore) {
      const ignore = Array.isArray(opts.ignore) ? opts.ignore : [opts.ignore];
      toBuild = toBuild.filter(pkg => !_.contains(ignore, pkg.package));
  }

  toBuild = toBuild.map(pkg => {
      return {
          package: pkg.package,
          nodeVersion: opts.nodeVersion,
          ctime: pkg.stat.ctime.toISOString()
      };
  });
  if (!toBuild.length) {
      console.log(`electron-rebuild: all builds up-to-date`);
      return Promise.resolve();
  }
  try {
    // sequentially build each package
    const total = toBuild.length;
    await toBuild.reduce((prev, bld, ndx)=> {
       const buildNdx = ndx + 1;
       const bOps = Object.assign({}, bld, opts);
       return prev.then(last => {
          console.log(`electron-rebuild: ${buildNdx}/${total}, ${bld.package}`);
          return rebuildNativeModulesDefault(bOps);
      }).catch(function(err) {
          console.log(err);
          throw err;
      });
    }, Promise.resolve());
    console.log('electron-rebuild: updating build cache');
    return await upsertCache(nodeModulesPath, toBuild);
  } catch(err) {
    console.error('unable to build target modules or update cache');
    throw err;
  }
}

export async function rebuildNativeModulesDefault(opts) {
  const { headersDir, nodeModulesPath } = opts;
  let cmd = 'node';
  let args = [
    require.resolve('npm/bin/npm-cli'), 'rebuild',
    opts.package ? opts.package : null,
    opts.whichModule ? opts.whichModule : null,
    '--runtime=electron',
    `--target=${opts.nodeVersion}`,
    `--arch=${opts.arch || process.arch}`
   ].filter(arg => arg);

  return await spawnWithHeadersDir(cmd, args, headersDir, nodeModulesPath);
}
