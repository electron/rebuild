import { expect } from 'chai';

import { getNodeArch, uname } from '../lib/arch';

// Copied from @electron/get
describe('uname()', function() {
  if (process.platform !== 'win32') {
    it('should return the correct arch for your system', function() {
      // assumes that the tests will always be run on an x64 system 😬
      expect(uname()).to.equal(process.arch === 'arm64' ? 'arm64' : 'x86_64');
    });
  }
});

// Based on getHostArch tests from @electron/get
describe('getNodeArch()', function() {
  it('should return process.arch on x64', function() {
    expect(getNodeArch('x64', {})).to.equal('x64');
  });

  it('should return process.arch on ia32', function() {
    expect(getNodeArch('ia32', {})).to.equal('ia32');
  });

  it('should return process.arch on arm64', function() {
    expect(getNodeArch('arm64', {})).to.equal('arm64');
  });

  it('should return process.arch on unknown arm', function() {
    expect(getNodeArch('arm', {})).to.equal('armv7l');
  });

  if (process.platform !== 'win32') {
    it('should return uname on arm 6', function() {
      expect(getNodeArch('arm', { arm_version: '6' })).to.equal(uname());
    });
  }

  it('should return armv7l on arm 7', function() {
    expect(getNodeArch('arm', { arm_version: '7' })).to.equal('armv7l');
  });
});
