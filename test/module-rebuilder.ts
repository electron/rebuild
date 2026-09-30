import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ModuleRebuilder } from '../lib/module-rebuilder.js';
import { Rebuilder, RebuilderOptions } from '../lib/rebuild.js';

const ABI = '89';
const ARCH = 'x64';

describe('ModuleRebuilder .forge-meta', () => {
  let tmpDir: string;
  let modulePath: string;

  const createRebuilder = (args: Partial<RebuilderOptions> = {}): Rebuilder =>
    new Rebuilder({
      buildPath: tmpDir,
      electronVersion: '13.0.0',
      forceABI: Number(ABI),
      arch: ARCH,
      platform: 'linux',
      lifecycle: new EventEmitter(),
      ...args,
    });

  const readMeta = (): string =>
    fs.readFileSync(path.join(modulePath, 'build', 'Release', '.forge-meta'), 'utf8');

  // Runs the rebuilder against the fixture module and records the lifecycle events it emits.
  const rebuildModule = async (args: Partial<RebuilderOptions> = {}): Promise<string[]> => {
    const rebuilder = createRebuilder(args);
    const events: string[] = [];
    rebuilder.lifecycle.on('module-done', () => events.push('module-done'));
    rebuilder.lifecycle.on('module-skip', () => events.push('module-skip'));
    await rebuilder.rebuildModuleAt(modulePath);
    return events;
  };

  beforeEach(async () => {
    // A prebuildify-powered module with prebuilt binaries for both Linux and macOS, so that
    // rebuilding for either platform is resolved locally without compiling or downloading.
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'e-r-forge-meta-'));
    modulePath = path.join(tmpDir, 'node_modules', 'native-module');
    for (const platform of ['linux', 'darwin']) {
      const prebuildDir = path.join(modulePath, 'prebuilds', `${platform}-${ARCH}`);
      await fs.promises.mkdir(prebuildDir, { recursive: true });
      await fs.promises.writeFile(path.join(prebuildDir, `electron.abi${ABI}.node`), '');
    }
    await fs.promises.writeFile(
      path.join(modulePath, 'package.json'),
      JSON.stringify({ name: 'native-module', devDependencies: { prebuildify: '*' } }),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('includes the target platform in the metadata', () => {
    const moduleRebuilder = new ModuleRebuilder(
      createRebuilder({ platform: 'darwin' }),
      modulePath,
    );
    expect(moduleRebuilder.metaData).toBe(`darwin--${ARCH}--${ABI}`);
  });

  it('skips a module already built for the same platform, arch and ABI', async () => {
    expect(await rebuildModule()).toEqual(['module-done']);
    expect(readMeta()).toBe(`linux--${ARCH}--${ABI}`);

    expect(await rebuildModule()).toEqual(['module-done', 'module-skip']);
  });

  it('does not skip a module that was built for a different platform', async () => {
    expect(await rebuildModule({ platform: 'linux' })).toEqual(['module-done']);

    expect(await rebuildModule({ platform: 'darwin' })).toEqual(['module-done']);
    expect(readMeta()).toBe(`darwin--${ARCH}--${ABI}`);
  });

  it('does not skip a module whose metadata predates the platform being recorded', async () => {
    const moduleRebuilder = new ModuleRebuilder(createRebuilder(), modulePath);
    await fs.promises.mkdir(path.dirname(moduleRebuilder.metaPath), { recursive: true });
    await fs.promises.writeFile(moduleRebuilder.metaPath, `${ARCH}--${ABI}`);

    expect(await moduleRebuilder.alreadyBuiltByRebuild()).toBe(false);
  });
});
