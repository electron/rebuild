import _ from './support';
import fs from 'fs';
import path from 'path';
import pkgMock from 'mock-npm-install';
import promisify from '../lib/promisify';
import { getPackageCachePath, getCachedBuildVersions } from '../lib/cache.js';
import { installNodeHeaders, rebuildNativeModules, shouldRebuildNativeModules } from '../lib/main.js';
import { mkdir, rmdir } from './utils/fileio.js';
import * as main from '../lib/main.js';
import spawn from '../lib/spawn.js';

const rimraf = promisify(require('rimraf'));
const cp = promisify(require('ncp').ncp);

const targetHeaderDir = path.join(__dirname, 'testheaders');
const targetModulesDir = path.join(__dirname, 'node_modules');
const mockPkgDir = path.resolve(targetModulesDir, 'build-test-1');
const mockPkgBuiltFile = path.resolve(mockPkgDir, 'build-test-file');
const cachePath = getPackageCachePath(targetModulesDir);
const moduleVersionToTest = '0.31.2';

const assertFileNotPresent = function(path) {
    const stat = fs.statSync(path);
    if (stat instanceof Error) {
        throw stat;
    }
}

const installMockPackage = function() {
    return pkgMock.install({
        nodeModulesDir: targetModulesDir,
        package: {
            name: 'build-test-1',
            scripts: { postinstall: `touch ${mockPkgBuiltFile}` } // npm build exec's
        }
    });
};

describe('quick mode', function() {
  this.timeout(30*1000);

    describe('rebuildNativeModules quickly with caching', function() {
        it(`should rebuild with cached versions`, async () => {
            try {
                await rmdir(targetModulesDir);
                await rmdir(targetHeaderDir);
                await mkdir(targetHeaderDir);
                await mkdir(targetModulesDir);
                let mockPkg1 = installMockPackage();

                await installNodeHeaders(moduleVersionToTest, null, targetHeaderDir);
                await main.rebuildNativeModules({
                    nodeVersion: moduleVersionToTest,
                    nodeModulesPath: targetModulesDir,
                    headersDir: targetHeaderDir,
                    quick: true
                });

                // assert that mock package build process run successfully
                expect(fs.statSync(`${mockPkgBuiltFile}`)).to.be.ok;

                // assert that rebuild-cache built successfully
                expect(fs.statSync(cachePath)).to.be.ok;
                const cachedContent = await getCachedBuildVersions(targetModulesDir);
                cachedContent[0].nodeVersion.should.equal(moduleVersionToTest);

                // assert that rebuild run again does not rebuild module after cached
                fs.unlinkSync(mockPkgBuiltFile);
                await main.rebuildNativeModules({
                    nodeVersion: moduleVersionToTest,
                    nodeModulesPath: targetModulesDir,
                    headersDir: targetHeaderDir,
                    quick: true
                });
                try {
                    assertFileNotPresent(mockPkgBuiltFile);
                } catch(err) {
                    if (err.code !== 'ENOENT') {
                        throw new Error('file was built when it was not supposed to');
                    }
                }

                // assert that module updates after node_modules/some-package folder touched
                const ctime_oldfolder = (fs.statSync(mockPkgBuiltFile)).ctime.toISOString();
                pkgMock.remove({ nodeModulesDir: targetModulesDir, name: mockPkg1.name });
                await (async () => {
                    // delay so ctime.toISOString varies observably
                    return new Promise((res) => { setTimeout(() => { res(); }, 2000); })
                })();
                mockPkg1 = installMockPackage();
                await main.rebuildNativeModules({
                    nodeVersion: moduleVersionToTest,
                    nodeModulesPath: targetModulesDir,
                    headersDir: targetHeaderDir,
                    quick: true
                });
                const ctime_newfolder = (fs.statSync(mockPkgBuiltFile)).ctime.toISOString();
                expect(ctime_oldfolder !== ctime_newfolder).to.be.ok;; // pkg rebuilt!

                await rmdir(targetModulesDir);
                await rmdir(targetHeaderDir);
            } catch(err) {
                return Promise.reject();
            }
        });

        it(`should ignore rebuilds on ignore request`, async () => {
          await rmdir(targetModulesDir);
          await rmdir(targetHeaderDir);
          await mkdir(targetHeaderDir);
          await mkdir(targetModulesDir);
          let mockPkg1 = installMockPackage();

          await installNodeHeaders(moduleVersionToTest, null, targetHeaderDir);
          await main.rebuildNativeModules({
              nodeVersion: moduleVersionToTest,
              nodeModulesPath: targetModulesDir,
              headersDir: targetHeaderDir,
              quick: true,
              ignore: 'build-test-1'
          });

          // assert that mock package build didn't build ignored package,
          // so built file should not exist
          try {
              fs.statSync(mockPkgBuiltFile);
          } catch (err) {
              if (err.code !== 'ENOENT') {
                  throw new Error('file was built when it was not supposed to');
              }
          }
        });
    });
});
