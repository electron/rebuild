process.argv.splice(1, 1);

// This tricks prebuild-install into not validating on the
// 1.8.x and 8.x ABI collision
process.versions.modules = '-1';

/* tslint:disable */
require(process.argv[1]);
/* tslint:enable */
