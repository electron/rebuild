#!/usr/bin/env node

require('babel-core/polyfill');

import {installNodeHeaders, rebuildNativeModules, shouldRebuildNativeModules} from './main.js';
import path from 'path';
import fs from 'fs';

const argv = require('yargs')
  .usage('Usage: electron-rebuild --version [version] --module-dir [path]')
  .help('h')
  .alias('h', 'help')
  .describe('v', 'The version of Electron to build against')
  .alias('v', 'version')
  .describe('n', 'The NODE_MODULE_VERSION to compare against (process.versions.modules)')
  .alias('n', 'node-module-version')
  .describe('f', 'Force rebuilding modules, even if we would skip it otherwise')
  .alias('f', 'force')
  .describe('a', "Override the target architecture to something other than your system's")
  .alias('a', 'arch')
  .describe('m', 'The path to the node_modules directory to rebuild')
  .alias('m', 'module-dir')
  .describe('e', 'The path to electron-prebuilt')
  .alias('e', 'electron-prebuilt-dir')
  .epilog('Copyright 2015')
  .argv;

if (!argv.e) {
  argv.e = path.join(__dirname, '..', '..', 'electron-prebuilt');
}

if (!argv.v) {
  // NB: We assume here that electron-prebuilt is a sibling package of ours
  let pkg = null;
  try {
    let pkgJson = path.join(argv.e, 'package.json');

    pkg = require(pkgJson);

    argv.v = pkg.version;
  } catch (e) {
    console.error("Unable to find electron-prebuilt's version number, either install it or specify an explicit version");
    process.exit(-1);
  }
}

let electronPath = null;
let nodeModuleVersion = null;

if (!argv.n) {
  try {
    let pathDotText = path.join(argv.e, 'path.txt');
    electronPath = fs.readFileSync(pathDotText, 'utf8');
  } catch (e) {
    console.error("Couldn't find electron-prebuilt and no --node-module-version parameter set, always rebuilding");
  }
} else {
  nodeModuleVersion = parseInt(argv.n);
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

let shouldRebuildPromise = null;
if (!electronPath && !nodeModuleVersion) {
  shouldRebuildPromise = Promise.resolve(true);
} else if (argv.f) {
  shouldRebuildPromise = Promise.resolve(true);
} else {
  shouldRebuildPromise = shouldRebuildNativeModules(electronPath, nodeModuleVersion);
}

shouldRebuildPromise
  .then(x => {
    if (!x) process.exit(0);

    return installNodeHeaders(argv.v, null, null, argv.a)
      .then(() => rebuildNativeModules(argv.v, argv.m, null, argv.a))
      .then(() => process.exit(0));
  })
  .catch((e) => {
    console.error(e.message);
    console.error(e.stack);
    process.exit(-1);
  });
