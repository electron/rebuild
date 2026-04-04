import { EventEmitter } from 'node:events';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'graceful-fs';
import path from 'node:path';

import { cleanupTestModule, MINUTES_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath, resetMSVSVersion, resetTestModule, TIMEOUT_IN_MILLISECONDS } from './helpers/module-setup.js';
import { expectNativeModuleToBeRebuilt, expectNativeModuleToNotBeRebuilt } from './helpers/rebuild.js';
import { getExactElectronVersionSync } from './helpers/electron-version.js';
import { Rebuilder, rebuild } from '../lib/rebuild.js';
import { promisifiedGracefulFs } from '../lib/promisifiedGracefulFs.js';

const testElectronVersion = getExactElectronVersionSync();

describe('rebuilder', () => {

  describe('core behavior', { timeout: TIMEOUT_IN_MILLISECONDS }, () => {
    beforeAll(async () => {
      await resetTestModule(testModulePath);

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
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'windows-active-process');
    });

    it('should not download files in the module directory', async () => {
      const modulePath = path.resolve(testModulePath, 'node_modules/ref-napi');
      const fileNames = await promisifiedGracefulFs.readdir(modulePath);

      expect(fileNames).not.toContain(testElectronVersion);
    });

    afterAll(async () => {
      await cleanupTestModule(testModulePath);
    });
  });

  describe('force rebuild', { timeout: TIMEOUT_IN_MILLISECONDS }, () => {
    beforeAll(async () => await resetTestModule(testModulePath));
    afterAll(async () => await cleanupTestModule(testModulePath));
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
      expect(skipped).toBe(7);
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
      expect(skipped).toBe(0);
    });

    it('should rebuild all modules again when enabled', async () => {
      await rebuild({ buildPath, electronVersion, arch });
      resetMSVSVersion();
      const rebuilder = rebuild({ buildPath, electronVersion, arch, extraModules, force: true });
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).toBe(0);
    }, process.platform === 'darwin' ? 5 * MINUTES_IN_MILLISECONDS : TIMEOUT_IN_MILLISECONDS);
  });

  describe('ignore rebuild', { timeout: 2 * MINUTES_IN_MILLISECONDS }, () => {
    beforeAll(async () => await resetTestModule(testModulePath));
    afterAll(async () => await cleanupTestModule(testModulePath));
    afterEach(resetMSVSVersion);

    const buildPath = testModulePath;
    const electronVersion = testElectronVersion;
    const arch = process.arch;

    it('should rebuild all modules again when enabled', async () => {
      await rebuild({ buildPath, electronVersion, arch });
      resetMSVSVersion();
      const rebuilder = rebuild({ buildPath, electronVersion, arch, ignoreModules: ['native-hello-world'], force: true });
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).toBe(1);
    }, process.platform === 'win32' ? 5 * MINUTES_IN_MILLISECONDS : 2 * MINUTES_IN_MILLISECONDS);
  });

  describe('only rebuild', { timeout: 2 * MINUTES_IN_MILLISECONDS }, () => {
    beforeEach(async () => await resetTestModule(testModulePath));
    afterEach(async() => await cleanupTestModule(testModulePath));

    it('should rebuild only specified modules', async () => {
      const nativeModuleBinary = path.join(testModulePath, 'node_modules', 'native-hello-world', 'build', 'Release', 'hello_world.node');
      expect(fs.existsSync(nativeModuleBinary)).toBe(true);
      await fs.promises.rm(nativeModuleBinary, { recursive: true, force: true });
      expect(fs.existsSync(nativeModuleBinary)).toBe(false);
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
      expect(built).toBe(1);
      expect(fs.existsSync(nativeModuleBinary)).toBe(true);
    });

    it('should rebuild multiple specified modules via --only option', async () => {
      const rebuilder = rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch,
        onlyModules: ['windows-active-process', 'ref-napi', '@newrelic/native-metrics'],
        force: true
      });
      let built = 0;
      rebuilder.lifecycle.on('module-done', () => built++);
      await rebuilder;
      expect(built).toBe(3);
    });
  });

  describe('with extraModules', () => {
    it('should rebuild existing modules in extraModules despite them not being found during the module walk', async () => {
      const rebuilder = new Rebuilder({
        buildPath: path.join(import.meta.dirname, 'fixture', 'empty-project'),
        electronVersion: testElectronVersion,
        lifecycle: new EventEmitter(),
        extraModules: ['extra']
      });
      const modulesToRebuild = await rebuilder.modulesToRebuild();
      expect(modulesToRebuild).toHaveLength(1);
      expect(modulesToRebuild[0].endsWith('extra')).toBe(true);
    });
  });

  describe('debug rebuild', { timeout: 10 * MINUTES_IN_MILLISECONDS }, () => {
    beforeAll(async () => await resetTestModule(testModulePath));
    afterAll(async() => await cleanupTestModule(testModulePath));

    it('should have rebuilt farmhash module in Debug mode', async () => {
      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch,
        onlyModules: ['farmhash'],
        force: true,
        debug: true
      });
      await expectNativeModuleToBeRebuilt(testModulePath, 'farmhash', { buildType: 'Debug' });
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'farmhash');
    });
  });

  describe('useElectronClang rebuild', { timeout: 10 * MINUTES_IN_MILLISECONDS }, () => {
    beforeAll(async () => await resetTestModule(testModulePath));
    afterAll(async() => await cleanupTestModule(testModulePath));

    it('should have rebuilt farmhash module using clang mode', async () => {
      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch: process.arch,
        onlyModules: ['farmhash'],
        force: true,
        useElectronClang: true
      });
      await expectNativeModuleToBeRebuilt(testModulePath, 'farmhash');
    });
  });
});
