import _ from './support';
import path from 'path';
import promisify from '../lib/promisify';
const fs = promisify(require('fs'));
const rimraf = promisify(require('rimraf'));
const cp = promisify(require('ncp').ncp);

import {installNodeHeaders, rebuildNativeModules, shouldRebuildNativeModules} from '../lib/main.js';

describe('installNodeHeaders', function() {
  this.timeout(30*1000);

  it('installs node headers for 0.36.2', async () => {
    let targetHeaderDir = path.join(__dirname, 'testheaders');

    try {
      if (await fs.stat(targetHeaderDir)) {
        await rimraf(targetHeaderDir);
      }
    } catch (e) { }

    await fs.mkdir(targetHeaderDir);

    await installNodeHeaders('0.36.2', null, targetHeaderDir);
    let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', '0.36.2', 'common.gypi'));
    expect(canary).to.be.ok

    await rimraf(targetHeaderDir);
  });

  it('check for installed headers for 0.36.2', async () => {
    let targetHeaderDir = path.join(__dirname, 'testheaders');

    try {
      if (await fs.stat(targetHeaderDir)) {
        await rimraf(targetHeaderDir);
      }
    } catch (e) { }

    await fs.mkdir(targetHeaderDir);
    await fs.mkdir(path.join(targetHeaderDir, '.node-gyp'));
    await fs.mkdir(path.join(targetHeaderDir, '.node-gyp', '0.36.2'));
    const canary = path.join(targetHeaderDir, '.node-gyp', '0.36.2', 'common.gypi');
    await fs.close(await fs.open(canary, 'w'));

    await installNodeHeaders('0.36.2', null, targetHeaderDir);
    let shouldDie = true;
    try {
      await fs.stat(path.join(targetHeaderDir, '.node-gyp', '0.36.2', 'config.gypi'));
    } catch (err) {
      expect(err).to.exist;
      shouldDie = false;
    }
    expect(shouldDie).to.equal(false);

    await rimraf(targetHeaderDir);
  });
});

describe('rebuildNativeModules', function() {
  this.timeout(60*1000);

  const moduleVersionsToTest = ['0.34.0', '0.35.5'];

  for(let nativeModuleVersionToBuildAgainst of moduleVersionsToTest) {
    it(`Rebuilds native modules against ${nativeModuleVersionToBuildAgainst}`, async () => {
      const targetHeaderDir = path.join(__dirname, 'testheaders');
      const targetModulesDir = path.join(__dirname, 'node_modules');

      try {
        if (await fs.stat(targetHeaderDir)) {
          await rimraf(targetHeaderDir);
        }
      } catch (e) { }

      await fs.mkdir(targetHeaderDir);

      try {
        if (await fs.stat(targetModulesDir)) {
          await rimraf(targetModulesDir);
        }
      } catch (e) { }

      await installNodeHeaders(nativeModuleVersionToBuildAgainst, null, targetHeaderDir);
      let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', nativeModuleVersionToBuildAgainst, 'common.gypi'));
      expect(canary).to.be.ok

      // Copy our own node_modules folder to a fixture so we don't trash it
      await cp(path.resolve(__dirname, '..', 'node_modules'), targetModulesDir);

      canary = await fs.stat(path.join(targetModulesDir, 'babel'));
      expect(canary).to.be.ok;

      await rebuildNativeModules(nativeModuleVersionToBuildAgainst, path.resolve(targetModulesDir, '..'), null, targetHeaderDir);
      await rimraf(targetModulesDir);
      await rimraf(targetHeaderDir);
    });
  }
});

describe('shouldRebuildNativeModules', function() {
  this.timeout(60*1000);

  it('should always return true most of the time maybe', async () => {
    // Use the electron-prebuilt path
    let electronPath = require('electron-prebuilt');
    let result = await shouldRebuildNativeModules(electronPath);

    expect(result).to.be.ok;
  });
})
