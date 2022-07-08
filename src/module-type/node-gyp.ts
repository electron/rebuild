import debug from 'debug';
import detectLibc from 'detect-libc';
import NodeGypRunner from 'node-gyp';
import path from 'path';
import { promisify } from 'util';
import semver from 'semver';

import { ELECTRON_GYP_DIR } from '../constants';
import { getClangEnvironmentVars } from '../clang-fetcher';
import { NativeModule } from '.';

const d = debug('electron-rebuild');

export class NodeGyp extends NativeModule {
  async buildArgs(prefixedArgs: string[]): Promise<string[]> {
    const args = [
      'node',
      'node-gyp',
      'rebuild',
      ...prefixedArgs,
      `--runtime=electron`,
      `--target=${this.rebuilder.electronVersion}`,
      `--arch=${this.rebuilder.arch}`,
      `--dist-url=${this.rebuilder.headerURL}`,
      '--build-from-source'
    ];

    args.push(d.enabled ? '--verbose' : '--silent');

    if (this.rebuilder.debug) {
      args.push('--debug');
    }

    args.push(...(await this.buildArgsFromBinaryField()));

    if (this.rebuilder.msvsVersion) {
      args.push(`--msvs_version=${this.rebuilder.msvsVersion}`);
    }

    // Headers of old Electron versions do not have a valid config.gypi file
    // and --force-process-config must be passed to node-gyp >= 8.4.0 to
    // correctly build modules for them.
    // See also https://github.com/nodejs/node-gyp/pull/2497
    if (!semver.satisfies(this.rebuilder.electronVersion, '^14.2.0 || ^15.3.0') && semver.major(this.rebuilder.electronVersion) < 16) {
      args.push('--force-process-config');
    }

    return args;
  }

  async buildArgsFromBinaryField(): Promise<string[]> {
    const binary = await this.packageJSONFieldWithDefault('binary', {}) as Record<string, string>;
    const flags = await Promise.all(Object.entries(binary).map(async ([binaryKey, binaryValue]) => {
      if (binaryKey === 'napi_versions') {
        return;
      }

      let value = binaryValue

      if (binaryKey === 'module_path') {
        value = path.resolve(this.modulePath, value);
      }

      value = value.replace('{configuration}', this.rebuilder.buildType)
        .replace('{node_abi}', `electron-v${this.rebuilder.electronVersion.split('.').slice(0, 2).join('.')}`)
        .replace('{platform}', this.rebuilder.platform)
        .replace('{arch}', this.rebuilder.arch)
        .replace('{version}', await this.packageJSONField('version') as string)
        .replace('{libc}', await detectLibc.family() || 'unknown');

      for (const [replaceKey, replaceValue] of Object.entries(binary)) {
        value = value.replace(`{${replaceKey}}`, replaceValue);
      }

      return `--${binaryKey}=${value}`;
    }))

    return flags.filter(value => value) as string[];
  }

  async rebuildModule(): Promise<void> {
    if (this.modulePath.includes(' ')) {
      console.error('Attempting to build a module with a space in the path');
      console.error('See https://github.com/nodejs/node-gyp/issues/65#issuecomment-368820565 for reasons why this may not work');
      // FIXME: Re-enable the throw when more research has been done
      // throw new Error(`node-gyp does not support building modules with spaces in their path, tried to build: ${modulePath}`);
    }

    let env: Record<string, string | undefined>;
    const extraNodeGypArgs: string[] = [];

    if (this.rebuilder.useElectronClang) {
      env = { ...process.env };
      const { env: clangEnv, args: clangArgs } = await getClangEnvironmentVars(this.rebuilder.electronVersion, this.rebuilder.arch);
      Object.assign(process.env, clangEnv);
      extraNodeGypArgs.push(...clangArgs);
    }

    const nodeGypArgs = await this.buildArgs(extraNodeGypArgs);
    d('rebuilding', this.moduleName, 'with args', nodeGypArgs);

    const nodeGyp = NodeGypRunner();
    nodeGyp.parseArgv(nodeGypArgs);
    nodeGyp.devDir = ELECTRON_GYP_DIR;
    let command = nodeGyp.todo.shift();
    const originalWorkingDir = process.cwd();
    try {
      process.chdir(this.modulePath);
      while (command) {
        if (command.name === 'configure') {
          command.args = command.args.filter((arg: string) => !extraNodeGypArgs.includes(arg));
        } else if (command.name === 'build' && process.platform === 'win32') {
          // This is disgusting but it prevents node-gyp from destroying our MSBuild arguments
          command.args.map = (fn: (arg: string) => string) => {
            return Array.prototype.map.call(command.args, (arg: string) => {
              if (arg.startsWith('/p:')) return arg;
              return fn(arg);
            });
          }
        }
        await promisify(nodeGyp.commands[command.name])(command.args);
        command = nodeGyp.todo.shift();
      }
    } catch (err) {
      const errorMessage = `node-gyp failed to rebuild '${this.modulePath}'.
For more information, rerun with the DEBUG environment variable set to "electron-rebuild".

Error: ${err.message || err}\n\n`;
      throw new Error(errorMessage);
    } finally {
      process.chdir(originalWorkingDir);
    }

    if (this.rebuilder.useElectronClang) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.restoreEnv(env!);
    }
  }

  private restoreEnv(env: Record<string, string | undefined>): void {
    const gotKeys = new Set<string>(Object.keys(process.env));
    const expectedKeys = new Set<string>(Object.keys(env));

    for (const key of Object.keys(process.env)) {
      if (!expectedKeys.has(key)) {
        delete process.env[key];
      } else if (env[key] !== process.env[key]) {
        process.env[key] = env[key];
      }
    }
    for (const key of Object.keys(env)) {
      if (!gotKeys.has(key)) {
        process.env[key] = env[key];
      }
    }
  }
}
