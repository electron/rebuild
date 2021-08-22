import fs from 'fs-extra';
import path from 'path';

import { NodeAPI } from '../node-api';
import { readPackageJson } from '../read-package-json';
import { Rebuilder } from '../rebuild';

type PackageJSONValue = string | Record<string, unknown>;

export class NativeModule {
  protected rebuilder: Rebuilder;
  private _moduleName: string | undefined;
  protected modulePath: string
  public nodeAPI: NodeAPI;
  private packageJSON: Record<string, PackageJSONValue | undefined>;

  constructor(rebuilder: Rebuilder, modulePath: string) {
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
}

export async function locateBinary(basePath: string, suffix: string): Promise<string | null> {
  let parentPath = basePath;
  let testPath: string | undefined;

  while (testPath !== parentPath) {
    testPath = parentPath;
    const checkPath = path.resolve(testPath, suffix);
    if (await fs.pathExists(checkPath)) {
      return checkPath;
    }
    parentPath = path.resolve(testPath, '..');
  }

  return null;
}
