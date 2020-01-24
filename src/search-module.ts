import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * This is different from `require.resolve` in that:
 *  1. it returns the module's directory but not the module's `index.js`
 *  2. if the module is a symlink, return the path in `node_modules` but not the symlinked path
 *  3. it will not throw an error if the module does not have an `index.js` file
 *  4. will return mutiValue while have mutiVersion
 *  5. a `rootPath` can be specified to limit the parent traversal
 *    (if `rootPath` is not set, it will traverse parent directories until a directory without a `package.json` is found)
 *
 * @param currentPath the path of current exec location
 * @param moduleName the dirname of the module
 * @param rootPath the project's root path. if provide this param,
 *  will search up to this path
 */
export async function searchModule(
  currentPath: string,
  moduleName: string,
  rootPath?: string
): Promise<string[]> {
  const modulePaths = [];
  let workspacePath: string = currentPath;
  while (shouldContinueSearch(workspacePath, rootPath)) {
    const modulePath = path.resolve(workspacePath, 'node_modules', moduleName);
    if (await fs.pathExists(modulePath)) {
      modulePaths.push(modulePath);
    }
    workspacePath = path.resolve(workspacePath, '..');
  }
  return modulePaths;
}

/**
 * return the node_modules's paths in a array,
 *  if currentPath in deep dir return outside's node_modules path too
 *
 * @param currentPath the path of current exec location
 * @param rootPath the project's root path. if provide this param, will search up to this path
 *  (if not provide this param, will search untill not have package.json)
 */
export async function searchNodeModules(
  currentPath: string,
  rootPath?: string
): Promise<string[]> {
  const nodeModules = [];
  let workspacePath = currentPath;

  while (shouldContinueSearch(workspacePath, rootPath)) {
    const modulePath = path.resolve(workspacePath, 'node_modules');
    if (await fs.pathExists(modulePath)) {
      nodeModules.push(modulePath);
    }
    workspacePath = path.resolve(workspacePath, '..');
  }
  return nodeModules;
}

async function shouldContinueSearch(workspacePath: string, rootPath?: string): Promise<boolean> {
  if (rootPath) {
    return Promise.resolve(workspacePath !== path.resolve(rootPath, '..'));
  } else {
    return fs.pathExists(path.resolve(workspacePath, 'package.json'));
  }
}

/**
 * get project's rootPath
 *  if currentPath is in a yarn workspace project,
 *  will retrun the yarn workspace's rootpath
 * @param currentPath
 */
export function getProjectRootPath(currentPath: string): string {
  let workspaceRootPath: string | undefined;

  while (currentPath !== path.resolve('/')) {
    try {
      const packageJson = fs.readJsonSync(path.join(currentPath, 'package.json'));
      if (packageJson.workspaces) {
        workspaceRootPath = currentPath;
        break;
      }
    } catch (error) { // eslint-disable-line no-empty
    }
    currentPath = path.resolve(currentPath, '..');
  }
  return workspaceRootPath || currentPath;
};
