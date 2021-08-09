import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';

import { locateElectronModule } from '../src/electron-locator';

const baseFixtureDir = path.resolve(__dirname, 'fixture', 'electron-locator')

async function expectElectronCanBeFound(projectRootPath: string, startDir: string): Promise<void> {
  it('should return a valid path', async () => {
    const electronPath = await locateElectronModule(projectRootPath, startDir);
    expect(electronPath).to.be.a('string');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(await fs.pathExists(electronPath!)).to.be.equal(true);
  });
}

describe('locateElectronModule', () => {
  describe('when electron is not installed', () => {
    const electronDir = path.resolve(__dirname, '..', 'node_modules', 'electron');

    before(async () => {
      await fs.rename(electronDir, `${electronDir}-moved`);
    });

    it('should return null when electron is not installed', async () => {
      const fixtureDir = path.join(baseFixtureDir, 'not-installed');
      expect(await locateElectronModule(fixtureDir, fixtureDir)).to.be.equal(null);
    });

    after(async () => {
      await fs.rename(`${electronDir}-moved`, electronDir);
    });
  });

  describe('using require.resolve() in the current project to search', () => {
    const fixtureDir = path.join(baseFixtureDir, 'not-installed');
    expectElectronCanBeFound(fixtureDir, fixtureDir);
  });

  describe('with electron-prebuilt-compile installed', () => {
    const fixtureDir = path.join(baseFixtureDir, 'prebuilt-compile');
    expectElectronCanBeFound(fixtureDir, fixtureDir);
  });

  describe('with electron installed', () => {
    const fixtureDir = path.join(baseFixtureDir, 'single');
    expectElectronCanBeFound(fixtureDir, fixtureDir);

    describe('in a workspace', () => {
      const fixtureDir = path.join(baseFixtureDir, 'workspace');
      expectElectronCanBeFound(fixtureDir, path.join(fixtureDir, 'packages', 'descendant'));
    });
  });
});
