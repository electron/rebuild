import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';

import { ConfigVariables, getNodeArch } from '../arch';
import { NativeModule } from '.';

const d = debug('electron-rebuild');

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

export class Prebuildify extends NativeModule {
  async usesTool(): Promise<boolean> {
    const devDependencies = await this.packageJSONFieldWithDefault('devDependencies', {});
    // eslint-disable-next-line no-prototype-builtins
    return devDependencies.hasOwnProperty('prebuildify');
  }

  async findPrebuiltModule(): Promise<boolean> {
    const nodeArch = getNodeArch(this.rebuilder.arch, process.config.variables as ConfigVariables);

    d(`Checking for prebuilds for "${this.moduleName}"`);

    const prebuildsDir = path.join(this.modulePath, 'prebuilds');
    if (!(await fs.pathExists(prebuildsDir))) {
      d(`Could not find the prebuilds directory at "${prebuildsDir}"`);
      return false;
    }

    const prebuiltModuleDir = path.join(prebuildsDir, `${this.rebuilder.platform}-${determineNativePrebuildArch(nodeArch)}`);
    const nativeExt = determineNativePrebuildExtension(nodeArch);
    const electronNapiModuleFilename = path.join(prebuiltModuleDir, `electron.napi.${nativeExt}`);
    const nodejsNapiModuleFilename = path.join(prebuiltModuleDir, `node.napi.${nativeExt}`);
    const abiModuleFilename = path.join(prebuiltModuleDir, `electron.abi${this.rebuilder.ABI}.${nativeExt}`);

    if (await fs.pathExists(electronNapiModuleFilename) || await fs.pathExists(nodejsNapiModuleFilename)) {
      this.nodeAPI.ensureElectronSupport();
      d(`Found prebuilt Node-API module in ${prebuiltModuleDir}"`);
    } else if (await fs.pathExists(abiModuleFilename)) {
      d(`Found prebuilt module: "${abiModuleFilename}"`);
    } else {
      d(`Could not locate "${electronNapiModuleFilename}", "${nodejsNapiModuleFilename}", or "${abiModuleFilename}"`);
      return false;
    }

    return true;
  }
}
