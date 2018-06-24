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

const takeSnapshot = async (dir: string, relativeTo = dir) => {
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

const calcDiff = (first: Snapshot, second: Snapshot) => {
  const diff: Snapshot = {};
  if (!first || !second) return diff;
  for (const key in first) {
    if (first[key] instanceof Snap && second[key] instanceof Snap) {
      if ((first[key] as Snap).hash !== (second[key] as Snap).hash) {
        diff[key] = second[key];
      }
    } else if (first[key] instanceof Snap) {
      // Do nothing
    } else if (second[key] instanceof Snap) {
      diff[key] = second[key];
    } else {
      diff[key] = calcDiff(first[key] as Snapshot, second[key] as Snapshot);
    }
  }
  for (const key in second) {
    if (!first[key]) {
      diff[key] = second[key];
    }
  }
  return diff;
};

const writeDiff = async (diff: Snapshot, dir: string) => {
  for (const key in diff) {
    if (diff[key] instanceof Snap) {
      await fs.mkdirp(path.dirname(path.resolve(dir, key)));
      await fs.writeFile(path.resolve(dir, key), (diff[key] as Snap).data);
    } else {
      await fs.mkdirp(path.resolve(dir, key));
      await writeDiff(diff[key] as Snapshot, dir);
    }
  }
};

const serialize = (snap: Snapshot) => {
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

const unserialize = (jsonReady: any) => {
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

export const prepare = async (dir: string) => {
  const initial = await takeSnapshot(dir);
  return async function collect(cachePath: string, key: string) {
    const post = await takeSnapshot(dir);
    const diff = await calcDiff(initial, post);
    await fs.mkdirp(cachePath);
    const moduleBuffer = Buffer.from(JSON.stringify(serialize(diff)));
    const zipped = await new Promise(resolve => zlib.gzip(moduleBuffer, (_, result) => resolve(result)));
    await fs.writeFile(path.resolve(cachePath, key), zipped);
  };
};

export const cacheModuleState = async (dir: string, cachePath: string, key: string) => {
  const snap = await takeSnapshot(dir);

  const moduleBuffer = Buffer.from(JSON.stringify(serialize(snap)));
  const zipped = await new Promise(resolve => zlib.gzip(moduleBuffer, (_, result) => resolve(result)));
  await fs.mkdirp(cachePath);
  await fs.writeFile(path.resolve(cachePath, key), zipped);
};

export const lookup = async (cachePath: string, key: string) => {
  if (await fs.pathExists(path.resolve(cachePath, key))) {
    return async function applyDiff(dir: string) {
      const zipped = await fs.readFile(path.resolve(cachePath, key));
      const unzipped = await new Promise(resolve => zlib.gunzip(zipped, (_, result) => resolve(result)));
      const diff = unserialize(JSON.parse(unzipped.toString()));
      await writeDiff(diff, dir);
    };
  }
  return false;
};
