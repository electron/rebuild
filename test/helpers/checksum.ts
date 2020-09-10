import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import { promisify } from 'util';
import * as stream from 'stream';

const pipeline = promisify(stream.pipeline);

export async function determineChecksum(filename: string): Promise<string> {
  let calculated = '';
  const file = fs.createReadStream(filename, { encoding: 'binary' });
  const hasher = crypto.createHash('sha256', { defaultEncoding: 'binary' });
  hasher.on('readable', () => {
    const data = hasher.read();
    if (data) {
      calculated = data.toString('hex');
    }
  });
  await pipeline(file, hasher);

  return calculated;
}
