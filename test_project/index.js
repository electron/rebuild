const electron = require('electron');

process.on("uncaughtException", function(exception) {
  console.error(exception);
  electron.app.quit();
});

console.log("loading libpq");
var pg = require('pg').native;

console.log("loading fibers");
var fibers = require('fibers');

console.log("pg", pg);
console.log("fibers", fibers);

electron.app.quit();
