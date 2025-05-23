import fs from 'graceful-fs';
import path from 'node:path';

import { expect } from 'chai';
import { rebuild } from '../lib/rebuild.js';
import { getExactElectronVersionSync } from './helpers/electron-version.js';
import { TIMEOUT_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath, cleanupTestModule, resetTestModule } from './helpers/module-setup.js';
import { expectNativeModuleToBeRebuilt } from './helpers/rebuild.js';
import detectLibc from 'detect-libc';

const testElectronVersion = getExactElectronVersionSync();

describe('rebuild with napi_build_versions in binary config', async function () {
  this.timeout(TIMEOUT_IN_MILLISECONDS);

  const napiBuildVersion = 6;
  const napiBuildVersionSpecificPath = (arch: string, libc: string) => path.resolve(testModulePath, `node_modules/sqlite3/lib/binding/napi-v${ napiBuildVersion }-${ process.platform }-${ libc }-${ arch }/node_sqlite3.node`);

  before(async () => {
    await resetTestModule(testModulePath, true, 'napi-build-version');
    // Forcing `msvs_version` needed in order for `arm64` `win32` binary to be built
    process.env.GYP_MSVS_VERSION = process.env.GYP_MSVS_VERSION ?? "2019";
  });
  after(() => cleanupTestModule(testModulePath));

  // https://github.com/electron/rebuild/issues/554
  const archs = ['x64', 'arm64'];
  for (const arch of archs) {
    it(`${ arch } arch should have rebuilt binary with 'napi_build_versions' array and 'libc' provided`, async () => {
      const libc = await detectLibc.family() || 'unknown';
      const binaryPath = napiBuildVersionSpecificPath(arch, libc);

      await fs.promises.rm(binaryPath, { recursive: true, force: true });
      expect(fs.existsSync(binaryPath)).to.be.false;

      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch,
        buildFromSource: true, // need to skip node-pre-gyp prebuilt binary
      });

      await expectNativeModuleToBeRebuilt(testModulePath, 'sqlite3');
      expect(fs.existsSync(binaryPath)).to.be.true;
    });
  }

});
