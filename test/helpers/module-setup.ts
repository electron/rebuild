import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import debug from 'debug';
import { spawn } from '@malept/cross-spawn-promise';

const d = debug('electron-rebuild');

const originalGypMSVSVersion: string | undefined = process.env.GYP_MSVS_VERSION;
const TIMEOUT_IN_MINUTES = process.platform === 'win32' ? 5 : 2;

export const MINUTES_IN_MILLISECONDS = 60 * 1000;
export const TIMEOUT_IN_MILLISECONDS = TIMEOUT_IN_MINUTES * MINUTES_IN_MILLISECONDS;

export const TEST_MODULE_PATH = path.resolve(os.tmpdir(), 'electron-rebuild-test');

export function resetMSVSVersion(): void {
  if (originalGypMSVSVersion) {
    process.env.GYP_MSVS_VERSION = originalGypMSVSVersion;
  }
}

const testModuleTmpPath = fs.mkdtempSync(path.resolve(os.tmpdir(), 'e-r-test-module-'));

export async function resetTestModule(testModulePath: string, installModules = true, fixtureName = 'native-app1'): Promise<void> {
  // The forked node-gyp worker (`fork()` in lib/module-type/node-gyp/) needs
  // a clean Node — it doesn't want vitest's worker flags (--require, --conditions
  // development, --experimental-import-meta-resolve, etc.). Clear execArgv so
  // none of those propagate to the worker child.
  process.execArgv = [];

  const oneTimeModulePath = path.resolve(testModuleTmpPath, `${crypto.createHash('SHA1').update(testModulePath).digest('hex')}-${fixtureName}-${installModules}`);
  if (!fs.existsSync(oneTimeModulePath)) {
    d(`creating test module '${fixtureName}' in ${oneTimeModulePath}`);
    await fs.promises.mkdir(oneTimeModulePath, { recursive: true });
    await fs.promises.cp(path.resolve(import.meta.dirname, `../fixture/${ fixtureName }`), oneTimeModulePath, { recursive: true, force: true });
    await fs.promises.cp(path.resolve(import.meta.dirname, `../../.yarn`), path.join(oneTimeModulePath, '.yarn'), { recursive: true, force: true });
    if (installModules) {
      d(`installModules is ${installModules}, installing dependencies in ${oneTimeModulePath}`);
      await spawn('yarn', ['install', '--immutable'], { cwd: oneTimeModulePath });
    }
  }
  await fs.promises.rm(testModulePath, { recursive: true, force: true });
  await fs.promises.cp(oneTimeModulePath, testModulePath, { recursive: true, force: true });
  d(`contents of ${testModulePath}:`, fs.readdirSync(testModulePath));
  resetMSVSVersion();
}

export async function cleanupTestModule(testModulePath: string): Promise<void> {
  await fs.promises.rm(testModulePath, { recursive: true, force: true, maxRetries: 10 });
  resetMSVSVersion();
}

process.on('exit', () => {
  fs.rmSync(testModuleTmpPath, { recursive: true, force: true });
});
