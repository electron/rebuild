#!/usr/bin/env node

require('babel/polyfill');

import {installNodeHeaders, rebuildNativeModules} from './main.js';
import path from 'path';

const argv = require('yargs')
  .usage('Usage: electron-rebuild --version [version] --module-dir [path]')
  .help('h')
  .alias('h', 'help')
  .describe('v', 'The version of Electron to build against')
  .alias('v', 'version')
  .describe('m', 'The path to the node-modules directory to rebuild')
  .alias('m', 'module-dir')
  .epilog('Copyright 2015')
  .argv;
  
if (!argv.v) {
  // NB: We assume here that electron-prebuilt is a sibling package of ours
  let pkg = null;
  try {
    pkg = require('../../electron-prebuilt/package.json');
    argv.v = pkg.version;
  } catch (e) {
    console.error("Unable to find electron-prebuilt's version number, either install it or specify an explicit version");
    process.exit(-1);
  }
}

if (!argv.m) {
  // NB: We assume here that we're going to rebuild the immediate parent's 
  // node modules, which might not always be the case but it's at least a
  // good guess
  try {
    argv.m = path.resolve(__dirname, '../..');
  } catch (e) {
    console.error("Unable to find parent node_modules directory, specify it via --module-dir");
    process.exit(-1);
  }
}

installNodeHeaders(argv.v)
  .then(() => rebuildNativeModules(argv.v, argv.m))
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    console.error(e.stack);
    process.exit(-1);
  });
