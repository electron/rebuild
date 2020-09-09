import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawn } from '@malept/cross-spawn-promise';

import { expectNativeModuleToBeRebuilt, expectNativeModuleToNotBeRebuilt } from './helpers/rebuild';
import { getExactElectronVersionSync } from './helpers/electron-version';
import { getProjectRootPath } from '../src/search-module';
import { rebuild } from '../src/rebuild';

const testElectronVersion = getExactElectronVersionSync();

describe('rebuild for yarn workspace', function() {
  this.timeout(2 * 60 * 1000);
  const testModulePath = path.resolve(os.tmpdir(), 'electron-rebuild-test');
  const msvs_version: string | undefined = process.env.GYP_MSVS_VERSION;

  describe('core behavior', () => {
    before(async () => {
      await fs.remove(testModulePath);
      await fs.copy(path.resolve(__dirname, 'fixture/workspace-test'), testModulePath);

      await spawn('yarn', [], { cwd: testModulePath });
      if (msvs_version) {
        process.env.GYP_MSVS_VERSION = msvs_version;
      }

      const projectRootPath = await getProjectRootPath(path.join(testModulePath, 'workspace-test', 'child-workspace'));

      await rebuild({
        buildPath: path.resolve(testModulePath, 'child-workspace'),
        electronVersion: testElectronVersion,
        arch: process.arch,
        projectRootPath
      });
    });

    it('should have rebuilt top level prod dependencies', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, 'snappy');
    });

    it('should not have rebuilt top level devDependencies', async () => {
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'sleep');
    });

    after(async () => {
      await fs.remove(testModulePath);
      if (msvs_version) {
        process.env.GYP_MSVS_VERSION = msvs_version;
      }
    });
  });
});
