import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import { spawnPromise } from 'spawn-rx';
import { expect } from 'chai';
import { rebuild, RebuildOptions } from '../src/rebuild';

describe('rebuilder', () => {
  const testModulePath = path.resolve(os.tmpdir(), 'electron-forge-rebuild-test');
  const timeoutSeconds = process.platform === 'win32' ? 5 : 2;

  const resetTestModule = async () => {
    await fs.remove(testModulePath);
    await fs.mkdirs(testModulePath);
    await fs.copy(
      path.resolve(__dirname, '../test/fixture/native-app1/package.json'),
      path.resolve(testModulePath, 'package.json')
    );
    await spawnPromise('npm', ['install'], {
      cwd: testModulePath,
      stdio: 'ignore',
    });
  };

  const optionSets: {
    name: string,
    args: RebuildOptions | string[]
  }[] = [
    { args: [testModulePath, '2.0.17', process.arch], name: 'sequential args' },
    { args: {
      buildPath: testModulePath,
      electronVersion: '2.0.17',
      arch: process.arch
    }, name: 'options object' }
  ];
  for (const options of optionSets) {
    describe(`core behavior -- ${options.name}`, function() {
      this.timeout(timeoutSeconds * 60 * 1000);

      before(resetTestModule);

      before(async () => {
        let args: any = options.args;
        if (!Array.isArray(args)) {
          args = [args];
        }
        await (<any>rebuild)(...args);
      });

      it('should have rebuilt top level prod dependencies', async () => {
        const forgeMeta = path.resolve(testModulePath, 'node_modules', 'ref', 'build', 'Release', '.forge-meta');
        expect(await fs.pathExists(forgeMeta), 'ref build meta should exist').to.equal(true);
      });

      it('should not have rebuild top level prod dependencies that are prebuilt', async () => {
        const forgeMeta = path.resolve(testModulePath, 'node_modules', 'sodium-native', 'build', 'Release', '.forge-meta');
        expect(await fs.pathExists(forgeMeta), 'ref build meta should exist').to.equal(false);
      });

      it('should have rebuilt children of top level prod dependencies', async () => {
        const forgeMetaGoodNPM = path.resolve(testModulePath, 'node_modules', 'microtime', 'build', 'Release', '.forge-meta');
        const forgeMetaBadNPM = path.resolve(
          testModulePath, 'node_modules', 'benchr', 'node_modules', 'microtime', 'build', 'Release', '.forge-meta'
        );
        expect(await fs.pathExists(forgeMetaGoodNPM) || await fs.pathExists(forgeMetaBadNPM), 'microtime build meta should exist').to.equal(true);
      });

      it('should have rebuilt children of scoped top level prod dependencies', async () => {
        const forgeMeta = path.resolve(testModulePath, 'node_modules', '@newrelic/native-metrics', 'build', 'Release', '.forge-meta');
        expect(await fs.pathExists(forgeMeta), '@newrelic/native-metrics build meta should exist').to.equal(true);
      });

      it('should have rebuilt top level optional dependencies', async () => {
        const forgeMeta = path.resolve(testModulePath, 'node_modules', 'zipfile', 'build', 'Release', '.forge-meta');
        expect(await fs.pathExists(forgeMeta), 'zipfile build meta should exist').to.equal(true);
      });

      it('should not have rebuilt top level devDependencies', async () => {
        const forgeMeta = path.resolve(testModulePath, 'node_modules', 'ffi', 'build', 'Release', '.forge-meta');
        expect(await fs.pathExists(forgeMeta), 'ffi build meta should not exist').to.equal(false);
      });

      after(async () => {
        await fs.remove(testModulePath);
      });
    });
  }

  describe('force rebuild', function() {
    this.timeout(timeoutSeconds * 60 * 1000);

    before(resetTestModule);

    it('should skip the rebuild step when disabled', async () => {
      await rebuild(testModulePath, '2.0.17', process.arch);
      const rebuilder = rebuild(testModulePath, '2.0.17', process.arch, [], false);
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(4);
    });

    it('should rebuild all modules again when disabled but the electron ABI bumped', async () => {
      await rebuild(testModulePath, '2.0.17', process.arch);
      const rebuilder = rebuild(testModulePath, '1.6.0', process.arch, [], false);
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(0);
    });

    it('should rebuild all modules again when enabled', async () => {
      await rebuild(testModulePath, '2.0.17', process.arch);
      const rebuilder = rebuild(testModulePath, '2.0.17', process.arch, [], true);
      let skipped = 0;
      rebuilder.lifecycle.on('module-skip', () => {
        skipped++;
      });
      await rebuilder;
      expect(skipped).to.equal(0);
    });
  });

  describe('only rebuild', function() {
    this.timeout(2 * 60 * 1000);

    beforeEach(resetTestModule);
    afterEach(async () => await fs.remove(testModulePath));

    it('should rebuild only specified modules', async () => {
      const rebuilder = rebuild({
        buildPath: testModulePath,
        electronVersion: '2.0.17',
        arch: process.arch,
        onlyModules: ['ffi'],
        force: true
      });
      let built = 0;
      rebuilder.lifecycle.on('module-done', () => built++);
      await rebuilder;
      expect(built).to.equal(1);
    });

    it('should rebuild multiple specified modules via --only option', async () => {
      const rebuilder = rebuild({
        buildPath: testModulePath,
        electronVersion: '2.0.17',
        arch: process.arch,
        onlyModules: ['ffi', 'ref'],
        force: true
      });
      let built = 0;
      rebuilder.lifecycle.on('module-done', () => built++);
      await rebuilder;
      expect(built).to.equal(2);
    });
  });

  describe('debug rebuild', function() {
    this.timeout(10 * 60 * 1000);

    before(resetTestModule);
    afterEach(async () => await fs.remove(testModulePath));

    it('should have rebuilt ffi module in Debug mode', async () => {
      const rebuilder = rebuild({
        buildPath: testModulePath,
        electronVersion: '2.0.17',
        arch: process.arch,
        onlyModules: ['ffi'],
        force: true,
        debug: true
      });
      await rebuilder;
      const forgeMetaDebug = path.resolve(testModulePath, 'node_modules', 'ffi', 'build', 'Debug', '.forge-meta');
      expect(await fs.pathExists(forgeMetaDebug), 'ffi debug build meta should exist').to.equal(true);
      const forgeMetaRelease = path.resolve(testModulePath, 'node_modules', 'ffi', 'build', 'Release', '.forge-meta');
      expect(await fs.pathExists(forgeMetaRelease), 'ffi release build meta should not exist').to.equal(false);
    });
  });
});
