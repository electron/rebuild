import path from 'path';
import spawn from './spawn.js';
import promisify from './promisify.js';
import {getElectronModuleVersion} from './main.js';
const glob = promisify(require('glob'));
const cp = promisify(require('ncp').ncp);

export async function preGypFixRun(cwd, shouldRun, electronPath, explicitNodeVersion=null) {
  if (!shouldRun) return;

  let paths = await glob(path.join(cwd, '**', 'electron-v*'));
  let electronModuleVersion = explicitNodeVersion || (await getElectronModuleVersion(electronPath));

  for(let path of paths) {
    // THE MIGHTY HACK GOES HERE!
    let newPath = path.replace(/electron-v[^-]+/, 'node-v'+electronModuleVersion);

    await cp(path, newPath);
    console.log('node-pre-gyp fixer:', path, 'copied to', newPath)
  }
}
