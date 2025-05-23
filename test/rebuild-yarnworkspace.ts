import path from 'node:path';

import { expectNativeModuleToBeRebuilt, expectNativeModuleToNotBeRebuilt } from './helpers/rebuild.js';
import { getExactElectronVersionSync } from './helpers/electron-version.js';
import { getProjectRootPath } from '../lib/search-module.js';
import { rebuild } from '../lib/rebuild.js';
import { TIMEOUT_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath, cleanupTestModule, resetTestModule } from './helpers/module-setup.js';

const testElectronVersion = getExactElectronVersionSync();

describe('rebuild for yarn workspace', function() {
  this.timeout(TIMEOUT_IN_MILLISECONDS);

  describe('core behavior', () => {
    before(async () => {
      await resetTestModule(testModulePath, true, 'workspace-test');
      const projectRootPath = await getProjectRootPath(path.join(testModulePath, 'workspace-test', 'child-workspace'));

      await rebuild({
        buildPath: path.resolve(testModulePath, 'child-workspace'),
        electronVersion: testElectronVersion,
        arch: process.arch,
        projectRootPath
      });
    });
    after(() => cleanupTestModule(testModulePath));

    it('should have rebuilt top level prod dependencies', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, 'snappy');
    });

    it('should not have rebuilt top level devDependencies', async () => {
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'sleep');
    });
  });
});
