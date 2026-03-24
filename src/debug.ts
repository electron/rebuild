const enabled = /(^|[\s,])(electron-rebuild|\*)([\s,]|$)/.test(process.env.DEBUG || '');

function log(...args: unknown[]): void {
  if (enabled) console.error('electron-rebuild', ...args);
}
log.enabled = enabled;

export const d = log;
