import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import { spawnPromise } from 'spawn-rx';
import { expect } from 'chai';
import { rebuild, RebuildOptions } from '../src/rebuild';
import { getProjectRootPath } from '../src/search-module';

const projectRootPath = getProjectRootPath(process.cwd());

describe('rebuild for yarn workspace', function() {
  this.timeout(2 * 60 * 1000);
  const testModulePath = path.resolve(
    os.tmpdir(),
    'electron-forge-rebuild-test'
  );

  const resetTestModule = async (): Promise<void> => {
    await fs.remove(testModulePath);
    await fs.mkdirs(testModulePath);
    await fs.copy(path.resolve(__dirname, '../test/fixture/workspace-test/package.json'), path.resolve(testModulePath, 'package.json'));
    await fs.copy(
      path.resolve(__dirname, '../test/fixture/workspace-test/child-workspace'),
      path.resolve(testModulePath, 'child-workspace')
    );

    await spawnPromise('yarn', [], {
      cwd: testModulePath,
      stdio: 'ignore'
    });
  };

  const optionSets: {
    name: string;
    args: RebuildOptions | string[];
  }[] = [
    {
      args: {
        buildPath: path.resolve(testModulePath, 'child-workspace'),
        electronVersion: '2.0.17',
        arch: process.arch,
        projectRootPath
      },
      name: 'options object'
    }
  ];

  for (const options of optionSets) {
    describe(`core behavior -- ${options.name}`, function() {
      this.timeout(2 * 60 * 1000);

      before(resetTestModule);

      before(async () => {
        await rebuild(options.args as RebuildOptions);
      });

      it('should have rebuilt top level prod dependencies', async () => {
        const forgeMeta = path.resolve(
          testModulePath,
          'node_modules',
          'ref',
          'build',
          'Release',
          '.forge-meta'
        );
        expect(
          await fs.pathExists(forgeMeta),
          'ref build meta should exist'
        ).to.equal(true);
      });

      it('should not have rebuild top level prod dependencies that are prebuilt', async () => {
        const forgeMeta = path.resolve(
          testModulePath,
          'node_modules',
          'sodium-native',
          'build',
          'Release',
          '.forge-meta'
        );
        expect(
          await fs.pathExists(forgeMeta),
          'ref build meta should exist'
        ).to.equal(false);
      });

      it('should have rebuilt children of top level prod dependencies', async () => {
        const forgeMetaGoodNPM = path.resolve(
          testModulePath,
          'node_modules',
          'microtime',
          'build',
          'Release',
          '.forge-meta'
        );
        const forgeMetaBadNPM = path.resolve(
          testModulePath,
          'node_modules',
          'benchr',
          'node_modules',
          'microtime',
          'build',
          'Release',
          '.forge-meta'
        );
        expect(
          (await fs.pathExists(forgeMetaGoodNPM)) ||
            (await fs.pathExists(forgeMetaBadNPM)),
          'microtime build meta should exist'
        ).to.equal(true);
      });

      it('should have rebuilt children of scoped top level prod dependencies', async () => {
        const forgeMeta = path.resolve(
          testModulePath,
          'node_modules',
          '@newrelic/native-metrics',
          'build',
          'Release',
          '.forge-meta'
        );
        expect(
          await fs.pathExists(forgeMeta),
          '@newrelic/native-metrics build meta should exist'
        ).to.equal(true);
      });

      it('should have rebuilt top level optional dependencies', async () => {
        const forgeMeta = path.resolve(
          testModulePath,
          'node_modules',
          'zipfile',
          'build',
          'Release',
          '.forge-meta'
        );
        expect(
          await fs.pathExists(forgeMeta),
          'zipfile build meta should exist'
        ).to.equal(true);
      });

      it('should not have rebuilt top level devDependencies', async () => {
        const forgeMeta = path.resolve(
          testModulePath,
          'node_modules',
          'ffi',
          'build',
          'Release',
          '.forge-meta'
        );
        expect(
          await fs.pathExists(forgeMeta),
          'ffi build meta should not exist'
        ).to.equal(false);
      });

      after(async () => {
        await fs.remove(testModulePath);
      });
    });
  }
});
