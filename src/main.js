require('babel/polyfill');

import path from 'path';
import _ from 'lodash';
import childProcess from 'child_process';
import spawn from './spawn';
import promisify from './promisify';

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

const spawnWithHeadersDir = async (cmd, args, headersDir) => {
  let env = _.extend({}, process.env, { HOME: headersDir });
  if (process.platform === 'win32')  {
    env.USERPROFILE = env.HOME;
  }
  
  try {
    return await spawn({cmd, args, opts: {env}});
  } catch (e) {
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.log(e.stderr);
    
    throw e;
  }
};

export async function installNodeHeaders(nodeVersion, nodeDistUrl=null, headersDir=null) {
  headersDir = headersDir || getHeadersRootDirForVersion(nodeVersion);
  let distUrl = nodeDistUrl || 'https://gh-contractor-zcbenz.s3.amazonaws.com/atom-shell/dist';

  try {
    await checkForInstalledHeaders(headersDir);
    return;
  } catch (e) { }
  
  let cmd = 'node';
  let args = [
    require.resolve('npm/node_modules/node-gyp/bin/node-gyp'), 'install',
    `--target=${nodeVersion}`,
    `--arch=${process.arch}`,
    `--dist-url=${distUrl}`
  ];
  
  await spawnWithHeadersDir(cmd, args, headersDir);
}

export async function rebuildNativeModules(nodeVersion, nodeModulesPath, headersDir=null) {
  headersDir = headersDir || getHeadersRootDirForVersion(nodeVersion);
  await checkForInstalledHeaders(nodeVersion, headersDir);
  
  let cmd = 'node';
  let args = [
    require.resolve('npm/bin/npm-cli'), 'rebuild', 
    `--target=${nodeVersion}`, 
    `--arch=${process.arch}`
  ];
  
  await spawnWithHeadersDir(cmd, args, headersDir);
}
