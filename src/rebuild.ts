import debug from 'debug';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as nodeAbi from 'node-abi';
import * as os from 'os';
import * as path from 'path';

import { generateCacheKey, lookupModuleState } from './cache';
import { BuildType, IRebuilder, RebuildMode } from './types';
import { ModuleRebuilder } from './module-rebuilder';
import { ModuleType, ModuleWalker } from './module-walker';

export interface RebuildOptions {
  buildPath: string;
  electronVersion: string;
  arch?: string;
  extraModules?: string[];
  onlyModules?: string[] | null;
  force?: boolean;
  headerURL?: string;
  types?: ModuleType[];
  mode?: RebuildMode;
  debug?: boolean;
  useCache?: boolean;
  useElectronClang?: boolean;
  cachePath?: string;
  prebuildTagPrefix?: string;
  projectRootPath?: string;
  forceABI?: number;
  disablePreGypCopy?: boolean;
  skipPrebuilds?: boolean;
}

export interface RebuilderOptions extends RebuildOptions {
  lifecycle: EventEmitter;
}

const d = debug('electron-rebuild');

const defaultMode: RebuildMode = 'sequential';
const defaultTypes: ModuleType[] = ['prod', 'optional'];

export class Rebuilder implements IRebuilder {
  private ABIVersion: string | undefined;
  private moduleWalker: ModuleWalker;
  nodeGypPath: string;
  rebuilds: (() => Promise<void>)[];

  public lifecycle: EventEmitter;
  public buildPath: string;
  public electronVersion: string;
  public platform: string = process.platform;
  public arch: string;
  public force: boolean;
  public headerURL: string;
  public mode: RebuildMode;
  public debug: boolean;
  public useCache: boolean;
  public cachePath: string;
  public prebuildTagPrefix: string;
  public msvsVersion?: string;
  public useElectronClang: boolean;
  public disablePreGypCopy: boolean;
  public skipPrebuilds: boolean;

  constructor(options: RebuilderOptions) {
    this.lifecycle = options.lifecycle;
    this.buildPath = options.buildPath;
    this.electronVersion = options.electronVersion;
    this.arch = options.arch || process.arch;
    this.force = options.force || false;
    this.headerURL = options.headerURL || 'https://www.electronjs.org/headers';
    this.mode = options.mode || defaultMode;
    this.debug = options.debug || false;
    this.useCache = options.useCache || false;
    this.useElectronClang = options.useElectronClang || false;
    this.cachePath = options.cachePath || path.resolve(os.homedir(), '.electron-rebuild-cache');
    this.prebuildTagPrefix = options.prebuildTagPrefix || 'v';
    this.msvsVersion = process.env.GYP_MSVS_VERSION;
    this.disablePreGypCopy = options.disablePreGypCopy || false;
    this.skipPrebuilds = options.skipPrebuilds || false;

    if (this.useCache && this.force) {
      console.warn('[WARNING]: Electron Rebuild has force enabled and cache enabled, force take precedence and the cache will not be used.');
      this.useCache = false;
    }

    if (typeof this.electronVersion === 'number') {
      if (`${this.electronVersion}`.split('.').length === 1) {
        this.electronVersion = `${this.electronVersion}.0.0`;
      } else {
        this.electronVersion = `${this.electronVersion}.0`;
      }
    }
    if (typeof this.electronVersion !== 'string') {
      throw new Error(`Expected a string version for electron version, got a "${typeof this.electronVersion}"`);
    }

    this.ABIVersion = options.forceABI?.toString();
    const onlyModules = options.onlyModules || null;
    const extraModules = (options.extraModules || []).reduce((acc: Set<string>, x: string) => acc.add(x), new Set<string>());
    const types = options.types || defaultTypes;
    this.moduleWalker = new ModuleWalker(
      this.buildPath,
      options.projectRootPath,
      types,
      extraModules,
      onlyModules,
    );
    this.rebuilds = [];

    d(
      'rebuilding with args:',
      this.buildPath,
      this.electronVersion,
      this.arch,
      extraModules,
      this.force,
      this.headerURL,
      types,
      this.debug
    );
  }

  get ABI(): string {
    if (this.ABIVersion === undefined) {
      this.ABIVersion = nodeAbi.getAbi(this.electronVersion, 'electron');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.ABIVersion!;
  }

  get buildType(): BuildType {
    return this.debug ? BuildType.Debug : BuildType.Release;
  }

  async rebuild(): Promise<void> {
    if (!path.isAbsolute(this.buildPath)) {
      throw new Error('Expected buildPath to be an absolute path');
    }

    this.lifecycle.emit('start');

    await this.moduleWalker.walkModules();

    for (const nodeModulesPath of await this.moduleWalker.nodeModulesPaths) {
      await this.moduleWalker.findAllModulesIn(nodeModulesPath);
    }

    for (const modulePath of this.moduleWalker.modulesToRebuild) {
      this.rebuilds.push(() => this.rebuildModuleAt(modulePath));
    }

    this.rebuilds.push(() => this.rebuildModuleAt(this.buildPath));

    if (this.mode !== 'sequential') {
      await Promise.all(this.rebuilds.map(fn => fn()));
    } else {
      for (const rebuildFn of this.rebuilds) {
        await rebuildFn();
      }
    }
  }

  async rebuildModuleAt(modulePath: string): Promise<void> {
    if (!(await fs.pathExists(path.resolve(modulePath, 'binding.gyp')))) {
      return;
    }

    const moduleRebuilder = new ModuleRebuilder(this, modulePath);

    this.lifecycle.emit('module-found', path.basename(modulePath));

    if (!this.force && await moduleRebuilder.alreadyBuiltByRebuild()) {
      d(`skipping: ${path.basename(modulePath)} as it is already built`);
      this.lifecycle.emit('module-done');
      this.lifecycle.emit('module-skip');
      return;
    }

    if (await moduleRebuilder.prebuildInstallNativeModuleExists()) {
      d(`skipping: ${path.basename(modulePath)} as it was prebuilt`);
      return;
    }

    let cacheKey!: string;
    if (this.useCache) {
      cacheKey = await generateCacheKey({
        ABI: this.ABI,
        arch: this.arch,
        debug: this.debug,
        electronVersion: this.electronVersion,
        headerURL: this.headerURL,
        modulePath,
      });

      const applyDiffFn = await lookupModuleState(this.cachePath, cacheKey);
      if (typeof applyDiffFn === 'function') {
        await applyDiffFn(modulePath);
        this.lifecycle.emit('module-done');
        return;
      }
    }

    if (await moduleRebuilder.rebuild(cacheKey)) {
      this.lifecycle.emit('module-done');
    }
  }
}

export type RebuildResult = Promise<void> & { lifecycle: EventEmitter };

export function rebuild(options: RebuildOptions): RebuildResult {
  // eslint-disable-next-line prefer-rest-params
  d('rebuilding with args:', arguments);
  const lifecycle = new EventEmitter();
  const rebuilderOptions: RebuilderOptions = { ...options, lifecycle };
  const rebuilder = new Rebuilder(rebuilderOptions);

  const ret = rebuilder.rebuild() as RebuildResult;
  ret.lifecycle = lifecycle;

  return ret;
}
