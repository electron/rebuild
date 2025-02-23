import fs from 'graceful-fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readPackageJson(dir: string, safe = false): Promise<any> {
  try {
    return JSON.parse(await fs.promises.readFile(path.resolve(dir, 'package.json'), {
      encoding: 'utf-8',
    }));
  } catch (err) {
    if (safe) {
      return {};
    } else {
      throw err;
    }
  }
}
