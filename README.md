## Electron-Rebuild

This executable rebuilds native io.js modules against the version of io.js
that your Electron project is using. This allows you to use native io.js
modules in Electron apps without your system version of io.js matching exactly
(which is often not the case, and sometimes not even possible).

### How does it work?

Install the package with `--save-dev`:

```sh
npm install --save-dev electron-rebuild
```

Then, whenever you install a new npm package, rerun electron-rebuild:

```sh
./node_modules/.bin/electron-rebuild
```

Or if you're on Windows:

```sh
.\node_modules\.bin\electron-rebuild.cmd
```

### How can I integrate this into Grunt / Gulp / Whatever?

electron-rebuild is also a library that you can just require into your app or
build process. It has two main methods:

```js
import { installNodeHeaders, rebuildNativeModules, shouldRebuildNativeModules } from 'electron-rebuild';

// Public: Determines whether we need to rebuild native modules (i.e. if they're 
// already compiled for the right version of Electron, no need to rebuild them!)
//
// pathToElectronExecutable - Path to the electron executable that we'll use 
//                            to determine NODE_MODULE_VERSION
// explicitNodeVersion (optional) - If given, use this instead of probing Electron
//
// Returns a Promise that if true, indicates you should build native modules
let shouldBuild = shouldRebuildNativeModules('/path/to/Electron');

// Public: Downloads and installs the header / lib files required to build
// native modules.
//
// nodeVersion - the version of Electron to download headers for
// nodeDistUrl (optional) - the URL to download the distribution from
// headersDir (optional) - where to put the headers
// arch (optional) - The architecture to build against (for building 32-bit apps 
//                   on 64-bit Windows for example)
//
// Returns a Promise indicating whether the operation succeeded or not
let headerResult = installNodeHeaders('v0.25.0');

// Public: Rebuilds a node_modules directory with the given Electron version.
//
// nodeVersion - the version of Electron to download headers for
// nodeModulesPath - the path to a node_modules directory
// headersDir (optional) - where to find the headers
// Returns a Promise indicating whether the operation succeeded or not
headerResult.then(() => rebuildNativeModules('v0.25.0', './node_modules'));
```

A full build process might look something like:

```js
shouldRebuildNativeModules(pathToElectron)
  .then((shouldBuild) => {
    if (!shouldBuild) return true;
    
    return installNodeHeaders('v0.27.2')
      .then(() => rebuildNativeModules('v0.27.2', './node_modules'));
  })
  .catch((e) => {
    console.error("Building modules didn't work!");
    console.error(e);
  });
```

### `node-pre-gyp` workaround

Note that there is a known [issue](https://github.com/mapbox/node-pre-gyp/pull/187) with
`node-pre-gyp` that prevents it from correctly locating the native modules built by
`electron-rebuild`. `node-pre-gyp` is used by some popular NPM packages like `sqlite3`,
and `node-inspector`, so even if your app or package does not have a direct dependency on
`node-pre-gyp` you're bound to run into this issue sooner or later. To work around it call
`preGypFixRun` after the build is complete in order to copy the native modules to a location
where `node-pre-gyp` can find them:

```js
import { preGypFixRun } from 'electron-rebuild';

return installNodeHeaders('v0.27.2')
  .then(() => rebuildNativeModules('v0.27.2', './node_modules'))
  .then(() => preGypFixRun('./node_modules', true, pathToElectron));
``` 

If you're using the CLI to perform the build then use the `-p` or `--pre-gyp-fix` option.
