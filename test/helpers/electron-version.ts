import fs from 'graceful-fs';
import path from 'node:path';
import electron from 'electron';

function electronVersionPath() {
  const electronPath = electron as unknown as string;
  if (process.platform === 'darwin') {
    return path.resolve(path.dirname(electronPath), '..', '..', '..', 'version');
  } else {
    return path.join(path.dirname(electronPath), 'version');
  }
}

export function getExactElectronVersionSync(): string {
  return fs.readFileSync(electronVersionPath()).toString().trim();
}
