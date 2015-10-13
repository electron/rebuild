import crypto from 'crypto';

/**
 * md5 hash an input string
 * @return {string}
 */
export const md5 = function(str) {
    return crypto.createHash('md5').update(str).digest("hex");
}
