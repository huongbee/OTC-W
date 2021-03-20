const _ = require('lodash');
const Async = require('async');
const GeneralConstant = require('project/constants/GeneralConstant');
const redisService = require('project/services/RedisService');
const UuidPrefixConfigModel = require('project/models/UUIDPrefixConfigModel');
const UuidModel = require('project/models/UUIDModel');
const AsyncForEach = require('await-async-foreach');

const Variable = {
  POOL_LOAD: null,
  POOL_EXCUTE: null,
  AVAILABLE_ITEM: 100,
  STOP_PREFIX: {}
};

const Private = {
  async Delay(delayTime) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, delayTime);
    });
  },
  Genegate(chars, length) {
    let s = '';
    for (let i = 0; i < length; i += 1) {
      const pos = (Math.floor(Math.random() * Math.floor(chars.length)));
      s += chars[pos];
    }
    return s.toUpperCase().toString();
  },
  GenegateNumber(length) {
    const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return Private.Genegate(chars, length);
  },
  GenerateAlphabet(length) {
    const chars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
      'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
      'w', 'x', 'y', 'z'];
    return Private.Genegate(chars, length);
  },
  GenerateAlphabetAndNumber(length) {
    const chars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
      'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
      'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6',
      '7', '8', '9'];
    return Private.Genegate(chars, length);
  }
};

const TransactionModule = {
  async Init(...prefix) {
    Variable.POOL_LOAD = Async.queue((task, callback) => {
      try {
        // redisService.delete('ACCOUNT_ID_PROD');
        // redisService.delete('OTC_ADS_TRANSACTION');
        // redisService.delete('TRADE_TRANSACTION_PROD');
        // redisService.delete('SYSTEM_CHANGE_BALANCE_PROD');
        // (async () => {
        //   const lists = await redisService.keys('OTC_ADS_TRANSACTION*');
        //   console.log(lists);
        //   _.forEach(lists, item => {
        //     redisService.delete(item);
        //   });
        //   const lists2 = await redisService.keys('TRADE_TRANSACTION_PROD*');
        //   console.log(lists2);
        //   _.forEach(lists2, item => {
        //     redisService.delete(item);
        //   });
        // })();
        (async () => {
          // const lists = await redisService.keys('ADS_TRANSACTION*');
          // console.log(lists);
          // _.forEach(lists, item => {
          //   redisService.delete(item);
          // });
          // const lists2 = await redisService.keys('TRADE_TRANSACTION*');
          // console.log(lists2);
          // _.forEach(lists2, item => {
          //   redisService.delete(item);
          // });
        })();
        (async () => {
          const prefixInfos = await UuidPrefixConfigModel.find({ prefix: { $in: prefix } }).select('-_id').lean();
          await AsyncForEach(prefixInfos, async (prefixInfo) => {
            if (_.get(Variable, `STOP_PREFIX.${prefixInfo.prefix}`, true) === true) {
              const availableItem = await redisService.llen(prefixInfo.prefix);
              if (availableItem < Variable.AVAILABLE_ITEM) {
                let count = 100;
                if (Variable.AVAILABLE_ITEM - availableItem < count) {
                  count = Variable.AVAILABLE_ITEM - availableItem;
                }
                console.log({ count, availableItem });
                _.forEach(new Array(count), () => {
                  Variable.POOL_EXCUTE.push(prefixInfo);
                });
              }
            } else {
              console.log('transactionSerious', `Prefix ${prefixInfo.prefix} tạm ngưng tạo lại vì số lần thử lại quá nhiều lần`);
            }
          }, 'parallel', 10);
        })();
      } catch (error) {
        return error;
      } finally {
        callback();
      }
      return true;
    });
    Variable.POOL_EXCUTE = Async.queue((task, callback) => {
      try {
        // console.log(222222222222222);
        if (_.isNull(task) === false) {
          (async () => {
            if (_.get(task, 'retryCount', 0) > 100) {
              Variable.STOP_PREFIX[task.prefix] = false;
              console.log('transactionSerious', `Prefix ${task.prefix} tạm ngưng tạo lại vì số lần thử lại quá nhiều lần`);
              return false;
            }
            let randomString = '';
            if (task.type === GeneralConstant.PREFIX_CONFIG_TYPE.NUMBER) {
              randomString = Private.GenegateNumber(task.length);
            } else if (task.type === GeneralConstant.PREFIX_CONFIG_TYPE.ALPHABET) {
              randomString = Private.GenerateAlphabet(task.length);
            } else {
              randomString = Private.GenerateAlphabetAndNumber(task.length);
            }
            const key = `${task.prefix}:${randomString}`;

            const checkExist = await redisService.exists(key);
            if (checkExist !== 0) {
              if (_.isUndefined(task.retryCount)) {
                task.retryCount = 1;
              } else {
                task.retryCount += 1;
              }
              console.log('transactionError', `Tạo lại transaction cho prefix ${task.prefix} vì bị trùng key ${randomString}, số lần thử lại: ${task.retryCount} lần`);
              // Variable.POOL_EXCUTE.push(task);
            }

            try {
              const created = await UuidModel.create({
                uuid: randomString,
                prefix: task.prefix,
                state: GeneralConstant.UUID_STATE.NEW
              });
              if (!_.isObject(created) || created.id < 1) {
                return false;
              }
              await redisService.rpush(task.prefix, randomString);
              await redisService.set(key, true);
              // Server.log('transactionInfo', `Đã thêm transaction ${randomString} vào prefix ${task.prefix}`);
            } catch (error) {
              if (error.message.indexOf('E11000 duplicate key error') >= 0) {
                await redisService.set(key, true);
              }
            }

            return true;
          })();
        }
      } catch (error) {
        return error;
      } finally {
        callback();
      }
      return true;
    }, 100);

    Variable.POOL_LOAD.drain(() => {
      // Variable.POOL_EXCUTE.push(null);
    });

    Variable.POOL_EXCUTE.drain(() => {
      (async () => {
        await Private.Delay(10000);
        Variable.POOL_LOAD.push(null);
      })();
    });

    Variable.POOL_LOAD.push(1);
  }
};

module.exports = TransactionModule;
