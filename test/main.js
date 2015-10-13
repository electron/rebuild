import _ from './support';
import path from 'path';
import pkgMock from 'mock-npm-install';
import promisify from '../lib/promisify';
import { mkdir, rmdir } from './utils/fileio.js';
const fs = promisify(require('fs'));
const cp = promisify(require('ncp').ncp);

import {installNodeHeaders, rebuildNativeModules, shouldRebuildNativeModules} from '../lib/main.js';

describe('installNodeHeaders', function() {
  this.timeout(30*1000);

  it('installs node headers for 0.25.2', async () => {
    let targetHeaderDir = path.join(__dirname, 'testheaders');
    await rmdir(targetHeaderDir);
    await mkdir(targetHeaderDir);

    await installNodeHeaders('0.25.2', null, targetHeaderDir);
    let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', '0.25.2', 'common.gypi'));
    expect(canary).to.be.ok

    await rmdir(targetHeaderDir);
  });

  it('check for installed headers for 0.27.2', async () => {
    let targetHeaderDir = path.join(__dirname, 'testheaders');
    await rmdir(targetHeaderDir);
    await mkdir(targetHeaderDir);
    await mkdir(path.join(targetHeaderDir, '.node-gyp'));
    await mkdir(path.join(targetHeaderDir, '.node-gyp', '0.27.2'));
    const canary = path.join(targetHeaderDir, '.node-gyp', '0.27.2', 'common.gypi');
    await fs.close(await fs.open(canary, 'w'));

    await installNodeHeaders('0.27.2', null, targetHeaderDir);
    let shouldDie = true;
    try {
      await fs.stat(path.join(targetHeaderDir, '.node-gyp', '0.27.2', 'config.gypi'));
    } catch (err) {
      expect(err).to.exist;
      shouldDie = false;
    }
    expect(shouldDie).to.equal(false);

    await rmdir(targetHeaderDir);
  });
});

describe('rebuildNativeModules', function() {
  this.timeout(60*1000);

  const moduleVersionsToTest = ['0.22.0', '0.31.2'];

  for(let version of moduleVersionsToTest) {
    it(`Rebuilds native modules against ${version}`, async () => {
      try {
          const targetHeaderDir = path.join(__dirname, 'testheaders');
          const targetModulesDir = path.join(__dirname, 'node_modules');
          await rmdir(targetHeaderDir);
          await mkdir(targetHeaderDir);
          await rmdir(targetModulesDir);
          await mkdir(targetModulesDir);
          await installNodeHeaders(version, null, targetHeaderDir);
          let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', version, 'common.gypi'));
          expect(canary).to.be.ok

          rmdir('mock-pkg-1');
          const mockPkg = pkgMock.install({
              nodeModulesDir: targetModulesDir,
              package: {
                  name: 'mock-pkg-1',
                  scripts: { postinstall: `touch ${version}`} // npm build will run postinstall
              }
          });

          await rebuildNativeModules({
              nodeVersion: version,
              nodeModulesPath: targetModulesDir,
              headersDir: targetHeaderDir
          });


          let buildTestFile = await fs.stat(path.resolve(targetModulesDir, mockPkg.name, `${version}`));
          expect(buildTestFile).to.be.ok

          // clean up
          await rmdir(targetModulesDir);
          await rmdir(targetHeaderDir);
      } catch(err) {
          console.error(err.message);
          console.log(err);
      }
    });
  }
});

describe('shouldRebuildNativeModules', function() {
  this.timeout(60*1000);

  it('should always return true most of the time maybe', async () => {
    // Use the electron-prebuilt path
    let pathDotText = path.join(
      path.dirname(require.resolve('electron-prebuilt')),
      'path.txt');

    let electronPath = await fs.readFile(pathDotText, 'utf8');
    let result = await shouldRebuildNativeModules(electronPath);

    expect(result).to.be.ok;
  });
});
