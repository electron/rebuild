import fs from 'fs-promise';
import path from 'path';

export default async (dir, safe = false) => {
  let packageData;
  try {
    packageData = await fs.readFile(path.resolve(dir, 'package.json'), 'utf8');
  } catch (err) {
    if (safe) {
      packageData = '{}';
    } else {
      throw err;
    }
  }
  return JSON.parse(packageData);
};
