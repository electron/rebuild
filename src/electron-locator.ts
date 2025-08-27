import fs from 'graceful-fs';
import path from 'node:path';
import { searchForModule } from './search-module.js';
import { fileURLToPath } from 'node:url';

const electronModuleNames = ['electron',  'electron-prebuilt-compile'];

async function locateModuleByImport(): Promise<string | null> {
  for (const moduleName of electronModuleNames) {
    try {
      const modulePath = path.resolve(fileURLToPath(import.meta.resolve(path.join(moduleName, 'package.json'))), '..');
      if (fs.existsSync(path.join(modulePath, 'package.json'))) {
        return modulePath;
      }
    } catch (err) { // eslint-disable-line no-empty
      console.log(err);
    }
  }

  return null;
}

export async function locateElectronModule(
  projectRootPath: string | undefined = undefined,
  startDir: string | undefined = undefined,
): Promise<string | null> {
  startDir ??= process.cwd();

  for (const moduleName of electronModuleNames) {
    const electronPaths = await searchForModule(startDir, moduleName, projectRootPath);
    const electronPath = electronPaths.find((ePath: string) => fs.existsSync(path.join(ePath, 'package.json')));

    if (electronPath) {
      return electronPath;
    }
  }

  return locateModuleByImport();
}
