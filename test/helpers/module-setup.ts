import fs from 'fs-extra';
import path from 'path';
import { spawn } from '@malept/cross-spawn-promise';

const originalGypMSVSVersion: string | undefined = process.env.GYP_MSVS_VERSION;
const TIMEOUT_IN_MINUTES = process.platform === 'win32' ? 5 : 2;

export const MINUTES_IN_MILLISECONDS = 60 * 1000;
export const TIMEOUT_IN_MILLISECONDS = TIMEOUT_IN_MINUTES * MINUTES_IN_MILLISECONDS;

export function resetMSVSVersion(): void {
  if (originalGypMSVSVersion) {
    process.env.GYP_MSVS_VERSION = originalGypMSVSVersion;
  }
}

export async function resetTestModule(testModulePath: string, installModules = true): Promise<void> {
  await fs.remove(testModulePath);
  await fs.mkdir(testModulePath, { recursive: true });
  await fs.copyFile(
    path.resolve(__dirname, '../../test/fixture/native-app1/package.json'),
    path.resolve(testModulePath, 'package.json')
  );
  if (installModules) {
    await spawn('yarn', ['install'], { cwd: testModulePath });
  }
  resetMSVSVersion();
}

export async function cleanupTestModule(testModulePath: string): Promise<void> {
  await fs.remove(testModulePath);
  resetMSVSVersion();
}
