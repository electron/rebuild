import debug from 'debug';
import got from 'got';

const d = debug('electron-rebuild');

function sleep(n: number) {
  return new Promise(r => setTimeout(r, n));
}

export async function fetch<T extends 'buffer' | 'text', RT = T extends 'buffer' ? Buffer : string>(url: string, responseType: T, retries = 3): Promise<RT> {
  if (retries === 0) throw new Error('Failed to fetch a clang resource, run with DEBUG=electron-rebuild for more information');
  d('downloading:', url);
  try {
    const response = await got.get(url, {
      responseType,
    });
    if (response.statusCode !== 200) {
      d('got bad status code:', response.statusCode);
      await sleep(2000);
      return fetch(url, responseType, retries - 1);
    }
    d('response came back OK');
    return response.body as RT;
  } catch (err) {
    d('request failed for some reason', err);
    await sleep(2000);
    return fetch(url, responseType, retries - 1);
  }
}
