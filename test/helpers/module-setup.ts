import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { spawn } from '@malept/cross-spawn-promise';

const originalGypMSVSVersion: string | undefined = process.env.GYP_MSVS_VERSION;
const TIMEOUT_IN_MINUTES = process.platform === 'win32' ? 5 : 4;

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
  if (!await fs.pathExists(oneTimeModulePath)) {
    await fs.mkdir(oneTimeModulePath, { recursive: true });
    await fs.copy(path.resolve(__dirname, `../../test/fixture/${ fixtureName }`), oneTimeModulePath);
    if (installModules) {
      await spawn('yarn', ['install'], { cwd: oneTimeModulePath });
    }
  }
  await fs.remove(testModulePath);
  await fs.copy(oneTimeModulePath, testModulePath);
  resetMSVSVersion();
}

export async function cleanupTestModule(testModulePath: string): Promise<void> {
  await fs.rmdir(testModulePath, { recursive: true, maxRetries: 10 });
  resetMSVSVersion();
}

process.on('exit', () => {
  fs.removeSync(testModuleTmpPath);
});
