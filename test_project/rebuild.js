let childProcess = require('child_process');
let pathToElectron = require('electron');
let rebuild = require('../lib/main');

rebuild.shouldRebuildNativeModules(pathToElectron).then((shouldBuild) => {
  if (!shouldBuild) return true;

  let electronVersion = childProcess.execSync(`${pathToElectron} --version`, {encoding: 'utf8'});
  electronVersion = electronVersion.match(/v(\d+\.\d+\.\d+)/)[1];
  //console.log('electronVersion', electronVersion);

  return rebuild.installNodeHeaders(electronVersion).then(() => {
    rebuild.rebuildNativeModules(electronVersion, './node_modules')
  });
}).catch((e) => {
  console.error("Building modules didn't work!");
  console.error(e);
});
