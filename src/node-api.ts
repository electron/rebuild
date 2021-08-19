import { fromElectronVersion as napiVersionFromElectronVersion } from 'node-api-version';

export function ensureElectronSupportsNodeAPI(moduleName: string, electronVersion: string): void {
  getElectronNodeAPIVersion(moduleName, electronVersion);
}

export function getElectronNodeAPIVersion(moduleName: string, electronVersion: string): number {
    const electronNapiVersion = napiVersionFromElectronVersion(electronVersion);

    if (!electronNapiVersion) {
      throw new Error(`Native module '${moduleName}' requires Node-API but Electron v${electronVersion} does not support Node-API`);
    }

    return electronNapiVersion;
}
