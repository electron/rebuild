import _ from 'lodash';
import childProcess from 'child_process';
import logger from './logger';

export default function (options={}) {
  const stdout = (options.stdout && process.stdout) ? process.stdout : [];
  const stderr = (options.stderr && process.stderr) ? process.stderr : [];

  return new Promise((resolve, reject) => {
    let error = null;
    //console.log("Calling spawn! " + JSON.stringify(options));
    var optsOutput = Object.keys(options.opts || {}).map((key) => {
      return `\n -- ${key}: ${JSON.stringify(options.opts[key], null, 2)}`;
    });
    logger('spawn', `${options.cmd} ${options.args.join(' ')} ${optsOutput}`);
    let proc = childProcess.spawn(options.cmd, options.args, options.opts);

    proc.stdout.on('data', (data) => {
      logger(data.toString());
      if(_.isArray(stdout)) {
        stdout.push(data.toString());
      } else {
        stdout.write(data.toString());
      }
    });

    proc.stderr.on('data', (data) => {
      logger(data.toString());
      if(_.isArray(stderr)) {
        stderr.push(data.toString());
      } else {
        stderr.write(data.toString());
      }
    });

    proc.on('error', (processError) => error = error || processError);

    proc.on('close', (exitCode, signal) => {
      logger('spawn', `Process exited with code ${exitCode}`);
      let stdoutStr = (_.isArray(stdout) ? stdout.join('') : '');
      let stderrStr = (_.isArray(stderr) ? stderr.join('') : '');

      if (exitCode !== 0) {
        error = error || new Error("Process exited with code: " + exitCode);
        error.stdout = stdoutStr;
        error.stderr = stderrStr;
      }

      let results = {
        stderr: stderrStr, stdout: stdoutStr,
        code: exitCode
      };

      if (error) { reject(error); } else { resolve(results); }
    });
  });
}
