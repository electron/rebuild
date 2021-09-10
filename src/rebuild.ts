import * as crypto from 'crypto';
import debug from 'debug';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as nodeAbi from 'node-abi';
import * as os from 'os';
import * as path from 'path';

import { lookupModuleState } from './cache';
import { ModuleType, ModuleWalker } from './module-walker';

export type RebuildMode = 'sequential' | 'parallel';

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
}

export type HashTree = { [path: string]: string | HashTree };

export interface RebuilderOptions extends RebuildOptions {
  lifecycle: EventEmitter;
}

export enum BuildType {
  Debug = 'Debug',
  Release = 'Release',
}

const d = debug('electron-rebuild');

const defaultMode: RebuildMode = 'sequential';
const defaultTypes: ModuleType[] = ['prod', 'optional'];
// Update this number if you change the caching logic to ensure no bad cache hits
const ELECTRON_REBUILD_CACHE_ID = 1;

export class Rebuilder {
  private ABIVersion: string | undefined;
  private moduleWalker: ModuleWalker;
  nodeGypPath: string;
  rebuilds: (() => Promise<void>)[];

  public lifecycle: EventEmitter;
  public buildPath: string;
  public electronVersion: string;
  public platform: string = process.platform;
  public arch: string;
  public extraModules: string[];
  public onlyModules: string[] | null;
  public force: boolean;
  public headerURL: string;
  public types: ModuleType[];
  public mode: RebuildMode;
  public debug: boolean;
  public useCache: boolean;
  public cachePath: string;
  public prebuildTagPrefix: string;
  public msvsVersion?: string;
  public useElectronClang: boolean;
  public disablePreGypCopy: boolean;

  constructor(options: RebuilderOptions) {
    this.lifecycle = options.lifecycle;
    this.buildPath = options.buildPath;
    this.electronVersion = options.electronVersion;
    this.arch = options.arch || process.arch;
    this.extraModules = options.extraModules || [];
    this.onlyModules = options.onlyModules || null;
    this.force = options.force || false;
    this.headerURL = options.headerURL || 'https://www.electronjs.org/headers';
    this.types = options.types || defaultTypes;
    this.mode = options.mode || defaultMode;
    this.debug = options.debug || false;
    this.useCache = options.useCache || false;
    this.useElectronClang = options.useElectronClang || false;
    this.cachePath = options.cachePath || path.resolve(os.homedir(), '.electron-rebuild-cache');
    this.prebuildTagPrefix = options.prebuildTagPrefix || 'v';
    this.msvsVersion = process.env.GYP_MSVS_VERSION;
    this.disablePreGypCopy = options.disablePreGypCopy || false;

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
    this.moduleWalker = new ModuleWalker(
      this.buildPath,
      options.projectRootPath,
      this.types,
      this.extraModules.reduce((acc: Set<string>, x: string) => acc.add(x), new Set<string>()),
      this.onlyModules,
    );
    this.rebuilds = [];
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
    d(
      'rebuilding with args:',
      this.buildPath,
      this.electronVersion,
      this.arch,
      this.extraModules,
      this.force,
      this.headerURL,
      this.types,
      this.debug
    );

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

  private hashDirectory = async (dir: string, relativeTo = dir): Promise<HashTree> => {
    d('hashing dir', dir);
    const dirTree: HashTree = {};
    await Promise.all((await fs.readdir(dir)).map(async (child) => {
      d('found child', child, 'in dir', dir);
      // Ignore output directories
      if (dir === relativeTo && (child === 'build' || child === 'bin')) return;
      // Don't hash nested node_modules
      if (child === 'node_modules') return;

      const childPath = path.resolve(dir, child);
      const relative = path.relative(relativeTo, childPath);
      if ((await fs.stat(childPath)).isDirectory()) {
        dirTree[relative] = await this.hashDirectory(childPath, relativeTo);
      } else {
        dirTree[relative] = crypto.createHash('SHA256').update(await fs.readFile(childPath)).digest('hex');
      }
    }));
    return dirTree;
  }

  private dHashTree = (tree: HashTree, hash: crypto.Hash): void => {
    for (const key of Object.keys(tree).sort()) {
      hash.update(key);
      if (typeof tree[key] === 'string') {
        hash.update(tree[key] as string);
      } else {
        this.dHashTree(tree[key] as HashTree, hash);
      }
    }
  }

  private generateCacheKey = async (opts: { modulePath: string }): Promise<string> => {
    const tree = await this.hashDirectory(opts.modulePath);
    const hasher = crypto.createHash('SHA256')
      .update(`${ELECTRON_REBUILD_CACHE_ID}`)
      .update(path.basename(opts.modulePath))
      .update(this.ABI)
      .update(this.arch)
      .update(this.debug ? 'debug' : 'not debug')
      .update(this.headerURL)
      .update(this.electronVersion);
    this.dHashTree(tree, hasher);
    const hash = hasher.digest('hex');
    d('calculated hash of', opts.modulePath, 'to be', hash);
    return hash;
  }

  async rebuildModuleAt(modulePath: string): Promise<void> {
    if (!(await fs.pathExists(path.resolve(modulePath, 'binding.gyp')))) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ModuleRebuilder } = require('./module-rebuilder');
    const moduleRebuilder = new ModuleRebuilder(this, modulePath);

    this.lifecycle.emit('module-found', path.basename(modulePath));

    if (!this.force && await moduleRebuilder.alreadyBuiltByRebuild()) {
      d(`skipping: ${path.basename(modulePath)} as it is already built`);
      this.lifecycle.emit('module-done');
      this.lifecycle.emit('module-skip');
      return;
    }

    if (await moduleRebuilder.prebuildInstallNativeModuleExists(modulePath)) {
      d(`skipping: ${path.basename(modulePath)} as it was prebuilt`);
      return;
    }

    let cacheKey!: string;
    if (this.useCache) {
      cacheKey = await this.generateCacheKey({
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
