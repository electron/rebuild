import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as zlib from 'zlib';

class Snap {
  constructor(public hash: string, public data: Buffer) {}
}

interface Snapshot {
  [key: string]: Snap | Snapshot;
}

const takeSnapshot = async (dir: string, relativeTo = dir): Promise<Snapshot> => {
  const snap: Snapshot = {};
  await Promise.all((await fs.readdir(dir)).map(async (child) => {
    if (child === 'node_modules') return;
    const childPath = path.resolve(dir, child);
    const relative = path.relative(relativeTo, childPath);
    if ((await fs.stat(childPath)).isDirectory()) {
      snap[relative] = await takeSnapshot(childPath, relativeTo);
    } else {
      const data = await fs.readFile(childPath);
      snap[relative] = new Snap(
        crypto.createHash('SHA256').update(data).digest('hex'),
        data,
      );
    }
  }));
  return snap;
};

const writeSnapshot = async (diff: Snapshot, dir: string): Promise<void> => {
  for (const key in diff) {
    if (diff[key] instanceof Snap) {
      await fs.mkdirp(path.dirname(path.resolve(dir, key)));
      await fs.writeFile(path.resolve(dir, key), (diff[key] as Snap).data);
    } else {
      await fs.mkdirp(path.resolve(dir, key));
      await writeSnapshot(diff[key] as Snapshot, dir);
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serialize = (snap: Snapshot): any => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonReady: any = {};
  for (const key in snap) {
    if (snap[key] instanceof Snap) {
      const s = snap[key] as Snap;
      jsonReady[key] = {
        __isSnap: true,
        hash: s.hash,
        data: s.data.toString('base64')
      };
    } else {
      jsonReady[key] = serialize(snap[key] as Snapshot);
    }
  }
  return jsonReady;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unserialize = (jsonReady: any): Snapshot => {
  const snap: Snapshot = {};
  for (const key in jsonReady) {
    if (jsonReady[key].__isSnap) {
      snap[key] = new Snap(
        jsonReady[key].hash,
        Buffer.from(jsonReady[key].data, 'base64')
      );
    } else {
      snap[key] = unserialize(jsonReady[key]);
    }
  }
  return snap;
};

export const cacheModuleState = async (dir: string, cachePath: string, key: string): Promise<void> => {
  const snap = await takeSnapshot(dir);

  const moduleBuffer = Buffer.from(JSON.stringify(serialize(snap)));
  const zipped = await new Promise(resolve => zlib.gzip(moduleBuffer, (_, result) => resolve(result)));
  await fs.mkdirp(cachePath);
  await fs.writeFile(path.resolve(cachePath, key), zipped);
};

type ApplyDiffFunction = (dir: string) => Promise<void>;

export const lookupModuleState = async (cachePath: string, key: string): Promise<ApplyDiffFunction | boolean> => {
  if (await fs.pathExists(path.resolve(cachePath, key))) {
    return async function applyDiff(dir: string): Promise<void> {
      const zipped = await fs.readFile(path.resolve(cachePath, key));
      const unzipped: Buffer = await new Promise(resolve => { zlib.gunzip(zipped, (_, result) => resolve(result)); });
      const diff = unserialize(JSON.parse(unzipped.toString()));
      await writeSnapshot(diff, dir);
    };
  }
  return false;
};
