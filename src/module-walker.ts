import debug from 'debug';
import fs from 'graceful-fs';
import path from 'node:path';

import { readPackageJson } from './read-package-json.js';
import { searchForModule, searchForNodeModules } from './search-module.js';
import { promisifiedGracefulFs } from './promisifiedGracefulFs.js';

const d = debug('electron-rebuild');

export type ModuleType = 'prod' | 'dev' | 'optional';

export class ModuleWalker {
  buildPath: string;
  modulesToRebuild: string[];
  onlyModules: string[] | null;
  prodDeps: Set<string>;
  projectRootPath?: string;
  realModulePaths: Set<string>;
  realNodeModulesPaths: Set<string>;
  types: ModuleType[];

  constructor(buildPath: string, projectRootPath: string | undefined, types: ModuleType[], prodDeps: Set<string>, onlyModules: string[] | null) {
    this.buildPath = buildPath;
    this.modulesToRebuild = [];
    this.projectRootPath = projectRootPath;
    this.types = types;
    this.prodDeps = prodDeps;
    this.onlyModules = onlyModules;
    this.realModulePaths = new Set();
    this.realNodeModulesPaths = new Set();
  }

  get nodeModulesPaths(): Promise<string[]> {
    return searchForNodeModules(
      this.buildPath,
      this.projectRootPath
    );
  }

  async walkModules(): Promise<void> {
    const rootPackageJson = await readPackageJson(this.buildPath);
    const markWaiters: Promise<void>[] = [];
    const depKeys = [];

    if (this.types.includes('prod') || this.onlyModules) {
      depKeys.push(...Object.keys(rootPackageJson.dependencies || {}));
    }
    if (this.types.includes('optional') || this.onlyModules) {
      depKeys.push(...Object.keys(rootPackageJson.optionalDependencies || {}));
    }
    if (this.types.includes('dev') || this.onlyModules) {
      depKeys.push(...Object.keys(rootPackageJson.devDependencies || {}));
    }

    for (const key of depKeys) {
      this.prodDeps.add(key);
      const modulePaths: string[] = await searchForModule(
        this.buildPath,
        key,
        this.projectRootPath
      );
      for (const modulePath of modulePaths) {
        markWaiters.push(this.markChildrenAsProdDeps(modulePath));
      }
    }

    await Promise.all(markWaiters);

    d('identified prod deps:', this.prodDeps);
  }

  async findModule(moduleName: string, fromDir: string, foundFn: ((p: string) => Promise<void>)): Promise<void[]> {

    const testPaths = await searchForModule(
      fromDir,
      moduleName,
      this.projectRootPath
    );
    const foundFns = testPaths.map(testPath => foundFn(testPath));

    return Promise.all(foundFns);
  }

  async markChildrenAsProdDeps(modulePath: string): Promise<void> {
    if (!fs.existsSync(modulePath)) {
      return;
    }

    d('exploring', modulePath);
    let childPackageJson;
    try {
      childPackageJson = await readPackageJson(modulePath, true);
    } catch (err) {
      return;
    }
    const moduleWait: Promise<void[]>[] = [];

    const callback = this.markChildrenAsProdDeps.bind(this);
    for (const key of Object.keys(childPackageJson.dependencies || {}).concat(Object.keys(childPackageJson.optionalDependencies || {}))) {
      if (this.prodDeps.has(key)) {
        continue;
      }

      this.prodDeps.add(key);

      moduleWait.push(this.findModule(key, modulePath, callback));
    }

    await Promise.all(moduleWait);
  }

  async findAllModulesIn(nodeModulesPath: string, prefix = ''): Promise<void> {
    // Some package managers use symbolic links when installing node modules
    // we need to be sure we've never tested the a package before by resolving
    // all symlinks in the path and testing against a set
    const realNodeModulesPath = await fs.promises.realpath(nodeModulesPath);
    if (this.realNodeModulesPaths.has(realNodeModulesPath)) {
      return;
    }
    this.realNodeModulesPaths.add(realNodeModulesPath);

    d('scanning:', realNodeModulesPath);

    for (const modulePath of await promisifiedGracefulFs.readdir(realNodeModulesPath)) {
      // Ignore the magical .bin directory
      if (modulePath === '.bin') continue;

      const subPath = path.resolve(nodeModulesPath, modulePath);

      // Ensure that we don't mark modules as needing to be rebuilt more than once
      // by ignoring / resolving symlinks
      let realPath: string;
      try {
        realPath = await fs.promises.realpath(subPath);
      } catch (error) {
        // pnpm leaves dangling symlinks when modules are removed
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          const stat = await fs.promises.lstat(subPath);
          if (stat.isSymbolicLink()) {
            continue;
          }
        }
        throw error;
      }

      if (this.realModulePaths.has(realPath)) {
        continue;
      }
      this.realModulePaths.add(realPath);

      const moduleName = `${prefix}${modulePath}`;
      if (this.prodDeps.has(moduleName) && (!this.onlyModules || this.onlyModules.includes(moduleName))) {
        this.modulesToRebuild.push(realPath);
      }

      if (modulePath.startsWith('@')) {
        await this.findAllModulesIn(realPath, `${modulePath}/`);
      }

      if (fs.existsSync(path.resolve(nodeModulesPath, modulePath, 'node_modules'))) {
        await this.findAllModulesIn(path.resolve(realPath, 'node_modules'));
      }
    }
  }
}
