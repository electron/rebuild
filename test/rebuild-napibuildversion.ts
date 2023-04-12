import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import { expect } from 'chai';
import { rebuild } from '../src/rebuild';
import { getExactElectronVersionSync } from './helpers/electron-version';
import { TIMEOUT_IN_MILLISECONDS, cleanupTestModule, resetTestModule } from './helpers/module-setup';
import { expectNativeModuleToBeRebuilt } from './helpers/rebuild';

const testElectronVersion = getExactElectronVersionSync();

describe('rebuild with napi_build_versions in binary config', async function () {
  this.timeout(TIMEOUT_IN_MILLISECONDS);
  const testModulePath = path.resolve(os.tmpdir(), 'electron-rebuild-test');
  const napiBuildVersion = 6;
  const napiBuildVersionSpecificPath = (arch: string) => path.resolve(testModulePath, `node_modules/sqlite3/lib/binding/napi-v${ napiBuildVersion }-${ process.platform }-unknown-${ arch }/node_sqlite3.node`);

  before(() => resetTestModule(testModulePath, true, 'napi-build-version'));
  after(() => cleanupTestModule(testModulePath));

  // https://github.com/electron/rebuild/issues/554
  const archs = ['x64', 'arm64']
  for (const arch of archs) {
    it(`${ arch } arch should have rebuilt bianry with napi_build_versions array provided`, async () => {
      const binaryPath = napiBuildVersionSpecificPath(arch)
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

      const dirname = path.dirname(binaryPath)
      console.log(dirname);
      fs.readdirSync(dirname).forEach(file => {
        console.log(file);
      });

      expect(await fs.pathExists(binaryPath)).to.be.true;
      fs.removeSync(binaryPath);
    });
  }

});
