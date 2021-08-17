import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';

type DevDependencies = Record<string, string>;

const d = debug('electron-rebuild');

export function isPrebuildifyNativeModule(devDependencies: DevDependencies): boolean {
  // eslint-disable-next-line no-prototype-builtins
  return Object.prototype.hasOwnProperty(devDependencies, 'prebuildify');
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
  abi: string,
  devDependencies: DevDependencies
): Promise<boolean> {
  if (!isPrebuildifyNativeModule(devDependencies)) {
    return false;
  }

  d(`Checking for prebuilds for "${path.basename(modulePath)}"`);

  const prebuildsDir = path.join(modulePath, 'prebuilds');
  if (!(await fs.pathExists(prebuildsDir))) {
    d(`Could not find the prebuilds directory at "${prebuildsDir}"`)
    return false;
  }

  const prebuiltModuleDir = path.join(prebuildsDir, `${platform}-${determineNativePrebuildArch(arch)}`);
  const nativeExt = determineNativePrebuildExtension(arch);
  const electronNapiModuleFilename = path.join(prebuiltModuleDir, `electron.napi.${nativeExt}`);
  const nodejsNapiModuleFilename = path.join(prebuiltModuleDir, `node.napi.${nativeExt}`);
  const abiModuleFilename = path.join(prebuiltModuleDir, `electron.abi${abi}.${nativeExt}`);

  if (await fs.pathExists(electronNapiModuleFilename) || await fs.pathExists(nodejsNapiModuleFilename)) {
    this.ensureElectronSupportsNodeAPI();
    d(`Found prebuilt Node-API module in ${prebuiltModuleDir}"`);
  } else if (await fs.pathExists(abiModuleFilename)) {
    d(`Found prebuilt module: "${abiModuleFilename}"`);
  } else {
    d(`Could not locate "${electronNapiModuleFilename}", "${nodejsNapiModuleFilename}", or "${abiModuleFilename}"`);
    return false;
  }

  return true;
}
