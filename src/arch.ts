import { execSync } from 'child_process';

/**
 * Runs the `uname` command and returns the trimmed output.
 *
 * Copied from `@electron/get`.
 */
export function uname(): string {
  return execSync('uname -m')
    .toString()
    .trim();
}

export type ConfigVariables = {
  arm_version?: string;
}

/**
 * Generates an architecture name that would be used in an Electron or Node.js
 * download file name.
 *
 * Copied from `@electron/get`.
 */
export function getNodeArch(arch: string, configVariables: ConfigVariables): string {
  if (arch === 'arm') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    switch (configVariables.arm_version) {
      case '6':
        return uname();
      case '7':
      default:
        return 'armv7l';
    }
  }

  return arch;
}
