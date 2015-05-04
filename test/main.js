import _ from './support';
import path from 'path';
import promisify from '../lib/promisify';
const fs = promisify(require('fs'));
const rimraf = promisify(require('rimraf'));

import {installNodeHeaders} from '../lib/main.js';

describe('installNodeHeaders', function() {
  this.timeout(30*1000);
  
  it('installs node headers for 0.25.2', async () => {
    let targetHeaderDir = path.join(__dirname, 'testheaders');
    
    if (await fs.stat(targetHeaderDir)) {
      await rimraf(targetHeaderDir);
    }
    
    await fs.mkdir(targetHeaderDir);
    
    await installNodeHeaders('0.25.2', null, targetHeaderDir);
    let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', '0.25.2', 'common.gypi'));
    expect(canary).to.be.ok
  });
});
