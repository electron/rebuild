import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { EventEmitter } from 'events';
import path from 'path';

import { cleanupTestModule, resetTestModule, TIMEOUT_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath } from './helpers/module-setup';
import { NodePreGyp } from '../lib/module-type/node-pre-gyp';
import { Rebuilder } from '../lib/rebuild';

chai.use(chaiAsPromised);

describe('node-pre-gyp', function () {
  this.timeout(TIMEOUT_IN_MILLISECONDS);

  const modulePath = path.join(testModulePath, 'node_modules', 'sqlite3');
  const rebuilderArgs = {
    buildPath: testModulePath,
    electronVersion: '8.0.0',
    arch: process.arch,
    lifecycle: new EventEmitter()
  };

  before(async () => await resetTestModule(testModulePath));
  after(async () => await cleanupTestModule(testModulePath));

  describe('Node-API support', function() {
    it('should find correct napi version and select napi args', async () => {
      const rebuilder = new Rebuilder(rebuilderArgs);
      const nodePreGyp = new NodePreGyp(rebuilder, modulePath);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(nodePreGyp.nodeAPI.getNapiVersion((await nodePreGyp.getSupportedNapiVersions())!)).to.equal(3);
      expect(await nodePreGyp.getNodePreGypRuntimeArgs()).to.deep.equal([]);
    });

    it('should not fail running node-pre-gyp', async () => {
      const rebuilder = new Rebuilder(rebuilderArgs);
      const nodePreGyp = new NodePreGyp(rebuilder, modulePath);
      expect(await nodePreGyp.findPrebuiltModule()).to.equal(true);
    });

    it('should throw error with unsupported Electron version', async () => {
      const rebuilder = new Rebuilder({
        ...rebuilderArgs,
        electronVersion: '2.0.0',
      });
      const nodePreGyp = new NodePreGyp(rebuilder, modulePath);
      expect(nodePreGyp.findPrebuiltModule()).to.eventually.be.rejectedWith("Native module 'sqlite3' requires Node-API but Electron v2.0.0 does not support Node-API");
    });
  });

  it('should redownload the module if the architecture changes', async () => {
    let rebuilder = new Rebuilder(rebuilderArgs);
    let nodePreGyp = new NodePreGyp(rebuilder, modulePath);
    expect(await nodePreGyp.findPrebuiltModule()).to.equal(true);

    let alternativeArch: string;
    if (process.platform === 'win32') {
      alternativeArch = rebuilderArgs.arch === 'x64' ? 'ia32' : 'x64';
    } else {
      alternativeArch = rebuilderArgs.arch === 'arm64' ? 'x64' : 'arm64';
    }

    rebuilder = new Rebuilder({ ...rebuilderArgs, arch: alternativeArch });
    nodePreGyp = new NodePreGyp(rebuilder, modulePath);
    expect(await nodePreGyp.findPrebuiltModule()).to.equal(true);
  });
});
