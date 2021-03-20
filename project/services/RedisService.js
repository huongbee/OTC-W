const _ = require('lodash');
const Redis = require('ioredis');
const RedisConfig = require('project/config/Redis');

class RedisService {
  constructor(config = {
    port: 6379,
    host: '127.0.0.1',
    db: 1
    // auth: 'password'
  }) {
    this.redis = new Redis(config);
    console.log('REDIS CONFIG....', JSON.stringify(config));
  }

  set(key, value, timeout) {
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      if (_.isUndefined(key) === true || _.isUndefined(value) === true) {
        return reject(new Error('Empty key or value !'));
      }
      let result;
      if (_.isUndefined(timeout) === false) {
        // eslint-disable-next-line radix
        result = this.redis.set(key, value, 'EX', parseInt(timeout));
      } else {
        result = this.redis.set(key, value);
      }
      result.then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * set and return timeout
   * @param {*} key
   * @param {*} value
   * @param {*} timeout
   */
  setNX(key, value, timeout) {
    return new Promise((resolve, reject) => {
      if (_.isUndefined(key) === true || _.isUndefined(value) === true) {
        reject(new Error('Empty key or value !'));
      } else {
        let result;
        if (_.isUndefined(timeout) === false) {
          result = this.redis.set(key, value, 'EX', parseInt(timeout, 10), 'NX');
        } else {
          result = this.redis.set(key, value, 'EX', 0, 'NX');
        }
        result.then(
          (success) => {
            resolve(success);
          },
          (error) => {
            reject(error);
          }
        );
      }
    });
  }

  setObject(key, obj, timeout) {
    return new Promise((resolve, reject) => {
      try {
        const objStr = JSON.stringify(obj);
        this.set(key, objStr, timeout).then(
          (success) => {
            resolve(success);
          },
          (error) => {
            reject(error);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  get(key) {
    return new Promise((resolve, reject) => {
      this.redis.get(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  delete(key) {
    return new Promise((resolve, reject) => {
      this.redis.del(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  getObject(key) {
    return new Promise((resolve, reject) => {
      this.get(key).then(
        (success) => {
          try {
            resolve(JSON.parse(success));
          } catch (e) {
            reject(e);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  storeDataWithPromise(key, data, timeout) {
    return new Promise((resolve, reject) => {
      this.getObject(key).then(
        (cache) => {
          if (_.isNull(cache) === true) {
            data().then(
              (success) => {
                if (_.isUndefined(success) === false) {
                  this.setObject(key, success, timeout);
                }
                resolve(success);
              },
              (error) => {
                reject(error);
              }
            );
          } else {
            resolve(cache);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  store(key, data, timeout) {
    return new Promise((resolve, reject) => {
      this.getObject(key).then(
        (cache) => {
          if (_.isNull(cache) === true) {
            const result = data();
            if (result) {
              this.setObject(key, result, timeout);
            }
            resolve(result);
          } else {
            resolve(cache);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  rpush(key, value) {
    return new Promise((resolve, reject) => {
      if (_.isUndefined(key) === true || _.isUndefined(value) === true) {
        return reject(new Error('Empty key or value !'));
      }
      return this.redis.rpush(key, value)
        .then(
          (success) => {
            resolve(success);
          },
          (error) => {
            reject(error);
          }
        );
    });
  }

  lpop(key) {
    return new Promise((resolve, reject) => {
      this.redis.lpop(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  llen(key) {
    return new Promise((resolve, reject) => {
      this.redis.llen(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  exists(key) {
    return new Promise((resolve, reject) => {
      this.redis.exists(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  getPTTL(key) {
    return new Promise((resolve, reject) => {
      this.redis.pttl(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
     * Get  time to live of a key that has a timeout
     * @param {*} key
     */
  getTTL(key) {
    return new Promise((resolve, reject) => {
      this.redis.ttl(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  expire(key, timeout) {
    return new Promise((resolve, reject) => {
      this.redis.expire(key, parseInt(timeout, 10)).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * add multi value to key
   * @param {string} key
   * @param  {...any} value
   */
  sadd(key, ...value) {
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      if (_.isUndefined(key) === true || _.isUndefined(value) === true) {
        return reject(new Error('Empty key or value !'));
      }
      const result = this.redis.sadd(key, ...value);
      return result;
    });
  }

  /**
   * get random value in key
   * @param {*} key
   * @param {*} quantity
   */
  spop(key, quantity) {
    return new Promise((resolve, reject) => {
      if (_.isUndefined(key) === true || _.isNaN(quantity) === true) {
        return reject(new Error('Empty key or value invalid!'));
      }
      this.redis.spop(key, quantity)
        .then(
          (success) => {
            return resolve(success);
          },
          (error) => {
            return reject(error);
          }
        );
    });
  }

  /**
   * return count value in key
   * @param {string} key
   */
  scard(key) {
    return new Promise((resolve, reject) => {
      this.redis.scard(key).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Get the key stored with pattern
   * @param {*} patern
   */
  keys(pattern) {
    return new Promise((resolve, reject) => {
      this.redis.keys(pattern).then(
        (success) => {
          resolve(success);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
}

module.exports = new RedisService(RedisConfig.redis_init);
