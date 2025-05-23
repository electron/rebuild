import cp from 'node:child_process';
import debug from 'debug';
import fs from 'graceful-fs';
import path from 'node:path';
import tar from 'tar';
import zlib from 'node:zlib';
import { ELECTRON_GYP_DIR } from './constants.js';
import { fetch } from './fetcher.js';
import { downloadLinuxSysroot } from './sysroot-fetcher.js';
import { promisifiedGracefulFs } from './promisifiedGracefulFs.js';

const d = debug('electron-rebuild');

const CDS_URL = 'https://commondatastorage.googleapis.com/chromium-browser-clang';

function getPlatformUrlPrefix(hostOS: string, hostArch: string) {
  const prefixMap: Record<string, string> = {
      'linux': 'Linux_x64',
      'darwin': 'Mac',
      'win32': 'Win',
  };
  let prefix = prefixMap[hostOS];
  if (prefix === 'Mac' && hostArch === 'arm64') {
    prefix = 'Mac_arm64';
  }
  return CDS_URL + '/' + prefix + '/';
}

function getClangDownloadURL(packageFile: string, packageVersion: string, hostOS: string, hostArch: string) {
  const cdsFile = `${packageFile}-${packageVersion}.tgz`;
  return getPlatformUrlPrefix(hostOS, hostArch) + cdsFile;
}

function getSDKRoot(): string {
  if (process.env.SDKROOT) return process.env.SDKROOT;
  const output = cp.execFileSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path']);
  return output.toString().trim();
}

export async function getClangEnvironmentVars(electronVersion: string, targetArch: string): Promise<{ env: Record<string, string>; args: string[] }> {
  const clangDownloadDir = await downloadClangVersion(electronVersion);

  const clangDir = path.resolve(clangDownloadDir, 'bin');
  const clangArgs: string[] = [];
  if (process.platform === 'darwin') {
    clangArgs.push('-isysroot', getSDKRoot());
  }

  const gypArgs = [];
  if (process.platform === 'win32') {
    console.log(await promisifiedGracefulFs.readdir(clangDir));
    gypArgs.push(`/p:CLToolExe=clang-cl.exe`, `/p:CLToolPath=${clangDir}`);
  }

  if (process.platform === 'linux') {
    const sysrootPath = await downloadLinuxSysroot(electronVersion, targetArch);
    clangArgs.push('--sysroot', sysrootPath);
  }

  return {
    env: {
      CC: `"${path.resolve(clangDir, 'clang')}" ${clangArgs.join(' ')}`,
      CXX: `"${path.resolve(clangDir, 'clang++')}" ${clangArgs.join(' ')}`,
    },
    args: gypArgs,
  };
}

function clangVersionFromRevision(update: string): string | null {
  const regex = /CLANG_REVISION = '([^']+)'\nCLANG_SUB_REVISION = (\d+)\n/g;
  const clangVersionMatch = regex.exec(update);
  if (!clangVersionMatch) return null;
  const [,clangVersion, clangSubRevision] = clangVersionMatch;
  return `${clangVersion}-${clangSubRevision}`;
}

function clangVersionFromSVN(update: string): string | null {
  const regex = /CLANG_REVISION = '([^']+)'\nCLANG_SVN_REVISION = '([^']+)'\nCLANG_SUB_REVISION = (\d+)\n/g;
  const clangVersionMatch = regex.exec(update);
  if (!clangVersionMatch) return null;
  const [,clangVersion, clangSvn, clangSubRevision] = clangVersionMatch;
  return `${clangSvn}-${clangVersion.substr(0, 8)}-${clangSubRevision}`;
}

async function downloadClangVersion(electronVersion: string) {
  d('fetching clang for Electron:', electronVersion);
  const clangDirPath = path.resolve(ELECTRON_GYP_DIR, `${electronVersion}-clang`);
  if (fs.existsSync(path.resolve(clangDirPath, 'bin', 'clang'))) return clangDirPath;
  await fs.promises.mkdir(ELECTRON_GYP_DIR, { recursive: true });

  const electronDeps = await fetch(`https://raw.githubusercontent.com/electron/electron/v${electronVersion}/DEPS`, 'text');
  const chromiumRevisionExtractor = /'chromium_version':\n\s+'([^']+)/g;
  const chromiumRevisionMatch = chromiumRevisionExtractor.exec(electronDeps);
  if (!chromiumRevisionMatch) throw new Error('Failed to determine Chromium revision for given Electron version');
  const chromiumRevision = chromiumRevisionMatch[1];
  d('fetching clang for Chromium:', chromiumRevision);

  const base64ClangUpdate = await fetch(`https://chromium.googlesource.com/chromium/src.git/+/${chromiumRevision}/tools/clang/scripts/update.py?format=TEXT`, 'text');
  const clangUpdate = Buffer.from(base64ClangUpdate, 'base64').toString('utf8');

  const clangVersionString = clangVersionFromRevision(clangUpdate) || clangVersionFromSVN(clangUpdate);
  if (!clangVersionString) throw new Error('Failed to determine Clang revision from Electron version');
  d('fetching clang:', clangVersionString);

  const clangDownloadURL = getClangDownloadURL('clang', clangVersionString, process.platform, process.arch);

  const contents = await fetch(clangDownloadURL, 'buffer');
  d('deflating clang');
  zlib.deflateSync(contents);
  const tarPath = path.resolve(ELECTRON_GYP_DIR, `${electronVersion}-clang.tar`);
  if (fs.existsSync(tarPath)) await fs.promises.rm(tarPath, { recursive: true, force: true });
  await promisifiedGracefulFs.writeFile(tarPath, Buffer.from(contents));
  await fs.promises.mkdir(clangDirPath, { recursive: true });
  d('tar running on clang');
  await tar.x({
    file: tarPath,
    cwd: clangDirPath,
  });
  await fs.promises.rm(tarPath, { recursive: true, force: true });
  d('cleaning up clang tar file');
  return clangDirPath;
}
