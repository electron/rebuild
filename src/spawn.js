import _ from 'lodash';
import childProcess from 'child_process';

export default function (options={}) {
  const stdout = (options.stdout && process.stdout) ? process.stdout : [];
  const stderr = (options.stderr && process.stderr) ? process.stderr : [];
  
  return new Promise((resolve, reject) => {
    let error = null;
    //console.log("Calling spawn! " + JSON.stringify(options));
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
