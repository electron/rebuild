import path from 'path';
import spawn from './spawn.js';
import promisify from './promisify.js';
import {getElectronModuleVersion} from './main.js';
import logger from './logger.js';
const glob = promisify(require('glob'));
const cp = promisify(require('ncp').ncp);


export async function preGypFixRun(cwd, shouldRun, electronPath, explicitNodeVersion=null) {
  if (!shouldRun) {
    logger('preGypFixRun', 'skip');
    return;
  }

  logger('preGypFixRun', "searching", path.join(cwd, '**', 'electron-v*'));
  let paths = await glob(path.join(cwd, '**', 'electron-v*'));
  let electronModuleVersion = explicitNodeVersion || (await getElectronModuleVersion(electronPath));

  logger('preGypFixRun', paths.length ? `found ${paths.length} to replace` : 'nothing found');
  for(let path of paths) {
    // THE MIGHTY HACK GOES HERE!
    let newPath = path.replace(/electron-v[^-]+/, 'node-v'+electronModuleVersion);

    await cp(path, newPath);
    console.log('node-pre-gyp fixer:', path, 'copied to', newPath)
  }
}
