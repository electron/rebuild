import fs from 'fs-extra';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readPackageJson(dir: string, safe = false): Promise<any> {
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
