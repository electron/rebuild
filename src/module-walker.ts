import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';

import { readPackageJson } from './read-package-json';
import { searchForModule, searchForNodeModules } from './search-module';

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
      this.prodDeps[key] = true;
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
    if (!await fs.pathExists(modulePath)) {
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
      if (this.prodDeps[key]) {
        continue;
      }

      this.prodDeps[key] = true;

      moduleWait.push(this.findModule(key, modulePath, callback));
    }

    await Promise.all(moduleWait);
  }

  async findAllModulesIn(nodeModulesPath: string, prefix = ''): Promise<void> {
    // Some package managers use symbolic links when installing node modules
    // we need to be sure we've never tested the a package before by resolving
    // all symlinks in the path and testing against a set
    const realNodeModulesPath = await fs.realpath(nodeModulesPath);
    if (this.realNodeModulesPaths.has(realNodeModulesPath)) {
      return;
    }
    this.realNodeModulesPaths.add(realNodeModulesPath);

    d('scanning:', realNodeModulesPath);

    for (const modulePath of await fs.readdir(realNodeModulesPath)) {
      // Ignore the magical .bin directory
      if (modulePath === '.bin') continue;
      // Ensure that we don't mark modules as needing to be rebuilt more than once
      // by ignoring / resolving symlinks
      const realPath = await fs.realpath(path.resolve(nodeModulesPath, modulePath));

      if (this.realModulePaths.has(realPath)) {
        continue;
      }
      this.realModulePaths.add(realPath);

      if (this.prodDeps[`${prefix}${modulePath}`] && (!this.onlyModules || this.onlyModules.includes(modulePath))) {
        this.modulesToRebuild.push(realPath);
      }

      if (modulePath.startsWith('@')) {
        await this.findAllModulesIn(realPath, `${modulePath}/`);
      }

      if (await fs.pathExists(path.resolve(nodeModulesPath, modulePath, 'node_modules'))) {
        await this.findAllModulesIn(path.resolve(realPath, 'node_modules'));
      }
    }
  }
}
