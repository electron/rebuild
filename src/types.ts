import { EventEmitter } from 'events';

export enum BuildType {
  Debug = 'Debug',
  Release = 'Release',
}

export type RebuildMode = 'sequential' | 'parallel';

export interface IRebuilder {
  ABI: string;
  arch: string;
  buildPath: string;
  buildType: BuildType;
  cachePath: string;
  debug: boolean;
  disablePreGypCopy: boolean;
  electronVersion: string;
  force: boolean;
  headerURL: string;
  lifecycle: EventEmitter;
  mode: RebuildMode;
  jobs: string;
  msvsVersion?: string;
  platform: string;
  prebuildTagPrefix: string;
  buildFromSource: boolean;
  useCache: boolean;
  useElectronClang: boolean;
}
