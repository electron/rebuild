import debug from 'debug';
import fs from 'graceful-fs';
import path from 'node:path';

import { cacheModuleState } from './cache.js';
import { NodeGyp } from './module-type/node-gyp/node-gyp.js';
import { Prebuildify } from './module-type/prebuildify.js';
import { PrebuildInstall } from './module-type/prebuild-install.js';
import { NodePreGyp } from './module-type/node-pre-gyp.js';
import { IRebuilder } from './types.js';
import { promisifiedGracefulFs } from './promisifiedGracefulFs.js';

const d = debug('electron-rebuild');

export class ModuleRebuilder {
  private modulePath: string;
  private nodeGyp: NodeGyp;
  private rebuilder: IRebuilder;
  private prebuildify: Prebuildify;
  private prebuildInstall: PrebuildInstall;
  private nodePreGyp: NodePreGyp;

  constructor(rebuilder: IRebuilder, modulePath: string) {
    this.modulePath = modulePath;
    this.rebuilder = rebuilder;

    this.nodeGyp = new NodeGyp(rebuilder, modulePath);
    this.prebuildify = new Prebuildify(rebuilder, modulePath);
    this.prebuildInstall = new PrebuildInstall(rebuilder, modulePath);
    this.nodePreGyp = new NodePreGyp(rebuilder, modulePath);
  }

  get metaPath(): string {
    return path.resolve(this.modulePath, 'build', this.rebuilder.buildType, '.forge-meta');
  }

  get metaData(): string {
    return `${this.rebuilder.arch}--${this.rebuilder.ABI}`;
  }

  async alreadyBuiltByRebuild(): Promise<boolean> {
    if (fs.existsSync(this.metaPath)) {
      const meta = await promisifiedGracefulFs.readFile(this.metaPath, 'utf8');
      return meta === this.metaData;
    }

    return false;
  }

  async cacheModuleState(cacheKey: string): Promise<void> {
    if (this.rebuilder.useCache) {
      await cacheModuleState(this.modulePath, this.rebuilder.cachePath, cacheKey);
    }
  }

  /**
   * Whether a prebuild-install-generated native module exists.
   */
  async prebuildInstallNativeModuleExists(): Promise<boolean> {
    return this.prebuildInstall.prebuiltModuleExists();
  }

  /**
   * If the native module uses prebuildify, check to see if it comes with a prebuilt module for
   * the given platform and arch.
   */
  async findPrebuildifyModule(cacheKey: string): Promise<boolean> {
    if (await this.prebuildify.usesTool()) {
      d(`assuming is prebuildify powered: ${this.prebuildify.moduleName}`);

      if (await this.prebuildify.findPrebuiltModule()) {
        await this.writeMetadata();
        await this.cacheModuleState(cacheKey);
        return true;
      }
    }

    return false;
  }

  async findPrebuildInstallModule(cacheKey: string): Promise<boolean> {
    if (await this.prebuildInstall.usesTool()) {
      d(`assuming is prebuild-install powered: ${this.prebuildInstall.moduleName}`);

      if (await this.prebuildInstall.findPrebuiltModule()) {
        d('installed prebuilt module:', this.prebuildInstall.moduleName);
        await this.writeMetadata();
        await this.cacheModuleState(cacheKey);
        return true;
      }
    }

    return false;
  }

  async findNodePreGypInstallModule(cacheKey: string): Promise<boolean> {
    if (await this.nodePreGyp.usesTool()) {
      d(`assuming is node-pre-gyp powered: ${this.nodePreGyp.moduleName}`);

      if (await this.nodePreGyp.findPrebuiltModule()) {
        d('installed prebuilt module:', this.nodePreGyp.moduleName);
        await this.writeMetadata();
        await this.cacheModuleState(cacheKey);
        return true;
      }
    }

    return false;
  }

  async rebuildNodeGypModule(cacheKey: string): Promise<boolean> {
    await this.nodeGyp.rebuildModule();
    d('built via node-gyp:', this.nodeGyp.moduleName);
    await this.writeMetadata();
    await this.replaceExistingNativeModule();
    await this.cacheModuleState(cacheKey);
    return true;
  }

  async replaceExistingNativeModule(): Promise<void> {
    const buildLocation = path.resolve(this.modulePath, 'build', this.rebuilder.buildType);

    d('searching for .node file', buildLocation);
    const buildLocationFiles = await promisifiedGracefulFs.readdir(buildLocation);
    d('testing files', buildLocationFiles);

    const nodeFile = buildLocationFiles.find((file) => file !== '.node' && file.endsWith('.node'));
    const nodePath = nodeFile ? path.resolve(buildLocation, nodeFile) : undefined;

    if (nodePath && fs.existsSync(nodePath)) {
      d('found .node file', nodePath);
      if (!this.rebuilder.disablePreGypCopy) {
        const abiPath = path.resolve(this.modulePath, `bin/${this.rebuilder.platform}-${this.rebuilder.arch}-${this.rebuilder.ABI}`);
        d('copying to prebuilt place:', abiPath);
        await fs.promises.mkdir(abiPath, { recursive: true });
        await promisifiedGracefulFs.copyFile(nodePath, path.join(abiPath, `${this.nodeGyp.moduleName}.node`));
      }
    }
  }

  async writeMetadata(): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.metaPath), { recursive: true });
    await promisifiedGracefulFs.writeFile(this.metaPath, this.metaData);
  }

  async rebuild(cacheKey: string): Promise<boolean> {
    if (
      !this.rebuilder.buildFromSource && (
        (await this.findPrebuildifyModule(cacheKey)) ||
        (await this.findPrebuildInstallModule(cacheKey)) ||
        (await this.findNodePreGypInstallModule(cacheKey)))
    ) {
      return true;
    }

    return await this.rebuildNodeGypModule(cacheKey);
  }
}
