import * as fs from 'fs';
import * as path from 'path';

const possibleModuleNames = ['electron', 'electron-prebuilt', 'electron-prebuilt-compile'];
const relativeNodeModulesDir = path.resolve(__dirname, '..', '..');

function locateModules(pathMapper: (moduleName: string) => string | null) {
  const possibleModulePaths = possibleModuleNames.map(pathMapper);
  return possibleModulePaths.filter((modulePath) => modulePath && fs.existsSync(path.join(modulePath, 'package.json')));
}

function locateSiblingModules() {
  return locateModules((moduleName) => path.join(relativeNodeModulesDir, moduleName));
}

function locateModulesByRequire() {
  return locateModules((moduleName) => {
    try {
      return path.resolve(require.resolve(path.join(moduleName, 'package.json')), '..');
    } catch (error) {
      return null;
    }
  });
}

export function locateElectronModule(): string | null {
  let foundModules = locateSiblingModules();
  if (foundModules.length > 0) {
    return foundModules[0];
  }

  foundModules = locateModulesByRequire();
  if (foundModules.length > 0) {
    return foundModules[0];
  }

  return null;
}
