import * as fs from 'fs-extra';
import * as path from 'path';
import { searchForModule } from './search-module';

const electronModuleNames = ['electron', 'electron-prebuilt', 'electron-prebuilt-compile'];

async function locateModuleByRequire(): Promise<string | null> {
  for (const moduleName of electronModuleNames) {
    try {
      const modulePath = path.resolve(require.resolve(path.join(moduleName, 'package.json')), '..');
      if (await fs.pathExists(path.join(modulePath, 'package.json'))) {
        return modulePath;
      }
    } catch (_error) { // eslint-disable-line no-empty
    }
  }

  return null
}

export async function locateElectronModule(projectRootPath?: string): Promise<string | null> {
  for (const moduleName of electronModuleNames) {
    const electronPath = await searchForModule(process.cwd(), moduleName, projectRootPath)[0];

    if (electronPath && await fs.pathExists(path.join(electronPath, 'package.json'))) {
      return electronPath;
    }
  }

  return locateModuleByRequire();
}
