import promisify from './promisify';
import path from 'path';
import os from 'os';
import { md5 } from './hash';

const fs = promisify(require('fs'));

/**
 * Returns the path to the quick-build cache for a given nodeModules folder
 * @param {string} nodeModulesPath
 * @return {string} /path/to/quick-build-cache
 */
export const getPackageCachePath = (nodeModulesPath) => {
    const pathHash = md5(path.resolve(nodeModulesPath));
    return path.resolve(os.tmpdir(), 'electron-rebuild-cache-' + pathHash);
};

/**
 * Returns the quick-build cache
 * @param {string} nodeModulesPath
 * @return {Promise} resolves => quick-build cache
 */
export async function getCachedBuildVersions(nodeModulesPath) {
      if (!nodeModulesPath) {
          throw new ReferenceError('nodeModulesPath missing');
      }
      const cachePath = getPackageCachePath(nodeModulesPath);
      try {
          return await fs.readFile(cachePath, 'utf8').then(cache => JSON.parse(cache));
      } catch(err) {
        if (err && err.code === 'ENOENT') {
          // no existing cache. upsert it to disk in a hot moment
        } else {
          console.error(err.message);
          throw err;
        }
      }
      try {
          return await upsertCache(nodeModulesPath);
      } catch(err) {
          console.error('unable to create electron-rebuild cache: ' + err.message);
          throw err;
      }
}

/**
 * Filters a list of file names to include only those that point to folders
 * within the provided src folder
 * @param {array} fnames list of file or folder names
 * @param {string} nodeModulesPath
 * @return {Promise} resolves => ['names', 'of', 'folders']
 */
async function filterFsFolders(fnames, nodeModulesPath) {
  try {
    let stats = fnames.map(file => fs.stat(path.join(nodeModulesPath, file)));
    stats = await Promise.all(stats);
    return stats.map((stat, ndx) => {
        if (stat.isDirectory()) {
            return {
                package: fnames[ndx],
                stat
            };
        }
    }).filter(f => f);
  } catch(err) {
    console.error(`unable to read folders in node_modules directory: ${nodeModulesPath}`);
    throw err;
  }
}

/**
 * Returns all of the folders in the provided node_modules,
 * and `stat` objects for each
 * @param {string} nodeModulesPath
 * @return {Promise} resolves => [{ name: 'folder-name', stat: Stat}]
 */
export async function getInstalledModules(nodeModulesPath) {
    const nodeModules = await fs.readdir(nodeModulesPath);
    const filesOrFolders = nodeModules.filter(name => !name.match(/^\./)); // ignore hidden
    return filterFsFolders(filesOrFolders, nodeModulesPath);
}

/**
 * Creates or updates the quick-rebuild cache
 * @param {string} nodeModulesPath
 * @param {array=} cache values [{ package: ..., nodeVersion: ..., ctime: ... }]
 * @return {Promise} resolves => cache
 */
export async function upsertCache(nodeModulesPath, cache=[]) {
    const verb = cache.length ? 'updated' : 'built';
    const cachePath = getPackageCachePath(nodeModulesPath);
    try {
        await fs.writeFile(cachePath, JSON.stringify(cache));
        console.log(`electron-rebuild: cache ${verb} ${cachePath}`);
        return cache;
    } catch(err) {
        console.error('unable to write electron-rebuild cache file');
        throw err;
    }
}
