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
    } catch { // eslint-disable-line no-empty
    }
  }

  return null
}

export async function locateElectronModule(
  projectRootPath: string | undefined = undefined,
  startDir: string | undefined = undefined,
): Promise<string | null> {
  startDir ??= process.cwd();

  for (const moduleName of electronModuleNames) {
    const electronPaths = await searchForModule(startDir, moduleName, projectRootPath);
    const electronPath = electronPaths.find(async (ePath: string) => await fs.pathExists(path.join(ePath, 'package.json')));

    if (electronPath) {
      return electronPath;
    }
  }

  return locateModuleByRequire();
}
