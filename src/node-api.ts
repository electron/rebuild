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

export function getNapiVersion(
  moduleName: string,
  electronVersion: string,
  moduleNapiVersions: number[]
): number {
  const electronNapiVersion = getElectronNodeAPIVersion(moduleName, electronVersion);

  // Filter out Node-API versions that are too high
  const filteredVersions = moduleNapiVersions.filter((v) => (v <= electronNapiVersion));

  if (filteredVersions.length === 0) {
    throw new Error(`Native module '${moduleName}' supports Node-API versions ${moduleNapiVersions} but Electron v${electronVersion} only supports Node-API v${electronNapiVersion}`)
  }

  return Math.max(...filteredVersions);
}
