import _ from './support';
import path from 'path';
import fs from 'fs';

import spawn from '../lib/spawn.js';

describe('spawn', () => {
  it('should work with ls', async () => {
    if (process.platform === 'win32') {
      return Promise.resolve(true).should.become(true);
    }
    
    let startInfo = {
      cmd: '/bin/ls',
      args: ['/']
    };
    
    let results = await spawn(startInfo);
    expect(results.code).to.equal(0);
  })  ;

  it('should fail when the path is completely bogus', async () => {
    if (process.platform === 'win32') {
      return Promise.resolve(true).should.become(true);
    }
    
    let startInfo = {
      cmd: '/bin/___nothere____ls',
      args: ['/']
    };
    
    let shouldDie = true;
    try {
      await spawn(startInfo);
    } catch (err) {
      shouldDie = false;
    }
    
    expect(shouldDie).to.equal(false);
  });
});
