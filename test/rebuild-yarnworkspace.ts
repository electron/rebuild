import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawnPromise } from 'spawn-rx';

import { expectNativeModuleToBeRebuilt, expectNativeModuleToNotBeRebuilt } from './helpers/rebuild';
import { rebuild } from '../src/rebuild';
import { getProjectRootPath } from '../src/search-module';

describe('rebuild for yarn workspace', function() {
  this.timeout(2 * 60 * 1000);
  const testModulePath = path.resolve(os.tmpdir(), 'electron-rebuild-test');

  describe('core behavior', () => {
    before(async () => {
      await fs.remove(testModulePath);
      await fs.copy(path.resolve(__dirname, 'fixture/workspace-test'), testModulePath);

      await spawnPromise('yarn', [], {
        cwd: testModulePath,
        stdio: 'ignore'
      });

      const projectRootPath = await getProjectRootPath(path.join(testModulePath, 'workspace-test', 'child-workspace'));

      await rebuild({
        buildPath: path.resolve(testModulePath, 'child-workspace'),
        electronVersion: '5.0.13',
        arch: process.arch,
        projectRootPath
      });
    });

    it('should have rebuilt top level prod dependencies', async () => {
      await expectNativeModuleToBeRebuilt(testModulePath, 'ref-napi');
    });

    it('should not have rebuilt top level devDependencies', async () => {
      await expectNativeModuleToNotBeRebuilt(testModulePath, 'ffi-napi');
    });

    after(async () => {
      await fs.remove(testModulePath);
    });
  });
});
