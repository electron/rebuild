import debug from 'debug';
import crypto from 'node:crypto';
import fs from 'graceful-fs';
import os from 'node:os';
import path from 'node:path';
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
  const oneTimeModulePath = path.resolve(testModuleTmpPath, `${crypto.createHash('SHA1').update(testModulePath).digest('hex')}-${fixtureName}-${installModules}`);
  if (!fs.existsSync(oneTimeModulePath)) {
    d(`creating test module '%s' in %s`, fixtureName, oneTimeModulePath);
    await fs.promises.mkdir(oneTimeModulePath, { recursive: true });
    await fs.promises.cp(path.resolve(import.meta.dirname, `../../test/fixture/${ fixtureName }`), oneTimeModulePath, { recursive: true, force: true });
    if (installModules) {
      await spawn('yarn', ['install'], { cwd: oneTimeModulePath });
    }
  }
  await fs.promises.rm(testModulePath, { recursive: true, force: true });
  await fs.promises.cp(oneTimeModulePath, testModulePath, { recursive: true, force: true });
  resetMSVSVersion();
}

export async function cleanupTestModule(testModulePath: string): Promise<void> {
  await fs.promises.rm(testModulePath, { recursive: true, force: true, maxRetries: 10 });
  resetMSVSVersion();
}

process.on('exit', () => {
  fs.rmSync(testModuleTmpPath, { recursive: true, force: true });
});
