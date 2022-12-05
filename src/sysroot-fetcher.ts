import * as crypto from 'crypto';
import debug from 'debug';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as tar from 'tar';

import { ELECTRON_GYP_DIR } from './constants';
import { fetch } from './fetcher';

const d = debug('electron-rebuild');

const sysrootArchAliases = {
  x64: 'amd64',
  ia32: 'i386',
}

const SYSROOT_BASE_URL = 'https://dev-cdn.electronjs.org/linux-sysroots'

export async function downloadLinuxSysroot(electronVersion: string, targetArch: string): Promise<string> {
  d('fetching sysroot for Electron:', electronVersion);
  const sysrootDir = path.resolve(ELECTRON_GYP_DIR, `${electronVersion}-sysroot`);
  if (await fs.pathExists(path.resolve(sysrootDir, 'lib'))) return sysrootDir;
  if (!await fs.pathExists(sysrootDir)) await fs.mkdirp(sysrootDir);

  const linuxArch = sysrootArchAliases[targetArch] || targetArch;
  const electronSysroots = JSON.parse(await fetch(`https://raw.githubusercontent.com/electron/electron/v${electronVersion}/script/sysroots.json`, 'text'));

  const { Sha1Sum: sha, Tarball: fileName } = electronSysroots[`sid_${linuxArch}`] || electronSysroots[`bullseye_${linuxArch}`];
  const sysrootURL = `${SYSROOT_BASE_URL}/${sha}/${fileName}`;
  let sysrootBuffer = await fetch(sysrootURL, 'buffer');

  const actualSha = crypto.createHash('SHA1').update(sysrootBuffer).digest('hex');
  d('expected sha:', sha);
  d('actual sha:', actualSha);
  if (sha !== actualSha) throw new Error(`Attempted to download the linux sysroot for ${electronVersion} but the SHA checksum did not match`);

  d('decompressing sysroot');
  sysrootBuffer = await new Promise<Buffer>(resolve => require('lzma-native').decompress(sysrootBuffer, undefined, (result: Buffer) => resolve(result))); // eslint-disable-line

  const tmpTarFile = path.resolve(ELECTRON_GYP_DIR, `${electronVersion}-${fileName}`);
  if (await fs.pathExists(tmpTarFile)) await fs.remove(tmpTarFile);
  await fs.writeFile(tmpTarFile, sysrootBuffer);

  d('extracting sysroot');
  await tar.x({
    file: tmpTarFile,
    cwd: sysrootDir,
  });

  return sysrootDir;
}
