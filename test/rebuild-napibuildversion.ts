import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import { expect } from 'chai';
import { rebuild } from '../lib/rebuild';
import { getExactElectronVersionSync } from './helpers/electron-version';
import { TIMEOUT_IN_MILLISECONDS, cleanupTestModule, resetTestModule } from './helpers/module-setup';
import { expectNativeModuleToBeRebuilt } from './helpers/rebuild';

const testElectronVersion = getExactElectronVersionSync();

describe('rebuild with napi_build_versions in binary config', async function () {
  this.timeout(TIMEOUT_IN_MILLISECONDS);
  const testModulePath = path.resolve(os.tmpdir(), 'electron-rebuild-test');

  const napiBuildVersion = 6;
  const napiBuildVersionSpecificPath = (arch: string, libc: string) => path.resolve(testModulePath, `node_modules/sqlite3/lib/binding/napi-v${ napiBuildVersion }-${ process.platform }-${ libc }-${ arch }/node_sqlite3.node`);

  before(async () => {
    await resetTestModule(testModulePath, true, 'napi-build-version')
    // Forcing `msvs_version` needed in order for `arm64` `win32` binary to be built
    process.env.GYP_MSVS_VERSION = "2019"
  });
  after(() => cleanupTestModule(testModulePath));

  // https://github.com/electron/rebuild/issues/554
  const archs = ['x64', 'arm64']
  for (const arch of archs) {
    it(`${ arch } arch should have rebuilt bianry with 'napi_build_versions' array and 'libc' provided`, async () => {
      // Should use detect-libc but for some reason it causes the test suite to not even run
      const libc = process.platform === 'darwin' ? 'unknown' : 'glibc'
      
      const binaryPath = napiBuildVersionSpecificPath(arch, libc)
      if (await fs.pathExists(binaryPath)) {
        fs.removeSync(binaryPath)
      }
      expect(await fs.pathExists(binaryPath)).to.be.false;

      await rebuild({
        buildPath: testModulePath,
        electronVersion: testElectronVersion,
        arch
      });
      
      await expectNativeModuleToBeRebuilt(testModulePath, 'sqlite3');
      expect(await fs.pathExists(binaryPath)).to.be.true;
    });
  }

});
