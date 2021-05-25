import * as debug from 'debug';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as tar from 'tar';
import * as zlib from 'zlib';
import { downloadArtifact } from '@electron/get';
import { ELECTRON_GYP_DIR } from './constants';
import { fetch } from './fetcher';

const d = debug('electron-rebuild');

export async function downloadLibcxxHeaders(electronVersion: string, name: string): Promise<string> {
  const lib_name = name.replace(/\+/g, 'x');
  const headersDirPath = path.resolve(ELECTRON_GYP_DIR, `${electronVersion}-${lib_name}_headers`);
  if (await fs.pathExists(path.resolve(headersDirPath, 'include'))) return headersDirPath;
  if (!await fs.pathExists(ELECTRON_GYP_DIR)) await fs.mkdirp(ELECTRON_GYP_DIR);

  // download libcxx_headers.zip / libcxxabi_headers.zip
  const headerZipPath = await downloadArtifact({
    version: electronVersion,
    platform: 'linux',
    artifactName: `${lib_name}_headers`,
  });

  const contents = await fetch(headerZipPath, 'buffer')
  d(`deflating ${lib_name}_headers`);
  zlib.deflateSync(contents);
  const tarPath = path.resolve(ELECTRON_GYP_DIR, `${electronVersion}-${lib_name}_headers.tar`);
  if (await fs.pathExists(tarPath)) await fs.remove(tarPath)
  await fs.writeFile(tarPath, Buffer.from(contents));
  await fs.mkdirp(headersDirPath);

  d(`tar running on ${lib_name}_headers`);
  await tar.x({
    file: tarPath,
    cwd: headersDirPath,
  });

  await fs.remove(tarPath);
  d(`cleaning up ${lib_name}_headers tar file`);
  return headersDirPath;
}

export async function downloadLibcxxObjects(electronVersion: string, targetArch: string): Promise<string> {
  const libcxxObjectsDirPath = path.resolve(ELECTRON_GYP_DIR, 'libcxx-objects');
  
  if (await fs.pathExists(path.resolve(libcxxObjectsDirPath, 'libc++.a'))) return libcxxObjectsDirPath;
  if (!await fs.pathExists(ELECTRON_GYP_DIR)) await fs.mkdirp(ELECTRON_GYP_DIR);

  // download objects (e.g. libcxx-objects-v13.0.0-linux-x64.zip)
  const headerZipPath = await downloadArtifact({
    version: electronVersion,
    platform: 'linux',
    artifactName: 'libcxx-objects',
    arch: targetArch,
  });

  const contents = await fetch(headerZipPath, 'buffer')
  d(`deflating libcxx-objects-linux-${targetArch}`);
  zlib.deflateSync(contents);
  const tarPath = path.resolve(ELECTRON_GYP_DIR, `libcxx-objects-v${electronVersion}-linux-${targetArch}.tar`);
  if (await fs.pathExists(tarPath)) await fs.remove(tarPath)
  await fs.writeFile(tarPath, Buffer.from(contents));
  await fs.mkdirp(libcxxObjectsDirPath);

  d(`tar running on libcxx-objects-linux-${targetArch}`);
  await tar.x({
    file: tarPath,
    cwd: libcxxObjectsDirPath,
  });

  await fs.remove(tarPath);
  d(`cleaning up libcxx-objects-linux-${targetArch} tar file`);
  return libcxxObjectsDirPath;
}
