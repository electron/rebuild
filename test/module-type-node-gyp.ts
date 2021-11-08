import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';

import { cleanupTestModule, resetTestModule, TIMEOUT_IN_MILLISECONDS } from './helpers/module-setup';
import { NodeGyp } from '../src/module-type/node-gyp';
import { Rebuilder } from '../src/rebuild';

describe('node-gyp', function() {
  const testModulePath = path.resolve(os.tmpdir(), 'electron-rebuild-test');
  const oldElectronVersion = '12.0.0';
  const newElectronVersion = '16.0.0';

  this.timeout(TIMEOUT_IN_MILLISECONDS);

  before(async () => await resetTestModule(testModulePath));
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

  it('adds --force-process-config for old Electron versions', async () => {
    const args = await nodeGypArgsForElectronVersion(oldElectronVersion);
    expect(args).to.include('--force-process-config');
  });

  it('does not add --force-process-config for new Electron versions', async () => {
    const args = await nodeGypArgsForElectronVersion(newElectronVersion);
    expect(args).to.not.include('--force-process-config');
  });
});
