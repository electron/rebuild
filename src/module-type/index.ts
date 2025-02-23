import fs from 'graceful-fs';
import path from 'node:path';

import { NodeAPI } from '../node-api';
import { readPackageJson } from '../read-package-json';
import { IRebuilder } from '../types';

type PackageJSONValue = string | Record<string, unknown>;

export class NativeModule {
  protected rebuilder: IRebuilder;
  private _moduleName: string | undefined;
  protected modulePath: string;
  public nodeAPI: NodeAPI;
  private packageJSON!: Record<string, PackageJSONValue | undefined>;

  constructor(rebuilder: IRebuilder, modulePath: string) {
    this.rebuilder = rebuilder;
    this.modulePath = modulePath;
    this.nodeAPI = new NodeAPI(this.moduleName, this.rebuilder.electronVersion);
  }

  get moduleName(): string {
    if (!this._moduleName) {
      const basename = path.basename(this.modulePath);
      const parentDir = path.basename(path.dirname(this.modulePath));
      if (parentDir.startsWith('@')) {
        this._moduleName = `${parentDir}/${basename}`;
      }

      this._moduleName = basename;
    }

    return this._moduleName;
  }

  async packageJSONFieldWithDefault(key: string, defaultValue: PackageJSONValue): Promise<PackageJSONValue> {
    const result = await this.packageJSONField(key);
    return result === undefined ? defaultValue : result;
  }

  async packageJSONField(key: string): Promise<PackageJSONValue | undefined> {
    this.packageJSON ||= await readPackageJson(this.modulePath);

    return this.packageJSON[key];
  }

  async getSupportedNapiVersions(): Promise<number[] | undefined> {
    const binary = (await this.packageJSONFieldWithDefault(
      'binary',
      {}
    )) as Record<string, number[]>;

    return binary?.napi_versions;
  }

  /**
   * Search dependencies for package using either `packageName` or
   * `@namespace/packageName` in the case of forks.
   */
  async findPackageInDependencies(packageName: string, packageProperty = 'dependencies'): Promise<string | null> {
    const dependencies = await this.packageJSONFieldWithDefault(packageProperty, {});
    if (typeof dependencies !== 'object') return null;

    // Look for direct dependency match
    // eslint-disable-next-line no-prototype-builtins
    if (dependencies.hasOwnProperty(packageName)) return packageName;

    const forkedPackage = Object.keys(dependencies).find(dependency =>
      dependency.startsWith('@') && dependency.endsWith(`/${packageName}`));

    return forkedPackage || null;
  }
}

export async function locateBinary(basePath: string, suffix: string): Promise<string | null> {
  let parentPath = basePath;
  let testPath: string | undefined;

  while (testPath !== parentPath) {
    testPath = parentPath;
    const checkPath = path.resolve(testPath, suffix);
    if (fs.existsSync(checkPath)) {
      return checkPath;
    }
    parentPath = path.resolve(testPath, '..');
  }

  return null;
}
