import * as fs from 'fs';
import * as path from 'path';
import { searchModule } from './search-module';

const electronModuleNames = ['electron', 'electron-prebuilt', 'electron-prebuilt-compile'];
const relativeNodeModulesDir = path.resolve(__dirname, '..', '..');

function locateModules(pathMapper: (moduleName: string) => string | null): string[] {
  const possibleModulePaths = electronModuleNames.map(pathMapper);
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

export async function locateElectronModule(projectRootPath?: string): string | null {
  let electronPath: string | null = null;

  // Attempt to locate modules by path
  const foundModule = electronModuleNames.some((moduleName) => {
    electronPath = await searchModule(
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

  const siblingModules: string[] | null = locateSiblingModules();
  if (siblingModules.length > 0) {
    return siblingModules[0];
  }

  const requiredModules = locateModulesByRequire();
  if (requiredModules && requiredModules.length > 0) {
    return requiredModules[0];
  }

  return null;
}
