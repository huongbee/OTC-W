const AwaitLock = require('await-lock');
const _ = require('lodash');

const RedisService = require('./RedisService.js');

const lock = new AwaitLock();

const RedisLockService = {
  async acquired(key, retryTime = 200, retryCount = 1, ttl = 300) {
    if (_.isNull(ttl) === true || !_.isNumber(ttl)) {
      ttl = (retryTime * retryCount) / 1000;
      if (ttl < 2) ttl = 2;
    }
    await lock.acquireAsync(key);
    return new Promise((resolve, reject) => {
      (async () => {
        let result;
        result = await RedisService.setNX(key, true, ttl);
        if (result === 'OK') {
          return resolve({
            release: () => { lock.release(key); RedisLockService.release(key); }
          });
        }
        let count = 1;
        const retry = async () => {
          setTimeout(async () => {
            result = await RedisService.setNX(key, true, ttl);
            if (result === 'OK') {
              return resolve({
                release: () => {
                  lock.release(key);
                  RedisLockService.release(key);
                }
              });
            }
            count += 1;
            if (count >= retryCount && retryCount !== -1) {
              return reject('AWAIT_LOCK_TIMEOUT');
            }
            if (count > 500) {
              return reject('AWAIT_LOCK_TIMEOUT');
            }
            return retry();
          }, retryTime);
          return true;
        };
        return retry();
      })();
    });
  },
  async release(key) {
    return new Promise((resolve, reject) => {
      (async () => {
        const result = await RedisService.delete(key);
        if (result === 1) {
          resolve();
        } else {
          reject();
        }
      })();
    });
  }
};

module.exports = RedisLockService;
