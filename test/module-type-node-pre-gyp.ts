import { EventEmitter } from 'node:events';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupTestModule, resetTestModule, TIMEOUT_IN_MILLISECONDS, TEST_MODULE_PATH as testModulePath } from './helpers/module-setup.js';
import { NodePreGyp } from '../lib/module-type/node-pre-gyp.js';
import { Rebuilder, RebuilderOptions } from '../lib/rebuild.js';

describe('node-pre-gyp', { timeout: TIMEOUT_IN_MILLISECONDS }, () => {
  const modulePath = path.join(testModulePath, 'node_modules', 'sqlite3');
  const rebuilderArgs: RebuilderOptions = {
    buildPath: testModulePath,
    electronVersion: '8.0.0',
    arch: process.arch,
    lifecycle: new EventEmitter()
  };

  beforeAll(async () => await resetTestModule(testModulePath), TIMEOUT_IN_MILLISECONDS);
  afterAll(async () => await cleanupTestModule(testModulePath), TIMEOUT_IN_MILLISECONDS);

  describe('Node-API support', () => {
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
      await expect(nodePreGyp.findPrebuiltModule()).rejects.toBe("Native module 'sqlite3' requires Node-API but Electron v2.0.0 does not support Node-API");
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

  it('should download for target platform', async () => {
    let rebuilder = new Rebuilder(rebuilderArgs);
    let nodePreGyp = new NodePreGyp(rebuilder, modulePath);
    expect(await nodePreGyp.findPrebuiltModule()).to.equal(true);

    let alternativePlatform: NodeJS.Platform;
    if (process.platform === 'win32') {
      alternativePlatform = 'darwin';
    } else {
      alternativePlatform = 'win32';
    }

    rebuilder = new Rebuilder({ ...rebuilderArgs, platform: alternativePlatform });
    nodePreGyp = new NodePreGyp(rebuilder, modulePath);
    expect(await nodePreGyp.findPrebuiltModule()).to.equal(true);
  });

  it('should find module fork', async () => {
    const rebuilder = new Rebuilder(rebuilderArgs);
    const nodePreGyp = new NodePreGyp(rebuilder, path.join(import.meta.dirname, 'fixture', 'forked-module-test'));
    expect(await nodePreGyp.usesTool()).to.equal(true);
  });
});
