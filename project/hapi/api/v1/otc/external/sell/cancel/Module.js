const AdsModel = require('project/models/AdsModel');
const CommisionModel = require('project/models/CommisionModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const GeneralConstant = require('project/constants/GeneralConstant');
const UserBalanceService = require('project/services/UserBalanceService');
const moment = require('moment');
const SocialConfig = require('project/config/SocialId');
const AccountModel = require('project/models/AccountModel');

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const partnerInfo = request.auth.partnerInfo;
    const accountInfo = request.auth.accountInfo;

    // tìm thông tin GD bán
    const sellTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.SELL,
      partnerId: partnerInfo.id,
      accountId: accountInfo.id
    }).lean();
    console.log('Thong tin GD--------->', JSON.stringify({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.SELL,
      partnerId: partnerInfo.id,
      accountId: accountInfo.id
      // sellTradeRequestInfo
    }));
    if (!sellTradeRequestInfo) {
      throw { message: 'Không tìm thấy thông tin giao dịch' };
    }
    if (!_.includes([TradeConstant.TRADE_STATUS.PENDING, TradeConstant.TRADE_STATUS.PAID], sellTradeRequestInfo.status)) {
      throw { message: 'Trạng thái giao dịch không được phép hủy' };
    }
    const now = moment(new Date());
    const expiredAt = moment(new Date(sellTradeRequestInfo.expiredAt));
    if (now.diff(expiredAt, 'minutes') < 60) throw { message: 'Chỉ được hủy giao dịch 60 phút sau khi tạo' };
    const changedStatus = {
      from: sellTradeRequestInfo.status,
      to: TradeConstant.TRADE_STATUS.CANCELLED,
      reason: 'User hủy giao dịch',
      accountAction: accountInfo.id,
      updatedAt: new Date()
    };
    // cap nhật trạng thái đã thanh toán cho GD của người bán và cả người mua
    const updated = await TradeRequestModel.updateMany(
      {
        transaction: sellTradeRequestInfo.transaction,
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
      { multi: true });
    if (!updated || updated.nModified !== 2) {
      throw { message: 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại' };
    }
    // trả V lại cho ADS sell
    const adsInfoUpdated = await AdsModel.updateOne(
      { id: sellTradeRequestInfo.adsId },
      {
        $inc: {
          amount: sellTradeRequestInfo.amount
        }
      });
    if (!adsInfoUpdated || adsInfoUpdated.nModified !== 1) {
      throw { message: 'Không thể hoàn trả cho quảng cáo, vui lòng kiểm tra lại' };
    }
    const adsInfo = await AdsModel.findOne({
      id: sellTradeRequestInfo.adsId
    }).lean();
    if (adsInfo.type === TradeConstant.ADS_TYPE.BUY) {
      const addBalanceSeller = await UserBalanceService.addBalance(
        sellTradeRequestInfo.accountId,
        sellTradeRequestInfo.totalAmount, // trả V và cả phí V
        `Hoàn trả V do lệnh SELL #${sellTradeRequestInfo.transaction} bị hủy`,
        sellTradeRequestInfo,
        GeneralConstant.SOURCE_NAME.TRADE_EXPIRED
      );
      console.log('addBalanceSelleraddBalanceSeller', JSON.stringify(addBalanceSeller));
      if (addBalanceSeller.code !== 1) {

        return reply.api({
          message: 'Hoàn V cho lệnh Trade bị hủy không thành công'
        }).code(ResponseCode.REQUEST_FAIL);
      }
      // hủy commision đã tạo cho A0(nếu có)
      let systemAccountId = null;
      const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
      if (systemAccount) systemAccountId = systemAccount.id;
      const commissionA0 = await CommisionModel.findOne({
        transaction: sellTradeRequestInfo.transaction,
        accountId: systemAccountId,
        sourceName: GeneralConstant.SOURCE_NAME.TRADE,
        status: TradeConstant.COMMISION_STATUS.PENDING,
        adsId: sellTradeRequestInfo.adsId,
        tradeId: sellTradeRequestInfo.id
      });
      if (commissionA0) {
        await CommisionModel.updateOne(
          { id: commissionA0.id },
          { status: TradeConstant.COMMISION_STATUS.CANCELLED }
        );
      }
    }
    return reply.api({
      transaction: sellTradeRequestInfo.transaction,
      status: TradeConstant.TRADE_STATUS.EXPIRED
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (err) {
    console.log('🚀 ~ file: Module.js ~ line 64 ~ module.exports= ~ err', err);
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};
