import * as path from 'path';
import { expect } from 'chai';

import { readPackageJson } from '../lib/read-package-json';

describe('read-package-json', () => {
  it('should find a package.json file from the given directory', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    expect(await readPackageJson(path.resolve(__dirname, '..'))).to.deep.equal(require('../package.json'));
  });
});
