import * as fs from 'fs-extra';
import * as path from 'path';

export async function readPackageJson(dir: string, safe = false) {
  try {
    return await fs.readJson(path.resolve(dir, 'package.json'));
  } catch (err) {
    if (safe) {
      return {};
    } else {
      throw err;
    }
  }
}
