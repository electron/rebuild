import _ from './support';
import path from 'path';
import promisify from '../lib/promisify';
const fs = promisify(require('fs'));
const rimraf = promisify(require('rimraf'));
const cp = promisify(require('ncp').ncp);

import {installNodeHeaders, rebuildNativeModules} from '../lib/main.js';

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

describe('rebuildNativeModules', function() {
  this.timeout(60*1000);
  
  it('Rebuilds native modules against 0.25.2', async () => {
    const targetHeaderDir = path.join(__dirname, 'testheaders');
    const targetModulesDir = path.join(__dirname, 'test_modules');
    
    try {
      if (await fs.stat(targetHeaderDir)) {
        await rimraf(targetHeaderDir);
      }  
    } catch (e) { }
    
    await fs.mkdir(targetHeaderDir);
    
    try {
      if (await fs.stat(targetModulesDir)) {
        await rimraf(targetModulesDir);
      }
    } catch (e) { }
    
    console.log("Got here!");
    
    await installNodeHeaders('0.25.2', null, targetHeaderDir);
    let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', '0.25.2', 'common.gypi'));
    expect(canary).to.be.ok
    
    // Copy our own node_modules folder to a fixture so we don't trash it
    await cp(path.resolve(__dirname, '..', 'node_modules'), targetModulesDir);
    
    canary = await fs.stat(path.join(targetModulesDir, 'babel'));
    expect(canary).to.be.ok;
    
    await rebuildNativeModules('0.25.2', targetModulesDir, targetHeaderDir);
  });
});
