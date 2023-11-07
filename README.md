## Electron Rebuild

[![CircleCI](https://circleci.com/gh/electron/rebuild.svg?style=svg)](https://circleci.com/gh/electron/rebuild)
[![NPM](https://img.shields.io/npm/v/@electron/rebuild.svg?style=flat)](https://npm.im/@electron/rebuild)
[![Coverage Status](https://codecov.io/gh/electron/rebuild/branch/main/graph/badge.svg)](https://codecov.io/gh/electron/rebuild)

This executable rebuilds native Node.js modules against the version of Node.js
that your Electron project is using. This allows you to use native Node.js
modules in Electron apps without your system version of Node.js matching exactly
(which is often not the case, and sometimes not even possible).

### How does it work?

Install the package with `--save-dev`:

```sh
npm install --save-dev @electron/rebuild
```

Then, whenever you install a new npm package, rerun electron-rebuild:

```sh
$(npm bin)/electron-rebuild
```

Or if you're on Windows:

```sh
.\node_modules\.bin\electron-rebuild.cmd
```
If you have a good node-gyp config but you see an error about a missing element on Windows like `Could not load the Visual C++ component "VCBuild.exe"`, try to launch electron-rebuild in an npm script:

```json
"scripts": {
  "rebuild": "electron-rebuild -f -w yourmodule"
}
```

and then

```sh
npm run rebuild
```

### What are the requirements?

Node v12.13.0 or higher is required. Building native modules from source uses
[`node-gyp`](https://github.com/nodejs/node-gyp#installation), refer to the link for its
installation/runtime requirements.

### CLI Arguments

```
Usage: electron-rebuild --version [version] --module-dir [path]

Options:
  -h, --help                   Show help                               [boolean]
  -v, --version                The version of Electron to build against
  -f, --force                  Force rebuilding modules, even if we would skip
                               it otherwise
  -a, --arch                   Override the target architecture to something
                               other than your system's
  -m, --module-dir             The path to the app directory to rebuild
  -w, --which-module           A specific module to build, or comma separated
                               list of modules. Modules will only be rebuilt if they
                               also match the types of dependencies being rebuilt
                               (see --types).
  -e, --electron-prebuilt-dir  The path to the prebuilt electron module
  -d, --dist-url               Custom header tarball URL
  -t, --types                  The types of dependencies to rebuild.  Comma
                               separated list of "prod", "dev" and "optional".
                               Default is "prod,optional"
  -p, --parallel               Rebuild in parallel, this is enabled by default
                               on macOS and Linux
  -s, --sequential             Rebuild modules sequentially, this is enabled by
                               default on Windows
  -o, --only                   Only build specified module, or comma separated
                               list of modules. All others are ignored.
  -b, --debug                  Build debug version of modules
  --prebuild-tag-prefix        GitHub tag prefix passed to prebuild-install.
                               Default is "v"

Copyright 2016
```

### How can I use this with [Electron Forge](https://github.com/electron/forge)?

This package is automatically used with Electron Forge when packaging an Electron app.

### How can I integrate this into [Electron Packager](https://github.com/electron/electron-packager)?

electron-rebuild provides a function compatible with the [`afterCopy` hook](https://electron.github.io/electron-packager/main/interfaces/electronpackager.options.html#aftercopy)
for Electron Packager. For example:

```javascript
import packager from 'electron-packager';
import rebuild from '@electron/rebuild';

packager({
  // … other options
  afterCopy: [(buildPath, electronVersion, platform, arch, callback) => {
    rebuild({ buildPath, electronVersion, arch })
      .then(() => callback())
      .catch((error) => callback(error));
  }],
  // … other options
});
```

### How can I integrate this with [prebuild](https://github.com/prebuild/prebuild)?

If your module uses [prebuild](https://github.com/prebuild/prebuild) for creating prebuilt binaries,
it also uses [prebuild-install](https://github.com/prebuild/prebuild-install) to download them. If
this is the case, then `electron-rebuild` will run `prebuild-install` to download the correct
binaries from the project's GitHub Releases instead of rebuilding them.

### How can I integrate this into Grunt / Gulp / Whatever?

electron-rebuild is also a library that you can require into your app or
build process. It has a very simple API:

```javascript
import rebuild from '@electron/rebuild';

// Public: Rebuilds a node_modules directory with the given Electron version.
//
// options: Object with the following properties
//     buildPath - An absolute path to your app's directory.  (The directory that contains your node_modules)
//     electronVersion - The version of Electron to rebuild for
//     arch (optional) - Default: process.arch - The arch to rebuild for
//     extraModules (optional) - Default: [] - An array of modules to rebuild as well as the detected modules
//     onlyModules (optional) - Default: null - An array of modules to rebuild, ONLY these module names will be rebuilt.
//                                              The "types" property will be ignored if this option is set.
//     force (optional) - Default: false - Force a rebuild of modules regardless of their current build state
//     headerURL (optional) - Default: https://www.electronjs.org/headers - The URL to download Electron header files from
//     types (optional) - Default: ['prod', 'optional'] - The types of modules to rebuild
//     mode (optional) - The rebuild mode, either 'sequential' or 'parallel' - Default varies per platform (probably shouldn't mess with this one)
//     useElectronClang (optional) - Whether to use the clang executable that Electron used when building its binary. This will guarantee compiler compatibility

// Returns a Promise indicating whether the operation succeeded or not
```

A full build process might look something like:

```javascript
const childProcess = require('child_process');
const pathToElectron = require('electron');

  rebuild({
    buildPath: __dirname,
    electronVersion: '1.4.12'
  })
    .then(() => console.info('Rebuild Successful'))
    .catch((e) => {
      console.error("Building modules didn't work!");
      console.error(e);
    });
```
