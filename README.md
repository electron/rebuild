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
                               list of modules
  -e, --electron-prebuilt-dir  The path to electron-prebuilt
  -d, --dist-url               Custom header tarball URL
  -t, --types                  The types of dependencies to rebuild.  Comma
                               seperated list of "prod", "dev" and "optional".
                               Default is "prod,optional"
  -p, --parallel               Rebuild in parallel, this is enabled by default
                               on macOS and Linux
  -s, --sequential             Rebuild modules sequentially, this is enabled by
                               default on Windows

Copyright 2016
```

### How can I integrate this into Grunt / Gulp / Whatever?

electron-rebuild is also a library that you can just require into your app or
build process. It has a very simple API:

```js
import rebuild from 'electron-rebuild';

// Public: Rebuilds a node_modules directory with the given Electron version.
//
// appPath - An absolute path to your app's directory.  (The directory that contains your node_modules)
// electronVersion - The version of Electron to rebuild for
// arch (optional) - Default: process.arch - The arch to rebuild for
// extraModules (optional) - Default: [] - An array of modules to rebuild as well as the detected modules
// forceRebuild (optional) - Default: false - Force a rebuild of modules regardless of their current build state
// headerURL (optional) - Default: atom.io/download/electron - The URL to download Electron header files from
// types (optional) - Default: ['prod', 'optional'] - The types of modules to rebuild
// mode (optional) - The rebuild mode, either 'sequential' or 'parallel' - Default varies per platform (probably shouldn't mess with this one)

// Returns a Promise indicating whether the operation succeeded or not
```

A full build process might look something like:

```js
let childProcess = require('child_process');
let pathToElectron = require('electron-prebuilt');

  rebuild(__dirname, '1.4.12')
    .then(() => console.info('Rebuild Successful'))
    .catch((e) => {
      console.error("Building modules didn't work!");
      console.error(e);
    });
```

### Alternatives

- [require-rebuild](https://github.com/juliangruber/require-rebuild) patches `require()` to rebuild native node modules on the fly
