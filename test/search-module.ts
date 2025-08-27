import fs from 'graceful-fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getProjectRootPath } from '../lib/search-module.js';
import { promisifiedGracefulFs } from '../lib/promisifiedGracefulFs.js';

let baseDir: string;

async function createTempDir(): Promise<void> {
  baseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'electron-rebuild-test-'));
}

async function removeTempDir(): Promise<void> {
  await fs.promises.rm(baseDir, { recursive: true, force: true });
}

describe('search-module', () => {
  describe('getProjectRootPath', () => {
    describe('multi-level workspace', () => {
      for (const lockFile of ['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml']) {
        describe(lockFile, () => {
          beforeAll(async () => {
            await createTempDir();
            await fs.promises.cp(path.resolve(import.meta.dirname, 'fixture', 'multi-level-workspace'), baseDir, { recursive: true, force: true });

            const lockfilePath = path.join(baseDir, lockFile);

            if(!fs.existsSync(lockfilePath)) {
              await fs.promises.mkdir(baseDir, { recursive: true });
              await promisifiedGracefulFs.writeFile(lockfilePath, Buffer.from([]), {});
            }
          });

          it('finds the folder with the lockfile', async () => {
            const packageDir = path.join(baseDir, 'packages', 'bar');
            expect(await getProjectRootPath(packageDir)).to.equal(baseDir);
          });

          afterAll(removeTempDir);
        });
      }
    });

    describe('no workspace', () => {
      beforeAll(createTempDir);

      it('returns the input directory if a lockfile cannot be found', async () => {
        expect(await getProjectRootPath(baseDir)).to.equal(baseDir);
      });

      afterAll(removeTempDir);
    });
  });
});
