import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readPackageJson } from '../lib/read-package-json.js';
import { pathToFileURL } from 'node:url';

describe('read-package-json', () => {
  it('should find a package.json file from the given directory', async () => {
    expect(await readPackageJson(path.resolve(import.meta.dirname, '..'))).to.deep.equal(
      (
        await import(pathToFileURL(path.join(import.meta.dirname, '../package.json')).toString(), {
          with: { type: 'json' },
        })
      ).default,
    );
  });
});
