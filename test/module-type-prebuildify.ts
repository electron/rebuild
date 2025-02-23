import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import path from 'node:path';

import {
  determineNativePrebuildArch,
  determineNativePrebuildExtension,
  Prebuildify
} from '../lib/module-type/prebuildify';
import { Rebuilder, RebuilderOptions } from '../lib/rebuild';

describe('determineNativePrebuildArch', () => {
  it('returns arm if passed in armv7l', () => {
    expect(determineNativePrebuildArch('armv7l')).to.equal('arm');
  });

  it('returns the input arch if the input is not armv7l', () => {
    expect(determineNativePrebuildArch('x64')).to.equal('x64');
  });
});

describe('determineNativePrebuildExtension', () => {
  it('returns armv8 suffix for an arm64 arch', () => {
    expect(determineNativePrebuildExtension('arm64')).to.equal('armv8.node');
  });

  it('returns armv7 suffix for an armv7l arch', () => {
    expect(determineNativePrebuildExtension('armv7l')).to.equal('armv7.node');
  });

  it('returns no suffix for non-ARM arches', () => {
    expect(determineNativePrebuildExtension('x64')).to.equal('node');
  });
});

describe('prebuildify', () => {
  const fixtureBaseDir = path.join(__dirname, 'fixture', 'prebuildify');
  const rebuilderArgs = {
    buildPath: 'nonexistent-path',
    electronVersion: '13.0.0',
    arch: 'x64',
    lifecycle: new EventEmitter()
  };

  const createRebuilder = (args: Partial<RebuilderOptions> = {}): Rebuilder => {
    const rebuilder = new Rebuilder({ ...rebuilderArgs, ...args});
    rebuilder.platform = 'linux';
    return rebuilder;
  };

  describe('usesTool', () => {
    it('succeeds if prebuildify exists in devDependencies', async () => {
      const rebuilder = createRebuilder();
      const prebuildify = new Prebuildify(rebuilder, path.join(fixtureBaseDir, 'has-prebuildify-devdep'));
      expect(await prebuildify.usesTool()).to.equal(true);
    });

    it('fails if prebuildify does not exist in devDependencies', async () => {
      const rebuilder = createRebuilder();
      const prebuildify = new Prebuildify(rebuilder, path.join(fixtureBaseDir, 'no-prebuildify-devdep'));
      expect(await prebuildify.usesTool()).to.equal(false);
    });
  });

  describe('findPrebuiltModule', () => {
    describe('with no prebuilds directory', () => {
      it('should not find a prebuilt native module', async () => {
        const noPrebuildsDir = __dirname;
        const rebuilder = createRebuilder();
        const prebuildify = new Prebuildify(rebuilder, noPrebuildsDir);
        expect(await prebuildify.findPrebuiltModule()).to.equal(false);
      });
    });

    describe('with prebuilt module for the given ABI', async () => {
      it('should find a prebuilt native module for x64/electron', async () => {
        const fixtureDir = path.join(fixtureBaseDir, 'abi');
        const rebuilder = createRebuilder();
        const prebuildify = new Prebuildify(rebuilder, fixtureDir);
        expect(await prebuildify.findPrebuiltModule()).to.equal(true);
      });
    });

    describe('with prebuilt Node-API module', async () => {
      it('should find a prebuilt native module for x64/node', async () => {
        const fixtureDir = path.join(fixtureBaseDir, 'napi');
        const rebuilder = createRebuilder();
        const prebuildify = new Prebuildify(rebuilder, fixtureDir);
        expect(await prebuildify.findPrebuiltModule()).to.equal(true);
      });

      it('should find a prebuilt native module for armv7l/node', async () => {
        const fixtureDir = path.join(fixtureBaseDir, 'napi');
        const rebuilder = createRebuilder({ arch: 'armv7l' });
        const prebuildify = new Prebuildify(rebuilder, fixtureDir);
        expect(await prebuildify.findPrebuiltModule()).to.equal(true);
      });

      it('should find a prebuilt native module for arm64/electron', async () => {
        const fixtureDir = path.join(fixtureBaseDir, 'napi');
        const rebuilder = createRebuilder({ arch: 'arm64' });
        const prebuildify = new Prebuildify(rebuilder, fixtureDir);
        expect(await prebuildify.findPrebuiltModule()).to.equal(true);
      });
    });

    describe('when it cannot find a prebuilt module', async () => {
      it('should not find a prebuilt native module', async () => {
        const fixtureDir = path.join(fixtureBaseDir, 'not-found');
        const rebuilder = createRebuilder();
        const prebuildify = new Prebuildify(rebuilder, fixtureDir);
        expect(await prebuildify.findPrebuiltModule()).to.equal(false);
      });
    });
  });
  
  describe('cross-platform downloads', async () => {
    it('should download for target platform', async () => {
      const fixtureDir = path.join(fixtureBaseDir, 'napi');
      let rebuilder = createRebuilder();
      let prebuildify = new Prebuildify(rebuilder, fixtureDir);
      expect(await prebuildify.findPrebuiltModule()).to.equal(true);
  
      let alternativePlatform: NodeJS.Platform;
      if (process.platform === 'win32') {
        alternativePlatform = 'darwin';
      } else {
        alternativePlatform = 'win32';
      }
  
      rebuilder = createRebuilder({ platform: alternativePlatform });
      prebuildify = new Prebuildify(rebuilder, fixtureDir);
      expect(await prebuildify.findPrebuiltModule()).to.equal(true);
    });
  });

  it('should find module fork', async () => {
    const rebuilder = createRebuilder();
    const prebuildify = new Prebuildify(rebuilder, path.join(__dirname, 'fixture', 'forked-module-test'));
    expect(await prebuildify.usesTool()).to.equal(true);
  });
});
