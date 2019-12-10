import { rebuild, rebuildNativeModules } from './rebuild';

export const installNodeHeaders = (): Promise<void> => Promise.resolve();
export const shouldRebuildNativeModules  = (): Promise<boolean> => Promise.resolve(true);
export const preGypFixRun = (): Promise<void> => Promise.resolve();
export { rebuild, rebuildNativeModules };
export default rebuild;
Object.defineProperty(exports, '__esModule', {
  value: true
});
