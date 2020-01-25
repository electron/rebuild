import * as findUp from 'find-up';
import * as fs from 'fs-extra';
import * as path from 'path';

async function shouldContinueSearch(workspacePath: string, rootPath?: string): Promise<boolean> {
  if (rootPath) {
    return Promise.resolve(workspacePath !== path.dirname(rootPath));
  } else {
    return fs.pathExists(path.join(workspacePath, 'package.json'));
  }
}

type PathGeneratorFunction = (workspacePath: string) => string;

async function traverseAncestorDirectories(cwd: string, pathGenerator: PathGeneratorFunction, rootPath?: string): Promise<string[]> {
  const paths: string[] = [];
  let workspacePath = path.resolve(cwd);

  while (await shouldContinueSearch(workspacePath, rootPath)) {
    const generatedPath = pathGenerator(workspacePath);
    if (await fs.pathExists(generatedPath)) {
      paths.push(generatedPath);
    }
    workspacePath = path.dirname(workspacePath);
  }

  return paths;
}

/**
 * Find all instances of a given module in node_modules subdirectories while traversing up
 * ancestor directories.
 *
 * @param cwd the initial directory to traverse
 * @param moduleName the Node module name (should work for scoped modules as well)
 * @param rootPath the project's root path. If provided, the traversal will stop at this path.
 */
export async function searchModule(
  cwd: string,
  moduleName: string,
  rootPath?: string
): Promise<string[]> {
  const pathGenerator: PathGeneratorFunction = (workspacePath) => path.join(workspacePath, 'node_modules', moduleName);
  return traverseAncestorDirectories(cwd, pathGenerator, rootPath);
}

/**
 * Find all instances of node_modules subdirectories while traversing up ancestor directories.
 *
 * @param cwd the initial directory to traverse
 * @param rootPath the project's root path. If provided, the traversal will stop at this path.
 */
export async function searchNodeModules(cwd: string, rootPath?: string): Promise<string[]> {
  const pathGenerator: PathGeneratorFunction = (workspacePath) => path.join(workspacePath, 'node_modules');
  return traverseAncestorDirectories(cwd, pathGenerator, rootPath);
}

/**
 * Determine the root directory of a given project, by looking for a directory with an
 * NPM or yarn lockfile.
 *
 * @param cwd the initial directory to traverse
 */
export async function getProjectRootPath(cwd: string): Promise<string> {
  for (const lockFilename of ['yarn.lock', 'package-lock.json']) {
    const lockPath = await findUp(lockFilename, { cwd, type: 'file' });
    if (lockPath) {
      return path.dirname(lockPath);
    }
  }

  return cwd;
}
