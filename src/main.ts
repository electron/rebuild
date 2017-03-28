export { default, rebuildNativeModules } from './rebuild';

export const installNodeHeaders = () => Promise.resolve();
export const shouldRebuildNativeModules  = () => Promise.resolve(true);
export const preGypFixRun = () => Promise.resolve();