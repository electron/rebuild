import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from '@malept/cross-spawn-promise';

import { locateBinary, NativeModule } from '.';
const d = debug('electron-rebuild');

export class NodePreGyp extends NativeModule {
  async usesTool(): Promise<boolean> {
    const dependencies = await this.packageJSONFieldWithDefault('dependencies', {});
    // eslint-disable-next-line no-prototype-builtins
    return dependencies.hasOwnProperty('@mapbox/node-pre-gyp');
  }

  async locateBinary(): Promise<string | null> {
    const cmd = `node-pre-gyp${process.platform === 'win32' ? '.cmd' : ''}`;
    return locateBinary(this.modulePath, `node_modules/@mapbox/node-pre-gyp/bin/${cmd}`);
  }

  async run(nodePreGypPath: string): Promise<void> {
    await spawn(
      nodePreGypPath,
      [
        'reinstall',
        '--fallback-to-build',
        `--arch=${this.rebuilder.arch}`,
        `--platform=${this.rebuilder.platform}`,
        ...await this.getNodePreGypRuntimeArgs(),
      ],
      {
        cwd: this.modulePath,
      }
    );
  }

  async findPrebuiltModule(): Promise<boolean> {
    const nodePreGypPath = await this.locateBinary();
    if (nodePreGypPath) {
      d(`triggering prebuild download step: ${this.moduleName}`);
      try {
        await this.run(nodePreGypPath);
        return true;
      } catch (err) {
        d('failed to use node-pre-gyp:', err);

        if (err?.message?.includes('requires Node-API but Electron')) {
          throw err;
        }
      }
    } else {
      d(`could not find node-pre-gyp relative to: ${this.modulePath}`);
    }

    return false;
  }

  /**
   * Whether a prebuild-install-based native module exists.
   */
  async prebuiltModuleExists(): Promise<boolean> {
    return fs.pathExists(path.resolve(this.modulePath, 'prebuilds', `${this.rebuilder.platform}-${this.rebuilder.arch}`, `electron-${this.rebuilder.ABI}.node`))
  }

  async getNodePreGypRuntimeArgs(): Promise<string[]> {
    const moduleNapiVersions = await this.getSupportedNapiVersions();
    if (moduleNapiVersions) {
      return []
    } else {
      return [
        '--runtime=electron',
        `--target=${this.rebuilder.electronVersion}`,
        `--dist-url=${this.rebuilder.headerURL}`,
      ]
    }
  }
}
