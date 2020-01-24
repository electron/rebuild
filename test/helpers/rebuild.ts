import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';

type ExpectRebuildOptions = {
  buildType?: string;
  metaShouldExist?: boolean;
}

export async function expectNativeModuleToBeRebuilt(
  basePath: string,
  modulePath: string,
  options: ExpectRebuildOptions = {},
): Promise<void> {
  const metaShouldExist = Object.prototype.hasOwnProperty.call(options, 'metaShouldExist') ? options.metaShouldExist : true;
  const message = `${path.basename(modulePath)} build meta should ${metaShouldExist ? '' : 'not '}exist`;
  const buildType = options.buildType || 'Release';
  const metaPath = path.resolve(basePath, 'node_modules', modulePath, 'build', buildType, '.forge-meta');
  expect(await fs.pathExists(metaPath), message).to.equal(metaShouldExist);
}

export async function expectNativeModuleToNotBeRebuilt(
  basePath: string,
  modulePath: string,
  options: ExpectRebuildOptions = {},
): Promise<void> {
  await expectNativeModuleToBeRebuilt(basePath, modulePath, { ...options, metaShouldExist: false });
}
