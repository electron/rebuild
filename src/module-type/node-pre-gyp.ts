import debug from 'debug';
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
    return locateBinary(this.modulePath, 'node_modules/@mapbox/node-pre-gyp/bin/node-pre-gyp');
  }

  async run(nodePreGypPath: string): Promise<void> {
    await spawn(
      process.execPath,
      [
        nodePreGypPath,
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

  async getNodePreGypRuntimeArgs(): Promise<string[]> {
    const moduleNapiVersions = await this.getSupportedNapiVersions();
    if (moduleNapiVersions) {
      return [];
    } else {
      return [
        '--runtime=electron',
        `--target=${this.rebuilder.electronVersion}`,
        `--dist-url=${this.rebuilder.headerURL}`,
      ];
    }
  }
}
