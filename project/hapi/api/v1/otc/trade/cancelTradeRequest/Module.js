const AccountModel = require('project/models/AccountModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const AdsModel = require('project/models/AdsModel');
const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const TradeConstant = require('project/constants/TradeConstant');
const moment = require('moment');
const UserBalanceService = require('project/services/UserBalanceService');
const GeneralConstant = require('project/constants/GeneralConstant');
const SocialConfig = require('project/config/SocialId');
const CommisionModel = require('project/models/CommisionModel');
const RequestService = require('project/services/RequestService');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    if (_.get(userInfo, 'id', false) !== false) {
      const { transaction, type } = request.params;

      let trade = await TradeRequestModel.findOne({
        transaction,
        // type: TradeConstant.TRADE_TYPE.BUY,
        accountId: userInfo.id
        //   status: {
        //     $in: [
        //       TradeConstant.TRADE_STATUS.PENDING
        //       // TradeConstant.TRADE_STATUS.PAID
        //     ]
        //   }
      }).lean();
      if (!trade) {
        throw { message: 'Không tìm thấy thông tin giao dịch' };
      }
      if (trade.status !== TradeConstant.TRADE_STATUS.PENDING) {
        throw { message: 'Trạng thái giao dịch không được phép hủy' };
      }
      let timeAllow = 15;
      if (type === TradeConstant.TRADE_TYPE.SELL) {
        timeAllow = 60;
      }
      const now = moment(new Date());
      const createdAt = moment(new Date(trade.createdAt));
      if (now.diff(createdAt, 'minutes') < timeAllow) throw { message: `Chỉ được hủy giao dịch sau ${timeAllow} phút từ khi tạo giao dịch` };
      const changedStatus = {
        from: trade.status,
        to: TradeConstant.TRADE_STATUS.CANCELLED,
        reason: 'User hủy giao dịch',
        accountAction: authInfo.accountId,
        updatedAt: new Date()
      };
      const updated = await TradeRequestModel.updateMany(
        {
          transaction: trade.transaction,
          status: TradeConstant.TRADE_STATUS.PENDING
        },
        {
          $set: {
            status: TradeConstant.TRADE_STATUS.CANCELLED
          },
          $push: {
            changedStatus
          }
        },
        { multi: true }
      );
      if (!updated || updated.nModified !== 2) {
        throw { message: 'Hủy giao dịch thất bại, vui lòng thử lại' };
      }
      //  // trả V lại cho ADS sell
      const adsInfoUpdated = await AdsModel.updateOne(
        { id: trade.adsId },
        {
          $inc: {
            amount: trade.amount
          }
        });
      if (!adsInfoUpdated || adsInfoUpdated.nModified !== 1) {
        throw { message: 'Không thể hoàn trả cho quảng cáo, vui lòng kiểm tra lại' };
      }
      const adsInfo = await AdsModel.findOne({
        id: trade.adsId
      }).lean();
      if (adsInfo.type === TradeConstant.TRADE_TYPE.BUY) {
        const addBalanceSeller = await UserBalanceService.addBalance(
          trade.accountId,
          trade.totalAmount, // trả V và cả phí V
          `Hoàn trả V do lệnh SELL #${trade.transaction} bị hủy`,
          trade,
          GeneralConstant.SOURCE_NAME.TRADE_EXPIRED
        );
        console.log('addBalanceSelleraddBalanceSeller', JSON.stringify(addBalanceSeller));
        if (addBalanceSeller.code !== 1) {
          throw { message: 'Hoàn V cho lệnh Trade bị hủy không thành công' };
        }
        // hủy commision đã tạo cho A0(nếu có)
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        const commissionA0 = await CommisionModel.findOne({
          transaction: trade.transaction,
          accountId: systemAccountId,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE,
          status: TradeConstant.COMMISION_STATUS.PENDING,
          adsId: trade.adsId,
          tradeId: trade.id
        });
        if (commissionA0) {
          await CommisionModel.updateOne(
            { id: commissionA0.id },
            { status: TradeConstant.COMMISION_STATUS.CANCELLED }
          );
        }
      }
      if (!trade.ipnUrl) {
        trade = await TradeRequestModel.findOne({
          transaction,
          type: TradeConstant.TRADE_TYPE.SELL,
          status: TradeConstant.TRADE_STATUS.CANCELLED
        }).lean();
      }
      if (trade.ipnUrl) {
        const logRequest = await RequestService.requestPost(trade.ipnUrl, null, {
          transaction: trade.transaction,
          partnerTransaction: trade.partnerTransaction,
          status: TradeConstant.TRADE_STATUS.CANCELLED
        }, {});
        console.log('User hủy GD response from ', trade.ipnUrl, JSON.stringify({ logRequest }));
      }
      return reply.api({
        message: 'Hủy giao dịch thành công'
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    throw { message: 'Không tìm thấy tài khoản' };
  } catch (err) {
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};