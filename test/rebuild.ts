import EventEmitter = require('events');
import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawn } from '@malept/cross-spawn-promise';

import { expectNativeModuleToBeRebuilt, expectNativeModuleToNotBeRebuilt } from './helpers/rebuild';
import { getExactElectronVersionSync } from './helpers/electron-version';
import { rebuild, Rebuilder } from '../src/rebuild';
import { ModuleRebuilder } from '../src/module-rebuilder';

const MINUTES_IN_MILLISECONDS = 60 * 1000;
const testElectronVersion = getExactElectronVersionSync();

describe('rebuilder', () => {
  const testModulePath = path.resolve(os.tmpdir(), 'electron-rebuild-test');
  const timeoutMinutes = process.platform === 'win32' ? 5 : 2;
  const msvs_version: string | undefined = process.env.GYP_MSVS_VERSION;

  const resetMSVSVersion = () => {
    if (msvs_version) {
      process.env.GYP_MSVS_VERSION = msvs_version;
    }
  };
  const resetTestModule = async (): Promise<void> => {
    await fs.remove(testModulePath);
    await fs.mkdirs(testModulePath);
    await fs.copy(
      path.resolve(__dirname, '../test/fixture/native-app1/package.json'),
      path.resolve(testModulePath, 'package.json')
    );
    await spawn('npm', ['install'], { cwd: testModulePath });
    resetMSVSVersion();
  };

  const cleanupTestModule = async (): Promise<void> => {
    await fs.remove(testModulePath);
    resetMSVSVersion();
  }

  describe('core behavior', function() {
    this.timeout(timeoutMinutes * MINUTES_IN_MILLISECONDS);

    before(async () => {
      await resetTestModule();

      process.env.ELECTRON_REBUILD_TESTS = 'true';
      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch
      });
    });

    it('should have rebuilt top level prod dependencies', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, 'ref-napi');
    });

    it('should have rebuilt top level prod dependencies that are using prebuild', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, 'farmhash');
    });

    it('should have rebuilt children of top level prod dependencies', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, 'leveldown');
    });

    it('should have rebuilt children of scoped top level prod dependencies', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, '@newrelic/native-metrics');
    });

    it('should have rebuilt top level optional dependencies', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, 'bcrypt');
    });

    it('should not have rebuilt top level devDependencies', async () => {
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'ffi-napi');
    });

    it('should not download files in the module directory', async () => {
      const modulePath = path.resolve(testModulePath, 'node_modules/ref-napi');
      const fileNames = await fs.readdir(modulePath);

      expect(fileNames).to.not.contain(testElectronVersion);
    });

    after(async () => {
      delete process.env.ELECTRON_REBUILD_TESTS;
      await cleanupTestModule();
    });
  });

  describe('prebuild-install napi', function () {
    this.timeout(timeoutMinutes * MINUTES_IN_MILLISECONDS);

    before(resetTestModule);
    after(cleanupTestModule);
    afterEach(resetMSVSVersion);

    it('should find correct napi version and select napi args', async () => {
      const rebuilder = new Rebuilder({ buildPath: testModulePath, electronVersion: '8.0.0', arch: process.arch, lifecycle: new EventEmitter() });
      const modulePath = path.join(testModulePath, 'node_modules', 'farmhash');
      const modRebuilder = new ModuleRebuilder(rebuilder, modulePath);
      expect(await modRebuilder.getNapiVersion()).to.equal(3);
      expect(await modRebuilder.getPrebuildRuntimeArgs()).to.deep.equal([
        '--runtime=napi',
        `--target=3`,
      ])
    });

    it('should not fail running prebuild-install', async () => {
      process.env.ELECTRON_REBUILD_TESTS = 'true';

      const rebuilder = new Rebuilder({ buildPath: testModulePath, electronVersion: '8.0.0', arch: process.arch, lifecycle: new EventEmitter() });
      const modulePath = path.join(testModulePath, 'node_modules', 'farmhash');
      const modRebuilder = new ModuleRebuilder(rebuilder, modulePath);
      expect(await modRebuilder.rebuildPrebuildModule('')).to.equal(true);
    });

    it('should throw error with unsupported Electron version', async () => {
      try {
        await rebuild({ buildPath: testModulePath, electronVersion: '2.0.0', arch: process.arch });
        throw new Error('Expected error');
      } catch (error) {
        expect(error?.message).to.equal("Native module 'farmhash' requires Node-API but Electron v2.0.0 does not support Node-API");
      }
    });
  });


  describe('force rebuild', function() {
    this.timeout(timeoutMinutes * MINUTES_IN_MILLISECONDS);

    before(resetTestModule);
    after(cleanupTestModule);
    afterEach(resetMSVSVersion);

    const buildPath = testModulePath;
    const electronVersion = testElectronVersion;
    const arch = process.arch;
    const extraModules: string[] = [];

    it('should skip the rebuild step when disabled', async () => {
      await rebuild({ buildPath, electronVersion, arch });
      resetMSVSVersion();
      const rebuilder = rebuild({ buildPath, electronVersion, arch, extraModules, force: false });
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(6);
    });

    it('should rebuild all modules again when disabled but the electron ABI changed', async () => {
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

  describe('only rebuild', function() {
    this.timeout(2 * MINUTES_IN_MILLISECONDS);

    beforeEach(resetTestModule);
    afterEach(cleanupTestModule);

    it('should rebuild only specified modules', async () => {
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

    it('should rebuild multiple specified modules via --only option', async () => {
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
      expect(built).to.equal(2);
    });
  });

  describe('debug rebuild', function() {
    this.timeout(10 * MINUTES_IN_MILLISECONDS);

    before(resetTestModule);
    after(cleanupTestModule);

    it('should have rebuilt ffi-napi module in Debug mode', async () => {
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

    before(resetTestModule);
    after(cleanupTestModule);

    it('should have rebuilt ffi-napi module using clang mode', async () => {
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
