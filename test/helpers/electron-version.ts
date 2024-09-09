import * as fs from 'fs-extra';
import * as path from 'path';

function electronVersionPath() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electronPath = require('electron');
  if (process.platform === 'darwin') {
    return path.resolve(path.dirname(electronPath), '..', '..', '..', 'version');
  } else {
    return path.join(path.dirname(electronPath), 'version');
  }
}

export function getExactElectronVersionSync(): string {
  return fs.readFileSync(electronVersionPath()).toString().trim();
}
