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

export interface ResetTestModuleOptions {
  packageManager?: string
  fixturePath?: string
}
export async function resetTestModule(testModulePath: string, options: ResetTestModuleOptions = {}): Promise<void> {
  const {
    packageManager = 'npm',
    fixturePath = path.resolve(__dirname, '../../test/fixture/native-app1')
  } = options;
  await fs.remove(testModulePath);
  await fs.mkdir(testModulePath, { recursive: true });
  await fs.copy(
    path.resolve(fixturePath),
    path.resolve(testModulePath),
  );
  await spawn(packageManager, ['install'], { cwd: testModulePath });
  resetMSVSVersion();
}

export async function cleanupTestModule(testModulePath: string): Promise<void> {
  await fs.remove(testModulePath);
  resetMSVSVersion();
}
