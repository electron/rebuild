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

### How can I integrate this into Grunt / Gulp / Whatever?

electron-rebuild is also a library that you can just require into your app or
build process. It has two main methods:

```js
import { installNodeHeaders, rebuildNativeModules } from 'electron-rebuild';

// Public: Downloads and installs the header / lib files required to build
// native modules.
//
// nodeVersion - the version of Electron to download headers for
// nodeDistUrl (optional) - the URL to download the distribution from
// headersDir (optional) - where to put the headers
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
