const UserBalanceModel = require('project/models/UserBalanceModel');
const BalanceModel = require('project/models/BalanceModel');
const _ = require('lodash');
const Decimal = require('decimal.js');
const LockBalanceService = require('project/services/LockBalanceService');
const RedisLockService = require('./RedisLockService');

module.exports = {
  async addBalance(accountId, amount, description, referData = { id: '', transaction: '' }, sourceName = '') {
    const response = {
      code: -99,
      data: {
        message: 'Thất bại'
      }
    };
    if (!_.isNumber(amount) || amount <= 0 || !_.isObject(referData), !sourceName) {
      response.code = -1;
      response.data.message = 'Tham số đầu vào không hợp lệ';
      return response;
    }
    if (!referData.id || !referData.transaction) {
      response.code = -1;
      response.data.message = 'Tham số đầu vào không hợp lệ!';
      return response;
    }
    let lock;
    try {
      lock = await LockBalanceService.acquired(`wallet_${accountId}`);
      let walletInfo = await BalanceModel.findOne({
        accountId
      });

      if (_.get(walletInfo, 'id', false) === false) {
        walletInfo = await BalanceModel.create({
          accountId
        });
      }

      if (_.get(walletInfo, 'id', false) === false) {
        response.code = -2;
        response.data.message = 'Lỗi khởi tạo tài khoản';
        return response;
      }

      const twCash = new Decimal(walletInfo.balance);
      const tAmount = new Decimal(amount);
      let cash = new Decimal(0);
      cash = twCash.add(tAmount);
      const updated = await BalanceModel.updateMany({
        accountId
      }, {
        balance: cash.toNumber()
      });

      if (_.isObject(updated) && updated.nModified > 0) {
        const created = await UserBalanceModel.create({
          accountId,
          amount: tAmount.toNumber(),
          description,
          balance: {
            before: walletInfo.balance,
            after: cash.toNumber()
          },
          sourceName,
          refId: referData.id,
          refTransaction: referData.transaction
        });
        if (_.isObject(created) && created.id > 0) {
          response.code = 1;
          response.data.message = 'Thành công';
        } else {
          const reUpdated = await BalanceModel.updateOne({
            accountId
          }, {
            balance: walletInfo.balance
          });
          if (!_.isObject(reUpdated) || reUpdated.nModified < 1) {
            const locked = await BalanceModel.updateOne({
              accountId
            }, {
              lock: {
                status: true,
                reason: 'Lỗi khởi tạo lịch sử ví, không thể rollback số tiền đã cộng',
                referData: {
                  balance: walletInfo.balance
                }
              }
            });
            if (!_.isObject(locked) || locked.nModified < 1) {
              // TODO: Xử lý trường hợp không khóa ví được
            }
          }
          response.code = -4;
          response.data.message = 'Lỗi khởi tạo lịch sử ví';
        }
        return response;
      }
      response.code = -3;
      return response;
    } catch (error) {
      response.data.message = error;
    } finally {
      if (!_.isUndefined(lock)) lock.release();
    }

    return response;

  },
  async minusBalance(accountId, amount, description, referData = { id: '', transaction: '' }, sourceName) {
    const response = {
      code: -99,
      data: {
        message: 'Thất bại'
      }
    };
    if (!_.isNumber(amount) || amount <= 0 || !_.isObject(referData), !sourceName) {
      response.code = -1;
      response.data.message = 'Tham số đầu vào không hợp lệ';
      return response;
    }
    if (!referData.id || !referData.transaction) {
      response.code = -1;
      response.data.message = 'Tham số đầu vào không hợp lệ!';
      return response;
    }
    let lock;
    try {
      lock = await RedisLockService.acquired(`wallet_${accountId}`);
      let walletInfo = await BalanceModel.findOne({
        accountId
      });

      if (_.get(walletInfo, 'id', false) === false) {
        walletInfo = await BalanceModel.create({
          accountId
        });
      }

      if (_.get(walletInfo, 'id', false) === false) {
        response.code = -2;
        response.data.message = 'Lỗi khởi tạo tài khoản';
        return response;
      }

      const twCash = new Decimal(walletInfo.balance);
      const tAmount = new Decimal(amount);
      if (tAmount.gt(twCash.toNumber()) === true) {
        response.code = -3;
        response.data.message = 'Số dư không đủ';
        return response;
      }
      let cash = new Decimal(0);
      cash = twCash.minus(tAmount);
      const updated = await BalanceModel.updateOne({
        accountId
      }, {
        balance: cash.toNumber()
      });

      if (_.isObject(updated) && updated.nModified > 0) {
        const created = await UserBalanceModel.create({
          accountId,
          amount: 0 - tAmount.toNumber(),
          description,
          balance: {
            before: walletInfo.balance,
            after: cash.toNumber()
          },
          sourceName,
          refId: referData.id,
          refTransaction: referData.transaction
        });
        if (_.isObject(created) && created.id > 0) {
          response.code = 1;
          response.data.message = 'Thành công';
        } else {
          const reUpdated = await BalanceModel.updateOne({
            accountId
          }, {
            balance: walletInfo.balance
          });
          if (!_.isObject(reUpdated) || reUpdated.nModified < 1) {
            const locked = await BalanceModel.updateOne({
              accountId
            }, {
              lock: {
                status: true,
                reason: 'Lỗi khởi tạo lịch sử ví, không thể rollback số tiền đã trừ',
                referData: {
                  balance: walletInfo.balance
                }
              }
            });
            if (!_.isObject(locked) || locked.nModified < 1) {
              // TODO: Xử lý trường hợp không khóa ví được
            }
          }
          response.code = -4;
          response.data.message = 'Lỗi khởi tạo lịch sử ví';
        }
        return response;
      }
      response.code = -3;
      return response;
    } catch (error) {
      response.data.message = error;
    } finally {
      if (!_.isUndefined(lock)) lock.release();
    }

    return response;
  },
  async information(accountId) {
    const response = {
      code: -99,
      data: {
        message: 'Thất bại'
      }
    };
    try {
      let walletInfo = await BalanceModel.findOne({
        accountId
      });

      if (_.get(walletInfo, 'id', false) === false) {
        walletInfo = await BalanceModel.create({
          accountId
        });
      }

      if (_.get(walletInfo, 'id', false) === false) {
        response.code = -2;
        response.data.message = 'Lỗi khởi tạo tài khoản ví';
        return response;
      }

      const twCash = new Decimal(walletInfo.balance);
      response.code = 1;
      response.data.message = 'Lấy thông tin ví thành công';
      response.data.balance = twCash.toNumber();
      response.data.detail = {
        balance: walletInfo.balance,
        lockBalance: walletInfo.lockBalance
      };
      return response;
    } catch (error) {
      response.data.message = error;
    }

    return response;
  }
};
