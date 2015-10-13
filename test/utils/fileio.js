import promisify from '../../lib/promisify';
const fs = promisify(require('fs'));
const rimraf = promisify(require('rimraf'));

export async function rmdir(dir) {
    try {
        if (await fs.stat(dir)) {
            await rimraf(dir);
        }
    } catch (err) {
        // silent fail is OK
    }
};

export async function mkdir(dir) {
    await fs.mkdir(dir);
    try {
        if (await fs.stat(targetModulesDir)) {
            await rimraf(targetModulesDir);
        }
    } catch (err) {
        // silent fail is OK
    }
};
