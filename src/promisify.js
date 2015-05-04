import _ from 'lodash';

const promisify = (funcOrObject) => {
  if (typeof funcOrObject === 'function') {
    return function(...args) {
      return new Promise(function(resolve, reject) {
        args.push((err, ...rest) => {
          if (err) {
            reject(err);
          } else {
            resolve(rest.length === 1 ? rest[0] : rest);
          }
        });
        
        funcOrObject.apply(this, args);
      });
    };
  }
  
  if (typeof funcOrObject === 'object') {
    return _.reduce(Object.keys(funcOrObject), (acc, x) => {
      acc[x] = promisify(funcOrObject[x]);
      return acc;
    }, {});
  }
  
  // Neither a func or an object, just return itself
  return funcOrObject;
};

export default promisify;
