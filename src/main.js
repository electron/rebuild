require('babel-core');

import path from 'path';
import _ from 'lodash';
import childProcess from 'child_process';
import spawn from './spawn';
import promisify from './promisify';

const getHeadersRootDirForVersion = (version) => {
  return path.resolve(__dirname, 'headers');
}

export function installNodeHeaders(nodeVersion, nodeDistUrl=null) {
  let headersDir = getHeadersRootDirForVersion(nodeVersion);
  let distUrl = nodeDistUrl || 'https://gh-contractor-zcbenz.s3.amazonaws.com/atom-shell/dist';

  let canary = path.join(headersDir, '.node-gyp', nodeVersion, 'common.gypi');
  /*
  await fs.exists
  
  if (fs.existsSync(canary))
    return rx.Observable.create (subj) ->
      grunt.verbose.ok 'Found existing node.js installation, skipping install to save time!'
      rx.Observable.return(true).subscribe(subj)

  cmd = 'node'
  args = [require.resolve('npm/node_modules/node-gyp/bin/node-gyp'), 'install',
    "--target=#{nodeVersion}",
    "--arch=#{nodeArch}",
    "--dist-url=#{distUrl}"]

  env = _.extend {}, process.env, HOME: nodeGypHome
  env.USERPROFILE = env.HOME if process.platform is 'win32'

  rx.Observable.create (subj) ->
    grunt.verbose.ok 'Installing node.js'
    spawnObservable({cmd, args, opts: {env}, stdout: stdout, stderr: stderr}).subscribe(subj)
    */
}
