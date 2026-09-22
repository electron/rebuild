import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ModuleWalker } from '../lib/module-walker.js';

let root: string;

async function writePackage(relativePath: string, dependencies: Record<string, string> = {}) {
  const directory = path.join(root, relativePath);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ dependencies }));
  return fs.realpath(directory);
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'electron-rebuild-walker-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('module-walker', () => {
  it('walks the children of every installed version of a dependency', async () => {
    await writePackage('', { first: '1', second: '1' });
    await writePackage('node_modules/first', { shared: '1' });
    await writePackage('node_modules/second', { shared: '2' });
    await writePackage('node_modules/first/node_modules/shared', { 'native-first': '1' });
    await writePackage('node_modules/second/node_modules/shared', { 'native-second': '1' });
    const first = await writePackage(
      'node_modules/first/node_modules/shared/node_modules/native-first',
    );
    const second = await writePackage(
      'node_modules/second/node_modules/shared/node_modules/native-second',
    );
    const walker = new ModuleWalker(root, root, ['prod'], new Set(), null);

    await walker.walkModules();
    await walker.findAllModulesIn(path.join(root, 'node_modules'));

    expect(walker.modulesToRebuild).toContain(first);
    expect(walker.modulesToRebuild).toContain(second);
  });

  it('terminates for cyclic dependencies without skipping their other children', async () => {
    await writePackage('', { first: '1' });
    await writePackage('node_modules/first', { second: '1' });
    await writePackage('node_modules/second', { first: '1', native: '1' });
    const native = await writePackage('node_modules/native');
    const walker = new ModuleWalker(root, root, ['prod'], new Set(), null);

    await walker.walkModules();
    await walker.findAllModulesIn(path.join(root, 'node_modules'));

    expect(walker.modulesToRebuild).toContain(native);
    expect(new Set(walker.modulesToRebuild).size).toBe(walker.modulesToRebuild.length);
  });
});
