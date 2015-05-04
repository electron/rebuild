require('babel-core');

import path from 'path';
import _ from 'lodash';
import childProcess from 'child_process';
import spawn from './spawn';
import promisify from './promisify';

const fs = promisify(require('fs'));

const getHeadersRootDirForVersion = (version) => {
  return path.resolve(__dirname, 'headers');
}

export async function installNodeHeaders(nodeVersion, nodeDistUrl=null, headersDir=null) {
  headersDir = headersDir || getHeadersRootDirForVersion(nodeVersion);
  let distUrl = nodeDistUrl || 'https://gh-contractor-zcbenz.s3.amazonaws.com/atom-shell/dist';

  let canary = path.join(headersDir, '.node-gyp', nodeVersion, 'common.gypi');
  try {
    let stat = await fs.stat(canary)
    if (stat) return true;
  } catch (e) { }
  
  let cmd = 'node';
  let args = [
    require.resolve('npm/node_modules/node-gyp/bin/node-gyp'), 'install',
    `--target=${nodeVersion}`,
    `--arch=${process.arch}`,
    `--dist-url=${distUrl}`
  ];

  let env = _.extend({}, process.env, { HOME: headersDir });
  if (process.platform === 'win32')  {
    env.USERPROFILE = env.HOME;
  }
  
  await spawn({cmd, args, opts: {env}});
}
