import fs from 'fs';
import path from 'path';

export const locateElectronPrebuilt = () => {
  let electronPath = path.join(__dirname, '..', '..', 'electron');
  if (!fs.existsSync(electronPath)) {
    electronPath = path.join(__dirname, '..', '..', 'electron-prebuilt');
  }
  if (!fs.existsSync(electronPath)) {
    electronPath = path.join(__dirname, '..', '..', 'electron-prebuilt-compile');
  }
  if (!fs.existsSync(electronPath)) {
    try {
      electronPath = path.join(require.resolve('electron'), '..');
    } catch (e) {
      // Module not found, do nothing
    }
  }
  if (!fs.existsSync(electronPath)) {
    try {
      electronPath = path.join(require.resolve('electron-prebuilt'), '..');
    } catch (e) {
      // Module not found, do nothing
    }
  }
  if (!fs.existsSync(electronPath)) {
    electronPath = null;
  }
  return electronPath;
}
