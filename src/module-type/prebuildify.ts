import { execSync } from 'child_process';
import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';

import { ensureElectronSupportsNodeAPI } from '../node-api';

export type DevDependencies = Record<string, string>;

const d = debug('electron-rebuild');

export function isPrebuildifyNativeModule(devDependencies: DevDependencies): boolean {
  // eslint-disable-next-line no-prototype-builtins
  return devDependencies.hasOwnProperty('prebuildify');
}

/**
 * Runs the `uname` command and returns the trimmed output.
 *
 * Copied from `@electron/get`.
 */
export function uname(): string {
  return execSync('uname -m')
    .toString()
    .trim();
}

export type ConfigVariables = {
  arm_version?: string;
}

/**
 * Generates an architecture name that would be used in an Electron or Node.js
 * download file name.
 *
 * Copied from `@electron/get`.
 */
export function getNodeArch(arch: string, configVariables: ConfigVariables): string {
  if (arch === 'arm') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    switch (configVariables.arm_version) {
      case '6':
        return uname();
      case '7':
      default:
        return 'armv7l';
    }
  }

  return arch;
}

export function determineNativePrebuildArch(arch: string): string {
  if (arch === 'armv7l') {
    return 'arm';
  }

  return arch;
}

/**
 * The extension of `prebuildify`-generated native modules, after the last `.`. This value differs
 * based on whether the target arch is ARM-based.
 */
export function determineNativePrebuildExtension(arch: string): string {
  switch (arch) {
    case 'arm64':
      return 'armv8.node';
    case 'armv7l':
      return 'armv7.node';
  }

  return 'node';
}

export async function findPrebuildifyModule(
  modulePath: string,
  platform: string,
  arch: string,
  electronVersion: string,
  abi: string,
  devDependencies: DevDependencies
): Promise<boolean> {
  if (!isPrebuildifyNativeModule(devDependencies)) {
    return false;
  }

  const moduleName = path.basename(modulePath);
  const nodeArch = getNodeArch(arch, process.config.variables as ConfigVariables);

  d(`Checking for prebuilds for "${moduleName}"`);

  const prebuildsDir = path.join(modulePath, 'prebuilds');
  if (!(await fs.pathExists(prebuildsDir))) {
    d(`Could not find the prebuilds directory at "${prebuildsDir}"`)
    return false;
  }

  const prebuiltModuleDir = path.join(prebuildsDir, `${platform}-${determineNativePrebuildArch(nodeArch)}`);
  const nativeExt = determineNativePrebuildExtension(nodeArch);
  const electronNapiModuleFilename = path.join(prebuiltModuleDir, `electron.napi.${nativeExt}`);
  const nodejsNapiModuleFilename = path.join(prebuiltModuleDir, `node.napi.${nativeExt}`);
  const abiModuleFilename = path.join(prebuiltModuleDir, `electron.abi${abi}.${nativeExt}`);

  if (await fs.pathExists(electronNapiModuleFilename) || await fs.pathExists(nodejsNapiModuleFilename)) {
    ensureElectronSupportsNodeAPI(moduleName, electronVersion);
    d(`Found prebuilt Node-API module in ${prebuiltModuleDir}"`);
  } else if (await fs.pathExists(abiModuleFilename)) {
    d(`Found prebuilt module: "${abiModuleFilename}"`);
  } else {
    d(`Could not locate "${electronNapiModuleFilename}", "${nodejsNapiModuleFilename}", or "${abiModuleFilename}"`);
    return false;
  }

  return true;
}
