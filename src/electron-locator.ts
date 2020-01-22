import * as fs from 'fs';
import * as path from 'path';
import { searchModuleSync } from './search-module';

const possibleModuleNames = ['electron', 'electron-prebuilt', 'electron-prebuilt-compile'];
const relativeNodeModulesDir = path.resolve(__dirname, '..', '..');

function locateModulesInWorkspace(projectRootPath?: string)

function locateModules(pathMapper: (moduleName: string) => string | null): string[] {
  const possibleModulePaths = possibleModuleNames.map(pathMapper);
  return possibleModulePaths.filter((modulePath) => modulePath && fs.existsSync(path.join(modulePath, 'package.json'))) as string[];
}

function locateSiblingModules(): string[] {
  return locateModules((moduleName) => path.join(relativeNodeModulesDir, moduleName));
}

function locateModulesByRequire(): string[] | null {
  return locateModules((moduleName) => {
    try {
      return path.resolve(require.resolve(path.join(moduleName, 'package.json')), '..');
    } catch (error) {
      return null;
    }
  });
}

export function locateElectronModule(projectRootPath?: string): string | null {
  let electronPath: string | null = null;

  // Attempt to locate modules by path
  let foundModule = possibleModuleNames.some((moduleName) => {
    electronPath = searchModuleSync(
      process.cwd(),
      moduleName,
      projectRootPath
    )[0];

    if (electronPath) {
      return fs.existsSync(path.join(electronPath, 'package.json'));
    } else {
      return false;
    }
  });

  if (foundModule) return electronPath;

  let foundModules: string[] | null = locateSiblingModules();
  if (foundModules.length > 0) {
    return foundModules[0];
  }

  foundModules = locateModulesByRequire();
  if (foundModules && foundModules.length > 0) {
    return foundModules[0];
  }

  return null;
}
