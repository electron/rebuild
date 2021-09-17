import crypto from 'crypto';
import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';
import zlib from 'zlib';

const d = debug('electron-rebuild');

// Update this number if you change the caching logic to ensure no bad cache hits
const ELECTRON_REBUILD_CACHE_ID = 1;

class Snap {
  constructor(public hash: string, public data: Buffer) {}
}

interface Snapshot {
  [key: string]: Snap | Snapshot;
}

type HashTree = { [path: string]: string | HashTree };

type CacheOptions = {
  ABI: string;
  arch: string;
  debug: boolean;
  electronVersion: string;
  headerURL: string;
  modulePath: string;
};

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

function dHashTree(tree: HashTree, hash: crypto.Hash): void {
  for (const key of Object.keys(tree).sort()) {
    hash.update(key);
    if (typeof tree[key] === 'string') {
      hash.update(tree[key] as string);
    } else {
      dHashTree(tree[key] as HashTree, hash);
    }
  }
}

async function hashDirectory(dir: string, relativeTo?: string): Promise<HashTree> {
  relativeTo ??= dir;
  d('hashing dir', dir);
  const dirTree: HashTree = {};
  await Promise.all((await fs.readdir(dir)).map(async (child) => {
    d('found child', child, 'in dir', dir);
    // Ignore output directories
    if (dir === relativeTo && (child === 'build' || child === 'bin')) return;
    // Don't hash nested node_modules
    if (child === 'node_modules') return;

    const childPath = path.resolve(dir, child);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const relative = path.relative(relativeTo!, childPath);
    if ((await fs.stat(childPath)).isDirectory()) {
      dirTree[relative] = await hashDirectory(childPath, relativeTo);
    } else {
      dirTree[relative] = crypto.createHash('SHA256').update(await fs.readFile(childPath)).digest('hex');
    }
  }));

  return dirTree;
}

export async function generateCacheKey(opts: CacheOptions): Promise<string> {
  const tree = await hashDirectory(opts.modulePath);
  const hasher = crypto.createHash('SHA256')
    .update(`${ELECTRON_REBUILD_CACHE_ID}`)
    .update(path.basename(opts.modulePath))
    .update(opts.ABI)
    .update(opts.arch)
    .update(opts.debug ? 'debug' : 'not debug')
    .update(opts.headerURL)
    .update(opts.electronVersion);
  dHashTree(tree, hasher);
  const hash = hasher.digest('hex');
  d('calculated hash of', opts.modulePath, 'to be', hash);
  return hash;
}
