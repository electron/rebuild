import { describe, expect, it } from 'vitest';

import { getNodeArch, uname } from '../lib/arch.js';

// Copied from @electron/get
describe.runIf(process.platform !== 'win32')('uname()', () => {
  it('should return the correct arch for your system', () => {
    // assumes that the tests will always be run on an x64 system 😬
    expect(uname()).toBe(process.arch === 'arm64' ? 'arm64' : 'x86_64');
  });
});

// Based on getHostArch tests from @electron/get
describe('getNodeArch()', () => {
  it('should return process.arch on x64', () => {
    expect(getNodeArch('x64', {})).toBe('x64');
  });

  it('should return process.arch on ia32', () => {
    expect(getNodeArch('ia32', {})).toBe('ia32');
  });

  it('should return process.arch on arm64', () => {
    expect(getNodeArch('arm64', {})).toBe('arm64');
  });

  it('should return process.arch on unknown arm', () => {
    expect(getNodeArch('arm', {})).toBe('armv7l');
  });

  it.runIf(process.platform !== 'win32')('should return uname on arm 6', () => {
    expect(getNodeArch('arm', { arm_version: '6' })).toBe(uname());
  });

  it('should return armv7l on arm 7', () => {
    expect(getNodeArch('arm', { arm_version: '7' })).toBe('armv7l');
  });
});
