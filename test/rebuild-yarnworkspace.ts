import * as path from 'path';

import { expectNativeModuleToBeRebuilt, expectNativeModuleToNotBeRebuilt } from './helpers/rebuild';
import { getExactElectronVersionSync } from './helpers/electron-version';
import { getProjectRootPath } from '../lib/search-module';
import { rebuild } from '../lib/rebuild';
import { TIMEOUT_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath, cleanupTestModule, resetTestModule } from './helpers/module-setup';

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
