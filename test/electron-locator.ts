import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { locateElectronModule } from '../lib/electron-locator.js';

const baseFixtureDir = path.resolve(import.meta.dirname, 'fixture', 'electron-locator');

function expectElectronCanBeFound(projectRootPath: string, startDir: string): void {
  it('should return a valid path', async () => {
    const electronPath = await locateElectronModule(projectRootPath, startDir);
    expect(electronPath).toBeTypeOf('string');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(fs.existsSync(electronPath!)).toBe(true);
  });
}

describe('locateElectronModule', () => {
  describe('when electron is not installed', () => {
    const electronDir = path.resolve(import.meta.dirname, '..', 'node_modules', 'electron');
    const movedDir = `${electronDir}-moved`;

    beforeAll(async () => {
      // Restore from a possibly-leaked rename from a prior crashed test run.
      if (fs.existsSync(movedDir) && !fs.existsSync(electronDir)) {
        await fs.promises.rename(movedDir, electronDir);
      }
      await fs.promises.rename(electronDir, movedDir);
    });

    it('should return null when electron is not installed', async () => {
      const fixtureDir = path.join(baseFixtureDir, 'not-installed');
      expect(await locateElectronModule(fixtureDir, fixtureDir)).toBe(null);
    });

    afterAll(async () => {
      await fs.promises.rename(movedDir, electronDir);
    });
  });

  describe('using import.meta.resolve() in the current project to search', () => {
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
