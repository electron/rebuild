import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { EventEmitter } from 'events';
import os from 'os';
import path from 'path';

import { cleanupTestModule, resetTestModule, TIMEOUT_IN_MILLISECONDS } from './helpers/module-setup';
import { PrebuildInstall } from '../src/module-type/prebuild-install';
import { Rebuilder } from '../src/rebuild';

chai.use(chaiAsPromised);

const testModulePath = path.resolve(os.tmpdir(), 'electron-rebuild-test');

describe('prebuild-install', () => {
  const modulePath = path.join(testModulePath, 'node_modules', 'farmhash');
  const rebuilderArgs = {
    buildPath: testModulePath,
    electronVersion: '8.0.0',
    arch: process.arch,
    lifecycle: new EventEmitter()
  };

  describe('Node-API support', function() {
    this.timeout(TIMEOUT_IN_MILLISECONDS);

    before(async () => await resetTestModule(testModulePath));
    after(async () => await cleanupTestModule(testModulePath));

    it('should find correct napi version and select napi args', async () => {
      const rebuilder = new Rebuilder(rebuilderArgs);
      const prebuildInstall = new PrebuildInstall(rebuilder, modulePath);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(prebuildInstall.nodeAPI.getNapiVersion((await prebuildInstall.getSupportedNapiVersions())!)).to.equal(3);
      expect(await prebuildInstall.getPrebuildInstallRuntimeArgs()).to.deep.equal([
        '--runtime=napi',
        `--target=3`,
      ])
    });

    it('should not fail running prebuild-install', async () => {
      const rebuilder = new Rebuilder(rebuilderArgs);
      const prebuildInstall = new PrebuildInstall(rebuilder, modulePath);
      expect(await prebuildInstall.findPrebuiltModule()).to.equal(true);
    });

    it('should throw error with unsupported Electron version', async () => {
      const rebuilder = new Rebuilder({
        ...rebuilderArgs,
        electronVersion: '2.0.0',
      });
      const prebuildInstall = new PrebuildInstall(rebuilder, modulePath);
      expect(prebuildInstall.findPrebuiltModule()).to.eventually.be.rejectedWith("Native module 'farmhash' requires Node-API but Electron v2.0.0 does not support Node-API");
    });
  });
});
