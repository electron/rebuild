import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';

import { cleanupTestModule, MINUTES_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath, resetMSVSVersion, resetTestModule, TIMEOUT_IN_MILLISECONDS } from './helpers/module-setup';
import { expectNativeModuleToBeRebuilt, expectNativeModuleToNotBeRebuilt } from './helpers/rebuild';
import { getExactElectronVersionSync } from './helpers/electron-version';
import { rebuild } from '../lib/rebuild';

const testElectronVersion = getExactElectronVersionSync();

describe('rebuilder', function() {

  describe('core behavior', function() {
    this.timeout(TIMEOUT_IN_MILLISECONDS);

    before(async function() {
      await resetTestModule(testModulePath);

      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch
      });
    });

    it('should have rebuilt top level prod dependencies', async function() {
      await expectNativeModuleToBeRebuilt(testModulePath, 'ref-napi');
    });

    it('should have rebuilt top level prod dependencies that are using prebuild', async function() {
      await expectNativeModuleToBeRebuilt(testModulePath, 'farmhash');
    });

    it('should have rebuilt children of top level prod dependencies', async function() {
      await expectNativeModuleToBeRebuilt(testModulePath, 'leveldown');
    });

    it('should have rebuilt children of scoped top level prod dependencies', async function() {
      await expectNativeModuleToBeRebuilt(testModulePath, '@newrelic/native-metrics');
    });

    it('should have rebuilt top level optional dependencies', async function() {
      await expectNativeModuleToBeRebuilt(testModulePath, 'bcrypt');
    });

    it('should not have rebuilt top level devDependencies', async function() {
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'ffi-napi');
    });

    it('should not download files in the module directory', async function() {
      const modulePath = path.resolve(testModulePath, 'node_modules/ref-napi');
      const fileNames = await fs.readdir(modulePath);

      expect(fileNames).to.not.contain(testElectronVersion);
    });

    after(async function() {
      await cleanupTestModule(testModulePath);
    });
  });

  describe('force rebuild', function() {
    this.timeout(TIMEOUT_IN_MILLISECONDS);

    before(async function() { return await resetTestModule(testModulePath); });

    after(async function() { return await cleanupTestModule(testModulePath); });

    afterEach(resetMSVSVersion);

    const buildPath = testModulePath;
    const electronVersion = testElectronVersion;
    const arch = process.arch;
    const extraModules: string[] = [];

    it('should skip the rebuild step when disabled', async function() {
      await rebuild({ buildPath, electronVersion, arch });
      resetMSVSVersion();
      const rebuilder = rebuild({ buildPath, electronVersion, arch, extraModules, force: false });
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(8);
    });

    it('should rebuild all modules again when disabled but the electron ABI changed', async function() {
      await rebuild({ buildPath, electronVersion, arch });
      resetMSVSVersion();
      const rebuilder = rebuild({ buildPath, electronVersion: '3.0.0', arch, extraModules, force: false });
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(0);
    });

    it('should rebuild all modules again when enabled', async function() {
      if (process.platform === 'darwin') {
        this.timeout(5 * MINUTES_IN_MILLISECONDS);
      }
      await rebuild({ buildPath, electronVersion, arch });
      resetMSVSVersion();
      const rebuilder = rebuild({ buildPath, electronVersion, arch, extraModules, force: true });
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(0);
    });
  });

  describe('ignore rebuild', function() {
    this.timeout(2 * MINUTES_IN_MILLISECONDS);

    before(async function() { return await resetTestModule(testModulePath); });

    after(async function() { return await cleanupTestModule(testModulePath); });

    afterEach(resetMSVSVersion);

    const buildPath = testModulePath;
    const electronVersion = testElectronVersion;
    const arch = process.arch;

    it('should rebuild all modules again when enabled', async function() {
      if (process.platform === 'win32') {
        this.timeout(5 * MINUTES_IN_MILLISECONDS);
      }
      await rebuild({ buildPath, electronVersion, arch });
      resetMSVSVersion();
      const rebuilder = rebuild({ buildPath, electronVersion, arch, ignoreModules: ['native-hello-world'], force: true });
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(1);
    });
  });

  describe('only rebuild', function() {
    this.timeout(2 * MINUTES_IN_MILLISECONDS);

    beforeEach(async function() { return await resetTestModule(testModulePath); });

    afterEach(async function() { return await cleanupTestModule(testModulePath); });

    it('should rebuild only specified modules', async function() {
      const nativeModuleBinary = path.join(testModulePath, 'node_modules', 'native-hello-world', 'build', 'Release', 'hello_world.node');
      expect(await fs.pathExists(nativeModuleBinary)).to.be.true;
      await fs.remove(nativeModuleBinary);
      expect(await fs.pathExists(nativeModuleBinary)).to.be.false;
      const rebuilder = rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch,
        onlyModules: ['native-hello-world'],
        force: true
      });
      let built = 0;
      rebuilder.lifecycle.on('module-done', () => built++);
      await rebuilder;
      expect(built).to.equal(1);
      expect(await fs.pathExists(nativeModuleBinary)).to.be.true;
    });

    it('should rebuild multiple specified modules via --only option', async function() {
      const rebuilder = rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch,
        onlyModules: ['ffi-napi', 'ref-napi'], // TODO: check to see if there's a bug with scoped modules
        force: true
      });
      let built = 0;
      rebuilder.lifecycle.on('module-done', () => built++);
      await rebuilder;
      expect(built).to.equal(3);
    });
  });

  describe('debug rebuild', function() {
    this.timeout(10 * MINUTES_IN_MILLISECONDS);

    before(async function() { return await resetTestModule(testModulePath); });

    after(async function() { return await cleanupTestModule(testModulePath); });

    it('should have rebuilt ffi-napi module in Debug mode', async function() {
      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch,
        onlyModules: ['ffi-napi'],
        force: true,
        debug: true
      });
      await expectNativeModuleToBeRebuilt(testModulePath, 'ffi-napi', { buildType: 'Debug' });
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'ffi-napi');
    });
  });

  describe('useElectronClang rebuild', function() {
    this.timeout(10 * MINUTES_IN_MILLISECONDS);

    before(async function() { return await resetTestModule(testModulePath); });

    after(async function() { return await cleanupTestModule(testModulePath); });

    it('should have rebuilt ffi-napi module using clang mode', async function() {
      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch,
        onlyModules: ['ffi-napi'],
        force: true,
        useElectronClang: true
      });
      await expectNativeModuleToBeRebuilt(testModulePath, 'ffi-napi');
    });
  });
});
