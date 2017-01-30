import { default as _rebuild, rebuildNativeModules as _rebuildNativeModules } from './rebuild';

/**
 * Rebuilds a node_modules directory with the given Electron version.
 *
 * @export
 * @param {string} appPath An absolute path to your app's directory (The directory that contains your node_modules)
 * @param {string} electronVersion The version of Electron to rebuild for
 * @param {string} [arch=process.arch] The arch to rebuild for
 * @param {Array<string>} [extraModules=[]] An array of modules to rebuild as well as the detected modules
 * @param {Boolean} [forceRebuild=false] Force a rebuild of modules regardless of their current build state
 * @param {string} [headerUrl="atom.io/download/electron"] URL to download Electron header files from
 * @param {Array<string>} [types="['prod', 'optional']"] Types of modules to rebuild
 * @param {string} [mode=""] rebuild mode, either 'sequential' or 'parallel' - Default varies per platform (probably shouldn't mess with this one)
 * @returns {Promise<void>} A Promise indicating whether the operation succeeded or not
 */
export default function rebuild (...args) {
  return _rebuild(...args);
}

/**
 * Legacy API, do not use.
 *
 * @export
 * @param {string} electronVersion
 * @param {string} modulePath
 * @param {string} [whichModule='']
 * @param {string} [headersDir=null]
 * @param {string} [arch=process.arch]
 * @param {string} command
 * @param {boolean} [ignoreDevDeps=false]
 * @param {boolean} [ignoreOptDeps=false]
 * @param {boolean} [verbose=false]
 * @returns {Promise<void>} A Promise indicating whether the operation succeeded or not
 */
export function rebuildNativeModules (...args) {
  return _rebuildNativeModules(...args);
}

/**
 * Legacy API, does not actually perform any operation. Do not use.
 *
 * @returns {Promise<void>}
 */
export function installNodeHeaders () {
  return Promise.resolve();
}

/**
 * Legacy API, does not actually perform any operation. Do not use.
 *
 * @returns {Promise<true>}
 */
export function shouldRebuildNativeModules () {
  return Promise.resolve(true);
}

/**
 * Legacy API, does not actually perform any operation. Do not use.
 *
 * @returns {Promise<void>}
 */
export function preGypFixRun () {
  return Promise.resolve();
}
