## Electron-Rebuild

This executable rebuilds node & iojs modules against the version of io.js
that your Electron project is using. This allows you to use native node & io.js
modules in Electron apps without your system version of io.js matching exactly
(which is often not the case, and sometimes not even possible).

### How does it work?

Install the package with `--save-dev`:

```sh
npm install --save-dev electron-rebuild
```

Then, whenever you install a new npm package, rerun electron-rebuild:

```sh
./node_modules/.bin/electron-rebuild # [options]
```

#### options
See [src/cli.js](src/cli.js) to see the available cli options to configure your rebuild.

##### quick builds `quick`
The `-q` flag will maintain a list of what packages have been built against a
target version, and only rebuild those modules that are not currently built
against it.

##### ignore modules to rebuild `ignore`
When using this module programatically, you can add `ignore: ['array', 'of', 'package', names]`
when calling `rebuildNativeModules` to _not_ rebuild those modules.  This feature
_must be used in conjuction with quick mode_, or is ignored.

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
