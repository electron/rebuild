import os from 'os';
import path from 'path';
import spawn from './spawn.js';
import promisify from './promisify.js';
const glob = promisify(require('glob'));
const cp = promisify(require('ncp').ncp);

async function link(from, to, cwd) {
  let cmd;
  let args;

  if (from === to) return;

  if (os.platform() === 'win32') {
    cmd = 'mklink';
    args = ['/D', to, from];
  } else {
    cmd = 'ln';
    args = ['-nsf', from, to];
  }

  try {
    return await spawn({cmd, args, cwd});
  } catch (e) {
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.log(e.stderr);

    throw e;
  }
}

async function findNativeModules(cwd, runtime) {
  let mapReadyPaths = {};
  let pathArray = await glob(path.join(cwd, 'node_modules', '**', runtime+'-v*'))

  pathArray.forEach(item => {
    item = item.split(path.sep);

    let val = item.pop();
    mapReadyPaths[path.join(...item)] = path.join(cwd, ...item, val);
  })

  return mapReadyPaths;
}

var pathsBeforeRebuild;

export async function preGypFixSetup(cwd) {
  return pathsBeforeRebuild = await findNativeModules(cwd, 'node');
}

export async function preGypFixRun(cwd) {
  if (!pathsBeforeRebuild) return;

  let pathsAfterRebuild = await findNativeModules(cwd, 'electron');

  for(let key in pathsBeforeRebuild) {
    if (!pathsBeforeRebuild.hasOwnProperty(key) || !pathsAfterRebuild.hasOwnProperty(key)) {
      console.log('node-pre-gyp paths not fixed for', key, '- unexpected behaviour ocurred');
      continue;
    }

    await cp(pathsAfterRebuild[key], pathsBeforeRebuild[key]);
  }
}
