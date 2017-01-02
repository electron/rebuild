import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { spawnPromise } from 'spawn-rx';

import { locateElectronPrebuilt } from '../lib/electron-locater';

const packageCommand = (command, packageName) =>
  spawnPromise('npm', [command, packageName], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'ignore',
  });

const install = packageCommand.bind(this, 'install');
const uninstall = packageCommand.bind(this, 'uninstall');

const testElectronCanBeFound = () => {
  it('should return a valid path', () => {
    const electronPath = locateElectronPrebuilt();
    expect(electronPath).to.be.a('string');
    expect(fs.existsSync(electronPath)).to.be.equal(true);
  });
};

describe('locateElectronPrebuilt', () => {
  before(() => uninstall('electron-prebuilt'));

  it('should return null when electron is not installed', () => {
    expect(locateElectronPrebuilt()).to.be.equal(null);
  });

  describe('with electron-prebuilt installed', () => {
    before(() => install('electron-prebuilt'));

    testElectronCanBeFound();

    after(() => uninstall('electron-prebuilt'));
  });

  describe('with electron installed', () => {
    before(() => install('electron'));

    testElectronCanBeFound();

    after(() => uninstall('electron'));
  });

  after(() => install('electron-prebuilt'));
});
