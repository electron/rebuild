## Electron-Rebuild

This executable rebuilds native Node.js modules against the version of Node.js
that your Electron project is using. This allows you to use native Node.js
modules in Electron apps without your system version of Node.js matching exactly
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
If you have a good node-gyp config but you see an error about a missing element on Windows like "Could not load the Visual C++ component "VCBuild.exe" , try to launch electron-rebuild in an npm script:

```json
"scripts": {
  "rebuild" : "electron-rebuild -f -w yourmodule"
}
```

and then

```sh
npm run rebuild
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
let headerResult = installNodeHeaders('1.3.1');

// Public: Rebuilds a node_modules directory with the given Electron version.
//
// nodeVersion - the version of Electron to download headers for
// nodeModulesPath - the path to a node_modules directory
// headersDir (optional) - where to find the headers
// Returns a Promise indicating whether the operation succeeded or not
headerResult.then(() => rebuildNativeModules('1.3.1', './node_modules'));
```

A full build process might look something like:

```js
let childProcess = require('child_process');
let pathToElectron = require('electron-prebuilt');

shouldRebuildNativeModules(pathToElectron)
  .then((shouldBuild) => {
    if (!shouldBuild) return true;

    let electronVersion = childProcess.execSync(`${pathToElectron} --version`, {
      encoding: 'utf8',
    });
    electronVersion = electronVersion.match(/v(\d+\.\d+\.\d+)/)[1];

    return installNodeHeaders(electronVersion)
      .then(() => rebuildNativeModules(electronVersion, './node_modules'));
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

return installNodeHeaders('1.3.1')
  .then(() => rebuildNativeModules('1.3.1', './node_modules'))
  .then(() => preGypFixRun('./node_modules', true, pathToElectron));
```

If you're using the CLI to perform the build then use the `-p` or `--pre-gyp-fix` option.

### Alternatives

- [require-rebuild](https://github.com/juliangruber/require-rebuild) patches `require()` to rebuild native node modules on the fly
