import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * the different between require.resolve:
 *  1. return module's dir but not module's index.js
 *  2. if module is symlink return the path in node_modules but not truely path
 *  3. will not throw error while module have not index.js
 *  4. will return mutiValue while have mutiVersion
 *  5. can set a rootPath for search end dir
 *    (if not set rootPath, will search untill not have package.json)
 *
 * @param currentPath the path of current exec location
 * @param moduleName the dirname of module
 * @param rootPath the project's root path. if provide this param,
 *  will search up to this path
 */
export const searchModule = async (
  currentPath: string,
  moduleName: string,
  rootPath?: string
): Promise<string[]> => {
  let modulePaths = [];
  let workspacePath: string = currentPath;
  let judgeContinueSearch: boolean = await fs.pathExists(
    path.resolve(workspacePath, 'package.json')
  );
  if (rootPath) {
    judgeContinueSearch = workspacePath !== path.resolve(rootPath, '..');
  }
  while (judgeContinueSearch) {
    let modulePath = path.resolve(workspacePath, 'node_modules', moduleName);
    if (await fs.exists(modulePath)) {
      modulePaths.push(modulePath);
    }
    workspacePath = path.resolve(workspacePath, '..');

    judgeContinueSearch = await fs.pathExists(
      path.resolve(workspacePath, 'package.json')
    );
    if (rootPath) {
      judgeContinueSearch = workspacePath !== path.resolve(rootPath, '..');
    }
  }
  return modulePaths;
};

/**
 * the different between require.resolve:
 *  1. return module's dir but not module's index.js
 *  2. if module is symlink return the path in node_modules but not truely path
 *  3. will not throw error while module have not index.js
 *  4. will return mutiValue while have mutiVersion
 *  5. can set a rootPath for search end dir
 *    (if not set rootPath, will search untill not have package.json)
 *
 * @param currentPath the path of current exec location
 * @param moduleName the dirname of module
 * @param rootPath the project's root path.
 *  if provide this param, will search up to this path
 */
export const searchModuleSync = (
  currentPath: string,
  moduleName: string,
  rootPath?: string
): string[] => {
  let modulePaths = [];
  let workspacePath: string = currentPath;

  let judgeContinueSearch: boolean = fs.existsSync(
    path.resolve(workspacePath, 'package.json')
  );
  if (rootPath) {
    judgeContinueSearch = workspacePath !== path.resolve(rootPath, '..');
  }
  while (judgeContinueSearch) {
    let modulePath = path.resolve(workspacePath, 'node_modules', moduleName);
    if (fs.existsSync(modulePath)) {
      modulePaths.push(modulePath);
    }
    workspacePath = path.resolve(workspacePath, '..');

    judgeContinueSearch = fs.existsSync(
      path.resolve(workspacePath, 'package.json')
    );
    if (rootPath) {
      judgeContinueSearch = workspacePath !== path.resolve(rootPath, '..');
    }
  }
  return modulePaths;
};

/**
 * return the node_modules's paths in a array,
 *  if currentPath in deep dir return outside's node_modules path too
 *
 * @param currentPath the path of current exec location
 * @param rootPath the project's root path. if provide this param, will search up to this path
 *  (if not provide this param, will search untill not have package.json)
 */
export const searchNodeModules = async (
  currentPath: string,
  rootPath?: string
): Promise<string[]> => {
  let nodeModules = [];
  let workspacePath: string = currentPath;

  let judgeContinueSearch: boolean = await fs.pathExists(
    path.resolve(workspacePath, 'package.json')
  );
  if (rootPath) {
    judgeContinueSearch = workspacePath !== path.resolve(rootPath, '..');
  }
  while (judgeContinueSearch) {
    let modulePath = path.resolve(workspacePath, 'node_modules');
    if (await fs.exists(modulePath)) {
      nodeModules.push(modulePath);
    }
    workspacePath = path.resolve(workspacePath, '..');

    judgeContinueSearch = await fs.pathExists(
      path.resolve(workspacePath, 'package.json')
    );
    if (rootPath) {
      judgeContinueSearch = workspacePath !== path.resolve(rootPath, '..');
    }
  }
  return nodeModules;
};

/**
 * get project's rootPath
 *  if currentPath is in a yarn workspace project,
 *  will retrun the yarn workspace's rootpath
 * @param currentPath
 */
export const getProjectRootPath = (currentPath: string): string => {
  let workspaceRootPath: string | undefined;
  while (currentPath !== path.resolve('/')) {
    try {
      let packageJson = JSON.parse(
        fs.readFileSync(path.join(currentPath, 'package.json')).toString()
      );
      if (packageJson.workspaces) {
        workspaceRootPath = currentPath;
        break;
      }
    } catch (error) {
      /* tslint:disable:no-empty */
    }
    currentPath = path.resolve(currentPath, '..');
  }
  return workspaceRootPath ? workspaceRootPath : currentPath;
};
