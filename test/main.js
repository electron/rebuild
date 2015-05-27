import _ from './support';
import path from 'path';
import promisify from '../lib/promisify';
const fs = promisify(require('fs'));
const rimraf = promisify(require('rimraf'));
const cp = promisify(require('ncp').ncp);

import {installNodeHeaders, rebuildNativeModules, shouldRebuildNativeModules} from '../lib/main.js';

describe('installNodeHeaders', function() {
  this.timeout(30*1000);
  
  it('installs node headers for 0.25.2', async () => {
    let targetHeaderDir = path.join(__dirname, 'testheaders');

    try {
      if (await fs.stat(targetHeaderDir)) {
        await rimraf(targetHeaderDir);
      }  
    } catch (e) { }
    
    await fs.mkdir(targetHeaderDir);
    
    await installNodeHeaders('0.25.2', null, targetHeaderDir);
    let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', '0.25.2', 'common.gypi'));
    expect(canary).to.be.ok

    await rimraf(targetHeaderDir);
  });
});

describe('rebuildNativeModules', function() {
  this.timeout(60*1000);
  
  const nativeModuleVersionToBuildAgainst = '0.22.0';
  
  it(`Rebuilds native modules against ${nativeModuleVersionToBuildAgainst}`, async () => {
    const targetHeaderDir = path.join(__dirname, 'testheaders');
    const targetModulesDir = path.join(__dirname, 'node_modules');
    
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
    
    await installNodeHeaders(nativeModuleVersionToBuildAgainst, null, targetHeaderDir);
    let canary = await fs.stat(path.join(targetHeaderDir, '.node-gyp', nativeModuleVersionToBuildAgainst, 'common.gypi'));
    expect(canary).to.be.ok
    
    // Copy our own node_modules folder to a fixture so we don't trash it
    await cp(path.resolve(__dirname, '..', 'node_modules'), targetModulesDir);
    
    canary = await fs.stat(path.join(targetModulesDir, 'babel'));
    expect(canary).to.be.ok;
    
    await rebuildNativeModules(nativeModuleVersionToBuildAgainst, path.resolve(targetModulesDir, '..'), targetHeaderDir);
    await rimraf(targetModulesDir);
    await rimraf(targetHeaderDir);
  });
});

describe('shouldRebuildNativeModules', function() {
  this.timeout(60*1000);
  
  it('should always return true most of the time maybe', async () => {
    // Use the electron-prebuilt path
    let pathDotText = path.join(
      path.dirname(require.resolve('electron-prebuilt')),
      'path.txt');
      
    let electronPath = await fs.readFile(pathDotText, 'utf8');
    //console.log(`Electron Path: ${electronPath}`)
    let result = await shouldRebuildNativeModules(electronPath);
    
    expect(result).to.be.ok;
  });
})
