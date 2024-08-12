#!/usr/bin/env node

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import yargs from 'yargs/yargs';

import { createSpinner } from 'nanospinner';

import { getProjectRootPath } from './search-module';
import { locateElectronModule } from './electron-locator';
import { ModuleType } from './module-walker';
import { rebuild } from './rebuild';

const argv = yargs(process.argv.slice(2)).version(false).options({
  version: { alias: 'v', type: 'string', description: 'The version of Electron to build against' },
  force: { alias: 'f', type: 'boolean', description: 'Force rebuilding modules, even if we would skip it otherwise' },
  arch: { alias: 'a', type: 'string', description: "Override the target architecture to something other than your system's" },
  'module-dir': { alias: 'm', type: 'string', description: 'The path to the node_modules directory to rebuild' },
  // TODO: should be type: array
  'which-module': { alias: 'w', type: 'string', description: 'A specific module to build, or comma separated list of modules. Modules will only be rebuilt if they also match the types of dependencies being rebuilt (see --types).' },
  // TODO: should be type: array
  only: { alias: 'o', type: 'string', description: 'Only build specified module, or comma separated list of modules. All others are ignored.' },
  'electron-prebuilt-dir': { alias: 'e', type: 'string', description: 'The path to the prebuilt electron module' },
  'dist-url': { alias: 'd', type: 'string', description: 'Custom header tarball URL' },
  // TODO: should be type: array
  types: { alias: 't', type: 'string', description: 'The types of dependencies to rebuild.  Comma separated list of "prod", "dev" and "optional".  Default is "prod,optional"' },
  parallel: { alias: 'p', type: 'boolean', description: 'Rebuild in parallel, this is enabled by default on macOS and Linux' },
  sequential: { alias: 's', type: 'boolean', description: 'Rebuild modules sequentially, this is enabled by default on Windows' },
  debug: { alias: 'b', type: 'boolean', description: 'Build debug version of modules' },
  'prebuild-tag-prefix': { type: 'string', description: 'GitHub tag prefix passed to prebuild-install. Default is "v"' },
  'force-abi': { type: 'number', description: 'Override the ABI version for the version of Electron you are targeting.  Only use when targeting Nightly releases.' },
  'use-electron-clang': { type: 'boolean', description: 'Use the clang executable that Electron used when building its binary. This will guarantee compiler compatibility' },
  'disable-pre-gyp-copy': { type: 'boolean', description: 'Disables the pre-gyp copy step' },
  'build-from-source': { type: 'boolean', description: 'Skips prebuild download and rebuilds module from source.'},
}).usage('Usage: $0 --version [version] --module-dir [path]')
  .help()
  .alias('help', 'h')
  .epilog('Copyright 2016-2021')
  .parseSync();

if (process.argv.length === 3 && process.argv[2] === '--version') {
  /* eslint-disable @typescript-eslint/no-var-requires */
  try {
    console.log('Electron Rebuild Version:', require(path.resolve(__dirname, '../../package.json')).version);
  } catch (err) {
    console.log('Electron Rebuild Version:', require(path.resolve(__dirname, '../package.json')).version);
  }
  /* eslint-enable @typescript-eslint/no-var-requires */
  process.exit(0);
}

const handler = (err: Error): void => {
  console.error(chalk.red('\nAn unhandled error occurred inside electron-rebuild'));
  console.error(chalk.red(`${err.message}\n\n${err.stack}`));
  process.exit(-1);
};

process.on('uncaughtException', handler);
process.on('unhandledRejection', handler);


(async (): Promise<void> => {
  const projectRootPath = await getProjectRootPath(process.cwd());
  const electronModulePath = argv.e ? path.resolve(process.cwd(), (argv.e as string)) : await locateElectronModule(projectRootPath);
  let electronModuleVersion = argv.v as string;

  if (!electronModuleVersion) {
    try {
      if (!electronModulePath) throw new Error('Prebuilt electron module not found');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkgJson = require(path.join(electronModulePath, 'package.json'));

      electronModuleVersion = pkgJson.version;
    } catch (e) {
      throw new Error(`Unable to find electron's version number, either install it or specify an explicit version`);
    }
  }

  let rootDirectory = argv.m as string;

  if (!rootDirectory) {
    // NB: We assume here that we're going to rebuild the immediate parent's
    // node modules, which might not always be the case but it's at least a
    // good guess
    rootDirectory = path.resolve(__dirname, '../../..');
    if (!await fs.pathExists(rootDirectory) || !await fs.pathExists(path.resolve(rootDirectory, 'package.json'))) {
      // Then we try the CWD
      rootDirectory = process.cwd();
      if (!await fs.pathExists(rootDirectory) || !await fs.pathExists(path.resolve(rootDirectory, 'package.json'))) {
        throw new Error('Unable to find parent node_modules directory, specify it via --module-dir, E.g. "--module-dir ." for the current directory');
      }
    }
  } else {
    rootDirectory = path.resolve(process.cwd(), rootDirectory);
  }

  if (argv.forceAbi && typeof argv.forceAbi !== 'number') {
    throw new Error('force-abi must be a number');
  }

  let modulesDone = 0;
  let moduleTotal = 0;
  const rebuildSpinner = createSpinner('Searching dependency tree').start();
  let lastModuleName: string;

  const redraw = (moduleName?: string): void => {
    if (moduleName) lastModuleName = moduleName;

    if (argv.p) {
      rebuildSpinner.update({
        text: `Building modules: ${modulesDone}/${moduleTotal}`,
      });
    } else {
      rebuildSpinner.update({
        text: `Building module: ${lastModuleName}, Completed: ${modulesDone}`,
      });
    }
  };

  const rebuilder = rebuild({
    buildPath: rootDirectory,
    electronVersion: electronModuleVersion,
    arch: (argv.a as string) || process.arch,
    extraModules: argv.w ? (argv.w as string).split(',') : [],
    onlyModules: argv.o ? (argv.o as string).split(',') : null,
    force: argv.f as boolean,
    headerURL: argv.d as string,
    types: argv.t ? (argv.t as string).split(',') as ModuleType[] : ['prod', 'optional'],
    mode: argv.p ? 'parallel' : (argv.s ? 'sequential' : undefined),
    debug: argv.debug,
    prebuildTagPrefix: (argv.prebuildTagPrefix as string) || 'v',
    forceABI: argv.forceAbi as number,
    useElectronClang: !!argv.useElectronClang,
    disablePreGypCopy: !!argv.disablePreGypCopy,
    projectRootPath,
    buildFromSource: !!argv.buildFromSource,
  });

  const lifecycle = rebuilder.lifecycle;

  lifecycle.on('module-found', (moduleName: string) => {
    moduleTotal += 1;
    redraw(moduleName);
  });

  lifecycle.on('module-done', () => {
    modulesDone += 1;
    redraw();
  });

  try {
    await rebuilder;
  } catch (err) {
    rebuildSpinner.error({ text: 'Rebuild Failed' });
    throw err;
  }

  rebuildSpinner.success({ text: 'Rebuild Complete' });
})();
