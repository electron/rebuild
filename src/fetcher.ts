import { setTimeout as sleep } from 'node:timers/promises';

import debug from 'debug';

const d = debug('electron-rebuild');

export async function fetch<T extends 'buffer' | 'text', RT = T extends 'buffer' ? Buffer : string>(
  url: string,
  responseType: T,
  retries = 3,
): Promise<RT> {
  if (retries === 0)
    throw new Error(
      'Failed to fetch a clang resource, run with DEBUG=electron-rebuild for more information',
    );
  d('downloading:', url);
  try {
    const response = await globalThis.fetch(url);
    if (response.status !== 200) {
      d('got bad status code:', response.status);
      await sleep(2000);
      return fetch(url, responseType, retries - 1);
    }
    d('response came back OK');
    if (responseType === 'buffer') {
      return Buffer.from(await response.arrayBuffer()) as RT;
    }
    return (await response.text()) as RT;
  } catch (err) {
    d('request failed for some reason', err);
    await sleep(2000);
    return fetch(url, responseType, retries - 1);
  }
}
