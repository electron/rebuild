import { EventEmitter } from 'node:events';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupTestModule, resetTestModule, TIMEOUT_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath } from './helpers/module-setup.js';
import { PrebuildInstall } from '../lib/module-type/prebuild-install.js';
import { Rebuilder, RebuilderOptions } from '../lib/rebuild.js';

describe('prebuild-install', () => {
  const modulePath = path.join(testModulePath, 'node_modules', 'farmhash');
  const rebuilderArgs: RebuilderOptions = {
    buildPath: testModulePath,
    electronVersion: '8.0.0',
    arch: process.arch,
    lifecycle: new EventEmitter()
  };

  describe('Node-API support', { timeout: TIMEOUT_IN_MILLISECONDS }, () => {
    beforeAll(async () => await resetTestModule(testModulePath), 30_000);
    afterAll(async () => await cleanupTestModule(testModulePath), 30_000);

    it('should find correct napi version and select napi args', async () => {
      const rebuilder = new Rebuilder(rebuilderArgs);
      const prebuildInstall = new PrebuildInstall(rebuilder, modulePath);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(prebuildInstall.nodeAPI.getNapiVersion((await prebuildInstall.getSupportedNapiVersions())!)).to.equal(3);
      expect(await prebuildInstall.getPrebuildInstallRuntimeArgs()).to.deep.equal([
        '--runtime=napi',
        `--target=3`,
      ]);
    });

    it('should not fail running prebuild-install', async () => {
      const rebuilder = new Rebuilder(rebuilderArgs);
      const prebuildInstall = new PrebuildInstall(rebuilder, modulePath);
      expect(await prebuildInstall.findPrebuiltModule()).to.equal(true);
    });

    it('should throw error with unsupported Electron version', async () => {
      const rebuilder = new Rebuilder({
        ...rebuilderArgs,
        electronVersion: '2.0.0',
      });
      const prebuildInstall = new PrebuildInstall(rebuilder, modulePath);
      expect(prebuildInstall.findPrebuiltModule()).rejects.toThrow("Native module 'farmhash' requires Node-API but Electron v2.0.0 does not support Node-API");
    });

    it('should download for target platform', async () => {
      let rebuilder = new Rebuilder(rebuilderArgs);
      let prebuild = new PrebuildInstall(rebuilder, modulePath);
      expect(await prebuild.findPrebuiltModule()).to.equal(true);

      let alternativePlatform: NodeJS.Platform;
      let arch = process.arch;

      if (process.platform === 'win32') {
        alternativePlatform = 'darwin';
      } else {
        alternativePlatform = 'win32';

        // farmhash has no prebuilt binaries for ARM64 Windows
        arch = 'x64';
      }

      rebuilder = new Rebuilder({ ...rebuilderArgs, platform: alternativePlatform, arch });
      prebuild = new PrebuildInstall(rebuilder, modulePath);
      expect(await prebuild.findPrebuiltModule()).to.equal(true);
    });
  });

  it('should find module fork', async () => {
    const rebuilder = new Rebuilder(rebuilderArgs);
    const prebuildInstall = new PrebuildInstall(rebuilder, path.join(import.meta.dirname, 'fixture', 'forked-module-test'));
    expect(await prebuildInstall.usesTool()).to.equal(true);
  });
});
