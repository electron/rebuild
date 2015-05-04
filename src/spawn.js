import _ from 'lodash';
import childProcess from 'child_process';

export default function (options={}) {
  const stdout = (options.stdout && process.stdout) ? process.stdout : [];
  const stderr = (options.stderr && process.stderr) ? process.stderr : [];
  
  return new Promise((resolve, reject) => {
    let error = null;
    let proc = childProcess.spawn(options.cmd, options.args, options.opts);
    
    proc.stdout.on('data', (data) => {
      if(_.isArray(stdout)) {
        stdout.push(data.toString());
      } else {
        stdout.write(data.toString());
      }
    });
        
    proc.stderr.on('data', (data) => {
      if(_.isArray(stderr)) {
        stderr.push(data.toString());
      } else {
        stderr.write(data.toString());
      }
    });
        
    proc.on('error', (processError) => error = error || processError);
    
    proc.on('close', (exitCode, signal) => {
      if (exitCode !== 0) {
        error = error || new Error(signal);
      }
      
      let results = {
        stderr: (_.isArray(stderr) ? stderr.join('') : ''), 
        stdout: (_.isArray(stdout) ? stdout.join('') : ''), 
        code: exitCode
      };
      
      if (error) { reject(error); } else { resolve(results); }
    });
  });
}
