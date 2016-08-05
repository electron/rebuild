<a name="1.2.0"></a>
# 1.2.0 (2016-08-05)

* add changelog generator and npm script ([2cb89f2](https://github.com/paulcbetts/electron-rebuild/commit/2cb89f2))
* add contributing doc ([46b2fdd](https://github.com/paulcbetts/electron-rebuild/commit/46b2fdd))
* Add dist-url switch to cli ([61eca85](https://github.com/paulcbetts/electron-rebuild/commit/61eca85))
* Added a notice about windows errors ([6b73600](https://github.com/paulcbetts/electron-rebuild/commit/6b73600))
* clean up notes about windows ([828c2d1](https://github.com/paulcbetts/electron-rebuild/commit/828c2d1))
* document publishing process ([4caf92f](https://github.com/paulcbetts/electron-rebuild/commit/4caf92f))
* Fix test errors: "ReferenceError: canary is not defined" ([fd95294](https://github.com/paulcbetts/electron-rebuild/commit/fd95294))
* Set old ATOM_SHELL env var for old Electrons ([51d2eda](https://github.com/paulcbetts/electron-rebuild/commit/51d2eda))
* Update the README with fixed examples, more convenient code sample, mention Node ([dba3d2a](https://github.com/paulcbetts/electron-rebuild/commit/dba3d2a))
* Use ELECTRON_RUN_AS_NODE env var ([2e2d210](https://github.com/paulcbetts/electron-rebuild/commit/2e2d210))



<a name="1.1.4"></a>
## 1.1.4 (2016-05-16)

* Add v1.0.1 as a test version ([df1b027](https://github.com/paulcbetts/electron-rebuild/commit/df1b027))
* Check for canary file in the `iojs` header folder aswell.  Fixes #66 ([8c2266b](https://github.com/paulcbetts/electron-rebuild/commit/8c2266b)), closes [#66](https://github.com/paulcbetts/electron-rebuild/issues/66)
* Mention require-rebuild ([a066318](https://github.com/paulcbetts/electron-rebuild/commit/a066318))
* Nuke this check, we really just want to know if rebuild works ([9df01d7](https://github.com/paulcbetts/electron-rebuild/commit/9df01d7))
* Version bump to 1.1.4 ([b52f89d](https://github.com/paulcbetts/electron-rebuild/commit/b52f89d))



<a name="1.1.3"></a>
## 1.1.3 (2016-02-02)

* Document the node-pre-gyp workaround and make it easier to invoke ([da6a40a](https://github.com/paulcbetts/electron-rebuild/commit/da6a40a))
* Version bump to 1.1.3 ([d6912ac](https://github.com/paulcbetts/electron-rebuild/commit/d6912ac))



<a name="1.1.2"></a>
## 1.1.2 (2016-01-26)

* Create CODE_OF_CONDUCT.md ([3ca5c8c](https://github.com/paulcbetts/electron-rebuild/commit/3ca5c8c))
* Support electron-prebuilt-compile ([deb2ac2](https://github.com/paulcbetts/electron-rebuild/commit/deb2ac2))
* Version bump to 1.1.2 ([f3bb051](https://github.com/paulcbetts/electron-rebuild/commit/f3bb051))



<a name="1.1.1"></a>
## 1.1.1 (2016-01-10)

* Fix help ([c01b0ce](https://github.com/paulcbetts/electron-rebuild/commit/c01b0ce))
* Version bump to 1.1.1 ([da2b8e3](https://github.com/paulcbetts/electron-rebuild/commit/da2b8e3))



<a name="1.1.0"></a>
# 1.1.0 (2016-01-10)

* add flag for which node module to build ([5bfabd6](https://github.com/paulcbetts/electron-rebuild/commit/5bfabd6))
* allow different npm commands ([93fa496](https://github.com/paulcbetts/electron-rebuild/commit/93fa496))
* Fix totally weirdo test ([36554cf](https://github.com/paulcbetts/electron-rebuild/commit/36554cf))
* Handle relative paths for electron-prebuilt-dir parameter ([87350c8](https://github.com/paulcbetts/electron-rebuild/commit/87350c8))
* On Windows, don't attach to current console session ([6dcf021](https://github.com/paulcbetts/electron-rebuild/commit/6dcf021)), closes [#37](https://github.com/paulcbetts/electron-rebuild/issues/37)
* Reorder parameters to move new 'command' param to the end ([76cab8c](https://github.com/paulcbetts/electron-rebuild/commit/76cab8c))
* Resolve relative path from path.txt ([a3e5173](https://github.com/paulcbetts/electron-rebuild/commit/a3e5173)), closes [#39](https://github.com/paulcbetts/electron-rebuild/issues/39)
* Update all our stuffs ([75ee6e0](https://github.com/paulcbetts/electron-rebuild/commit/75ee6e0))
* Update README.md ([41261a2](https://github.com/paulcbetts/electron-rebuild/commit/41261a2))
* Use path.resolve as suggested by @felicienfrancois ([66ed480](https://github.com/paulcbetts/electron-rebuild/commit/66ed480))
* Version bump to 1.1.0 ([8f24624](https://github.com/paulcbetts/electron-rebuild/commit/8f24624))
* We don't care about these old Electron versions ([541bfeb](https://github.com/paulcbetts/electron-rebuild/commit/541bfeb))
* Fix: actually take into account electron's process.versions.module, code cleanup ([7359a86](https://github.com/paulcbetts/electron-rebuild/commit/7359a86))
* Bugfix: path to electron binary should not be relative to node_modules/electron-prebuilt ([0216629](https://github.com/paulcbetts/electron-rebuild/commit/0216629))
* Bugfix: versionAsString is already a string ([6fdd7d6](https://github.com/paulcbetts/electron-rebuild/commit/6fdd7d6))
* Workaround: node-pre-gyp lacks electron runtime detection ([0e87756](https://github.com/paulcbetts/electron-rebuild/commit/0e87756))



<a name="1.0.1"></a>
## 1.0.1 (2015-10-02)

* Pass --runtime when calling npm ([25bc439](https://github.com/paulcbetts/electron-rebuild/commit/25bc439))
* Version bump to 1.0.1 ([bacab77](https://github.com/paulcbetts/electron-rebuild/commit/bacab77))



<a name="1.0.0"></a>
# 1.0.0 (2015-09-03)

* Add a test for building modules against 0.31.2 ([f865b77](https://github.com/paulcbetts/electron-rebuild/commit/f865b77))
* Bump erry'thing else too ([3ea9c5f](https://github.com/paulcbetts/electron-rebuild/commit/3ea9c5f))
* Fix up regenerator nonsense ([809add8](https://github.com/paulcbetts/electron-rebuild/commit/809add8))
* Move to babel-runtime in rebuild ([809fb96](https://github.com/paulcbetts/electron-rebuild/commit/809fb96))
* Update nslog to 3.0.0, fixes #19 ([68ea0b8](https://github.com/paulcbetts/electron-rebuild/commit/68ea0b8)), closes [#19](https://github.com/paulcbetts/electron-rebuild/issues/19)
* Version bump to 1.0.0 ([44627b1](https://github.com/paulcbetts/electron-rebuild/commit/44627b1))



<a name="0.2.5"></a>
## 0.2.5 (2015-07-22)

* :art: Add space ([ebfdc5a](https://github.com/paulcbetts/electron-rebuild/commit/ebfdc5a))
* :art: remove log line ([d3335f2](https://github.com/paulcbetts/electron-rebuild/commit/d3335f2))
* :art: Semicolon ([8f9bae1](https://github.com/paulcbetts/electron-rebuild/commit/8f9bae1))
* Add option for specifying electron-prebuilt path ([58ad7d0](https://github.com/paulcbetts/electron-rebuild/commit/58ad7d0))
* Debounce multiple copies of babel-core/polyfill ([4bf42d4](https://github.com/paulcbetts/electron-rebuild/commit/4bf42d4))
* omg typo ([b7244e7](https://github.com/paulcbetts/electron-rebuild/commit/b7244e7))
* Remove unnecessary whitespace ([460b4b2](https://github.com/paulcbetts/electron-rebuild/commit/460b4b2))
* Version bump to 0.2.4 ([7778203](https://github.com/paulcbetts/electron-rebuild/commit/7778203))
* Version bump to 0.2.5 ([55ad2ee](https://github.com/paulcbetts/electron-rebuild/commit/55ad2ee))



<a name="0.2.3"></a>
## 0.2.3 (2015-07-02)

* Fix checking for installed headers ([390d3a1](https://github.com/paulcbetts/electron-rebuild/commit/390d3a1))
* Version bump dependencies ([c464bfa](https://github.com/paulcbetts/electron-rebuild/commit/c464bfa))
* Version bump to 0.2.3 ([f9a4b21](https://github.com/paulcbetts/electron-rebuild/commit/f9a4b21))



<a name="0.2.2"></a>
## 0.2.2 (2015-06-05)

* Update to latest Babel ([07a3012](https://github.com/paulcbetts/electron-rebuild/commit/07a3012))
* Version bump to 0.2.2 ([fd5e409](https://github.com/paulcbetts/electron-rebuild/commit/fd5e409))



<a name="0.2.1"></a>
## 0.2.1 (2015-06-01)

* Add an optional parameter to override the arch ([29b01ab](https://github.com/paulcbetts/electron-rebuild/commit/29b01ab))
* Dox some stuff ([8d3f232](https://github.com/paulcbetts/electron-rebuild/commit/8d3f232))
* Version bump to 0.2.1 ([7886932](https://github.com/paulcbetts/electron-rebuild/commit/7886932))



<a name="0.2.0"></a>
# 0.2.0 (2015-05-27)

* Add a canary module we can use to check if we're on the right version ([f0647b6](https://github.com/paulcbetts/electron-rebuild/commit/f0647b6))
* Add electron-prebuilt for tests ([b71046b](https://github.com/paulcbetts/electron-rebuild/commit/b71046b))
* Allow us to explicitly specify a target node module version for Electron ([61eb7e5](https://github.com/paulcbetts/electron-rebuild/commit/61eb7e5))
* Bump npm to latest ([38d9e32](https://github.com/paulcbetts/electron-rebuild/commit/38d9e32))
* Come Correct with README ([3e0b643](https://github.com/paulcbetts/electron-rebuild/commit/3e0b643))
* Fix bug where we didn't build the right dir ([e456ec9](https://github.com/paulcbetts/electron-rebuild/commit/e456ec9))
* Fix up our requires ([efcaa41](https://github.com/paulcbetts/electron-rebuild/commit/efcaa41))
* Implement the CLI side of it ([064dd05](https://github.com/paulcbetts/electron-rebuild/commit/064dd05))
* Make it easier to change native module version ([5185555](https://github.com/paulcbetts/electron-rebuild/commit/5185555))
* spawn returns an object, not stdout ([1858c97](https://github.com/paulcbetts/electron-rebuild/commit/1858c97))
* typo ([f8866d8](https://github.com/paulcbetts/electron-rebuild/commit/f8866d8))
* Version bump to 0.2.0 ([8348059](https://github.com/paulcbetts/electron-rebuild/commit/8348059))
* Work around node bug that segfaults the interpreter on bad modules ([382c580](https://github.com/paulcbetts/electron-rebuild/commit/382c580))
* Write a method to check if native modules need to be rebuilt ([46a17de](https://github.com/paulcbetts/electron-rebuild/commit/46a17de))
* Write a test for detecting native module rebuild ([8675d2f](https://github.com/paulcbetts/electron-rebuild/commit/8675d2f))



<a name="0.1.4"></a>
## 0.1.4 (2015-05-05)

* 0.1.4 ([7a18845](https://github.com/paulcbetts/electron-rebuild/commit/7a18845))
* babelllllllll ([551d13c](https://github.com/paulcbetts/electron-rebuild/commit/551d13c))



<a name="0.1.3"></a>
## 0.1.3 (2015-05-05)

* 0.1.3 ([05527d8](https://github.com/paulcbetts/electron-rebuild/commit/05527d8))
* Add npmignore so we'll end up shipping lib/ ([d61776f](https://github.com/paulcbetts/electron-rebuild/commit/d61776f))
* Clean up after ourselves properly ([e65aa93](https://github.com/paulcbetts/electron-rebuild/commit/e65aa93))
* Fix thrashing about we did to try to fix npm issue ([fff939f](https://github.com/paulcbetts/electron-rebuild/commit/fff939f))
* Test against 0.21.0 so we don't get header silliness ([4b2352e](https://github.com/paulcbetts/electron-rebuild/commit/4b2352e))



<a name="0.1.2"></a>
## 0.1.2 (2015-05-04)

* 0.1.2 ([570b7d8](https://github.com/paulcbetts/electron-rebuild/commit/570b7d8))



<a name="0.1.1"></a>
## 0.1.1 (2015-05-04)

* No need for chmod ([406cca6](https://github.com/paulcbetts/electron-rebuild/commit/406cca6))
* Version bump to 0.1.1 ([c83402e](https://github.com/paulcbetts/electron-rebuild/commit/c83402e))



<a name="0.1.0"></a>
# 0.1.0 (2015-05-04)

* Add a command-line version ([bdde4b8](https://github.com/paulcbetts/electron-rebuild/commit/bdde4b8))
* Add super lazy readme ([efc2b7a](https://github.com/paulcbetts/electron-rebuild/commit/efc2b7a))
* Fix up this-and-that ([c66722e](https://github.com/paulcbetts/electron-rebuild/commit/c66722e))
* Ignore stuff ([fde0b2b](https://github.com/paulcbetts/electron-rebuild/commit/fde0b2b))
* Implement rebuilding native modules ([0bb8bdc](https://github.com/paulcbetts/electron-rebuild/commit/0bb8bdc))
* Initial import ([e867fd7](https://github.com/paulcbetts/electron-rebuild/commit/e867fd7))
* Make spawn report extra information ([a73d842](https://github.com/paulcbetts/electron-rebuild/commit/a73d842))
* Port over installNodeHeaders ([4ec23b0](https://github.com/paulcbetts/electron-rebuild/commit/4ec23b0))
* Rig some more cli things ([3fb2fcb](https://github.com/paulcbetts/electron-rebuild/commit/3fb2fcb))
* stream-cp exhausts file handles, ditch it ([da3269d](https://github.com/paulcbetts/electron-rebuild/commit/da3269d))



