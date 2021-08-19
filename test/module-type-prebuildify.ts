import { expect } from 'chai';
import path from 'path';

import {
  determineNativePrebuildArch,
  determineNativePrebuildExtension,
  findPrebuildifyModule,
  getNodeArch,
  isPrebuildifyNativeModule,
  uname
} from '../src/module-type/prebuildify';

// Copied from @electron/get
describe('uname()', () => {
  if (process.platform !== 'win32') {
    it('should return the correct arch for your system', () => {
      // assumes that the tests will always be run on an x64 system 😬
      expect(uname()).to.equal('x86_64');
    });
  }
});

// Based on getHostArch tests from @electron/get
describe('getNodeArch()', () => {
  it('should return process.arch on x64', () => {
    expect(getNodeArch('x64', {})).to.equal('x64');
  });

  it('should return process.arch on ia32', () => {
    expect(getNodeArch('ia32', {})).to.equal('ia32');
  });

  it('should return process.arch on arm64', () => {
    expect(getNodeArch('arm64', {})).to.equal('arm64');
  });

  it('should return process.arch on unknown arm', () => {
    expect(getNodeArch('arm', {})).to.equal('armv7l');
  });

  if (process.platform !== 'win32') {
    it('should return uname on arm 6', () => {
      expect(getNodeArch('arm', { arm_version: '6' })).to.equal(uname());
    });
  }

  it('should return armv7l on arm 7', () => {
    expect(getNodeArch('arm', { arm_version: '7' })).to.equal('armv7l');
  });
});

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

describe('isPrebuildifyNativeModule', () => {
  it('succeeds if prebuildify exists in devDependencies', () => {
    expect(isPrebuildifyNativeModule({ prebuildify: 'validvalue' })).to.equal(true);
  });

  it('fails if prebuildify does not exist in devDependencies', () => {
    expect(isPrebuildifyNativeModule({})).to.equal(false);
  });
});

describe('findPrebuildifyModule', () => {
  const fixtureBaseDir = path.join(__dirname, 'fixture', 'prebuildify');

  const platform = 'linux';
  const arch = 'x64';
  const electronVersion = '13.0.0';
  const abi = '89';
  const devDependencies = { prebuildify: '^1.0.0' };
  describe('not a prebuildify native module', () => {
    it('should not find a prebuilt native module', async () => {
      expect(await findPrebuildifyModule('modulePath', platform, arch, electronVersion, abi, {})).to.equal(false);
    });
  });
  describe('with no prebuilds directory', () => {
    it('should not find a prebuilt native module', async () => {
      const noPrebuildsDir = __dirname;
      expect(await findPrebuildifyModule(noPrebuildsDir, platform, arch, electronVersion, abi, devDependencies)).to.equal(false);
    });
  });

  describe('with prebuilt module for the given ABI', async () => {
    it('should find a prebuilt native module for x64/electron', async () => {
      const fixtureDir = path.join(fixtureBaseDir, 'abi');
      expect(await findPrebuildifyModule(fixtureDir, platform, arch, electronVersion, abi, devDependencies)).to.equal(true);
    });
  });

  describe('with prebuilt Node-API module', async () => {
    it('should find a prebuilt native module for x64/node', async () => {
      const fixtureDir = path.join(fixtureBaseDir, 'napi');
      expect(await findPrebuildifyModule(fixtureDir, platform, arch, electronVersion, abi, devDependencies)).to.equal(true);
    });

    it('should find a prebuilt native module for armv7l/node', async () => {
      const fixtureDir = path.join(fixtureBaseDir, 'napi');
      expect(await findPrebuildifyModule(fixtureDir, platform, 'armv7l', electronVersion, abi, devDependencies)).to.equal(true);
    });

    it('should find a prebuilt native module for arm64/electron', async () => {
      const fixtureDir = path.join(fixtureBaseDir, 'napi');
      expect(await findPrebuildifyModule(fixtureDir, platform, 'arm64', electronVersion, abi, devDependencies)).to.equal(true);
    });
  });

  describe('when it cannot find a prebuilt module', async () => {
    it('should not find a prebuilt native module', async () => {
      const fixtureDir = path.join(fixtureBaseDir, 'not-found');
      expect(await findPrebuildifyModule(fixtureDir, platform, arch, electronVersion, abi, devDependencies)).to.equal(false);
    });
  });
});
