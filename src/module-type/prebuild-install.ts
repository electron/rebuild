import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from '@malept/cross-spawn-promise';

import { locateBinary, NativeModule } from '.';
const d = debug('electron-rebuild');

export class PrebuildInstall extends NativeModule {
  async usesTool(): Promise<boolean> {
    const dependencies = await this.packageJSONFieldWithDefault('dependencies', {});
    // eslint-disable-next-line no-prototype-builtins
    return dependencies.hasOwnProperty('prebuild-install')
  }

  async locateBinary(): Promise<string | null> {
    return locateBinary(this.modulePath, 'node_modules/prebuild-install/bin.js');
  }

  async run(prebuildInstallPath: string): Promise<void> {
    await spawn(
      process.execPath,
      [
        path.resolve(__dirname, '..', `prebuild-shim.js`),
        prebuildInstallPath,
        `--arch=${this.rebuilder.arch}`,
        `--platform=${this.rebuilder.platform}`,
        `--tag-prefix=${this.rebuilder.prebuildTagPrefix}`,
        ...await this.getPrebuildInstallRuntimeArgs(),
      ],
      {
        cwd: this.modulePath,
      }
    );
  }

  async findPrebuiltModule(): Promise<boolean> {
    const prebuildInstallPath = await this.locateBinary();
    if (prebuildInstallPath) {
      d(`triggering prebuild download step: ${this.moduleName}`);
      try {
        await this.run(prebuildInstallPath);
        return true;
      } catch (err) {
        d('failed to use prebuild-install:', err);

        if (err?.message?.includes('requires Node-API but Electron')) {
          throw err;
        }
      }
    } else {
      d(`could not find prebuild-install relative to: ${this.modulePath}`);
    }

    return false;
  }

  /**
   * Whether a prebuild-install-based native module exists.
   */
  async prebuiltModuleExists(): Promise<boolean> {
    return fs.pathExists(path.resolve(this.modulePath, 'prebuilds', `${this.rebuilder.platform}-${this.rebuilder.arch}`, `electron-${this.rebuilder.ABI}.node`))
  }

  async getPrebuildInstallRuntimeArgs(): Promise<string[]> {
    const moduleNapiVersions = await this.getSupportedNapiVersions();
    if (moduleNapiVersions) {
      const napiVersion = this.nodeAPI.getNapiVersion(moduleNapiVersions);
      return [
        '--runtime=napi',
        `--target=${napiVersion}`,
      ]
    } else {
      return [
        '--runtime=electron',
        `--target=${this.rebuilder.electronVersion}`,
      ]
    }
  }
}
