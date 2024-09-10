import { EventEmitter } from 'events';
import { expect } from 'chai';

import { cleanupTestModule, resetTestModule, TEST_MODULE_PATH as testModulePath } from './helpers/module-setup';
import { NodeGyp } from '../lib/module-type/node-gyp/node-gyp';
import { Rebuilder } from '../lib/rebuild';

describe('node-gyp', () => {
  describe('buildArgs', () => {

    before(async () => await resetTestModule(testModulePath, false));
    after(async () => await cleanupTestModule(testModulePath));

    function nodeGypArgsForElectronVersion(electronVersion: string): Promise<string[]> {
      const rebuilder = new Rebuilder({
        buildPath: testModulePath,
        electronVersion: electronVersion,
        lifecycle: new EventEmitter()
      });
      const nodeGyp = new NodeGyp(rebuilder, testModulePath);
      return nodeGyp.buildArgs([]);
    }

    context('sufficiently old Electron versions which lack a bundled config.gypi', () => {
      it('adds --force-process-config for < 14', async () => {
        const args = await nodeGypArgsForElectronVersion('12.0.0');
        expect(args).to.include('--force-process-config');
      });

      it('adds --force-process-config for between 14.0.0 and < 14.2.0', async () => {
        const args = await nodeGypArgsForElectronVersion('14.1.0');
        expect(args).to.include('--force-process-config');
      });

      it('adds --force-process-config for versions between 15.0.0 and < 15.3.0', async () => {
        const args = await nodeGypArgsForElectronVersion('15.2.0');
        expect(args).to.include('--force-process-config');
      });
    });

    context('for sufficiently new Electron versions', () => {
      it('does not add --force-process-config for ^14.2.0', async () => {
        const args = await nodeGypArgsForElectronVersion('14.2.0');
        expect(args).to.not.include('--force-process-config');
      });

      it('does not add --force-process-config for ^15.3.0', async () => {
        const args = await nodeGypArgsForElectronVersion('15.3.0');
        expect(args).to.not.include('--force-process-config');
      });

      it('does not add --force-process-config for >= 16.0.0', async () => {
        const args = await nodeGypArgsForElectronVersion('16.0.0-alpha.1');
        expect(args).to.not.include('--force-process-config');
      });

      it('does not add --force-process-config for >= 16.0.0', async () => {
        const args = await nodeGypArgsForElectronVersion('30.0.0');
        expect(args).to.not.include('--force-process-config');
      });
    });
  });
});
