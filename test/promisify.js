import _ from './support';
import fs from 'fs';
import path from 'path';
import promisify from '../lib/promisify.js';

describe('promisify', () => {
  it('should handle fs.stat', async () => {
    const stat = promisify(fs.stat);
    
    let result = await stat(path.join(__dirname, 'main.js'));
    expect(result).to.exist;
    expect(result.size > 1).to.be.ok;
    
    let shouldDie = true;
    try {
      await stat('__WEFJWOEFW_WE_FWEF_EFWJEIFJWEF');
    } catch (err) {
      expect(err).to.exist;
      shouldDie = false;
    }
    
    expect(shouldDie).to.equal(false);
  });
  
  it('should map all of fs', async () => {
    const promiseFs = promisify(fs);
    
    let result = await promiseFs.stat(path.join(__dirname, 'main.js'));
    expect(result).to.exist;
    expect(result.size > 1).to.be.ok;
  });
});
