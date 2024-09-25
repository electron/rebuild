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
  /**
   * The path to the `node_modules` directory to rebuild.
   */
  buildPath: string;
  /**
   * The version of Electron to build against.
   */
  electronVersion: string;
  /**
   * Override the target platform to something other than the host system platform.
   * Note: This only applies to downloading prebuilt binaries. **It is not possible to cross-compile native modules.**
   * 
   * @defaultValue The system {@link https://nodejs.org/api/process.html#processplatform | `process.platform`} value
   */
  platform?: NodeJS.Platform;
  /**
   * Override the target rebuild architecture to something other than the host system architecture.
   * 
   * @defaultValue The system {@link https://nodejs.org/api/process.html#processarch | `process.arch`} value
   */
  arch?: string;
  /**
   * An array of module names to rebuild in addition to detected modules
   * @default []
   */
  extraModules?: string[];
  /**
   * An array of module names to rebuild. **Only** these modules will be rebuilt.
   */
  onlyModules?: string[] | null;
  /**
   * Force a rebuild of modules regardless of their current build state.
   */
  force?: boolean;
  /**
   * URL to download Electron header files from.
   * @defaultValue `https://www.electronjs.org/headers`
   */
  headerURL?: string;
  /**
   * Array of types of dependencies to rebuild. Possible values are `prod`, `dev`, and `optional`.
   * 
   * @defaultValue `['prod', 'optional']`
   */
  types?: ModuleType[];
  /**
   * Whether to rebuild modules sequentially or in parallel.
   * 
   * @defaultValue `sequential`
   */
  mode?: RebuildMode;
  /**
   * Rebuilds a Debug build of target modules. If this is `false`, a Release build will be generated instead.
   * 
   * @defaultValue false
   */
  debug?: boolean;
  /**
   * Enables hash-based caching to speed up local rebuilds.
   * 
   * @experimental
   * @defaultValue false
   */
  useCache?: boolean;
  /**
   * Whether to use the `clang` executable that Electron uses when building.
   * This will guarantee compiler compatibility.
   *
   * @defaultValue false
   */
  useElectronClang?: boolean;
  /**
   * Sets a custom cache path for the {@link useCache} option.
   * @experimental
   * @defaultValue a `.electron-rebuild-cache` folder in the `os.homedir()` directory
   */
  cachePath?: string;
  /**
   * GitHub tag prefix passed to {@link https://www.npmjs.com/package/prebuild-install | `prebuild-install`}.
   * @defaultValue `v`
   */
  prebuildTagPrefix?: string;
  /**
   * Path to the root of the project if using npm or yarn workspaces.
   */
  projectRootPath?: string;
  /**
   * Override the Application Binary Interface (ABI) version for the version of Electron you are targeting.
   * Only use when targeting nightly releases.
   * 
   * @see the {@link https://github.com/electron/node-abi | electron/node-abi} repository for a list of Electron and Node.js ABIs
   */
  forceABI?: number;
  /**
   * Disables the copying of `.node` files if not needed.
   * @defaultValue false
   */
  disablePreGypCopy?: boolean;
  /**
   * Skip prebuild download and rebuild module from source.
   *
   * @defaultValue false
   */
  buildFromSource?: boolean;
  /**
   * Array of module names to ignore during the rebuild process.
   */
  ignoreModules?: string[];
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
  public platform: NodeJS.Platform;
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
  public buildFromSource: boolean;
  public ignoreModules: string[];

  constructor(options: RebuilderOptions) {
    this.lifecycle = options.lifecycle;
    this.buildPath = options.buildPath;
    this.electronVersion = options.electronVersion;
    this.platform = options.platform || process.platform
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
    this.buildFromSource = options.buildFromSource || false;
    this.ignoreModules = options.ignoreModules || [];
    d('ignoreModules', this.ignoreModules);

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
      this.platform,
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

    let moduleName = path.basename(modulePath);
    const parentName = path.basename(path.dirname(modulePath));
    if (parentName !== 'node_modules') {
      moduleName = `${parentName}/${moduleName}`;
    }

    this.lifecycle.emit('module-found', moduleName);

    if (!this.force && await moduleRebuilder.alreadyBuiltByRebuild()) {
      d(`skipping: ${moduleName} as it is already built`);
      this.lifecycle.emit('module-done', moduleName);
      this.lifecycle.emit('module-skip', moduleName);
      return;
    }

    d('checking', moduleName, 'against', this.ignoreModules);
    if (this.ignoreModules.includes(moduleName)) {
      d(`skipping: ${moduleName} as it is in the ignoreModules array`);
      this.lifecycle.emit('module-done', moduleName);
      this.lifecycle.emit('module-skip', moduleName);
      return;
    }

    if (await moduleRebuilder.prebuildInstallNativeModuleExists()) {
      d(`skipping: ${moduleName} as it was prebuilt`);
      return;
    }

    let cacheKey!: string;
    if (this.useCache) {
      cacheKey = await generateCacheKey({
        ABI: this.ABI,
        arch: this.arch,
        platform: this.platform,
        debug: this.debug,
        electronVersion: this.electronVersion,
        headerURL: this.headerURL,
        modulePath,
      });

      const applyDiffFn = await lookupModuleState(this.cachePath, cacheKey);
      if (typeof applyDiffFn === 'function') {
        await applyDiffFn(modulePath);
        this.lifecycle.emit('module-done', moduleName);
        return;
      }
    }

    if (await moduleRebuilder.rebuild(cacheKey)) {
      this.lifecycle.emit('module-done', moduleName);
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
