const SettingModel = require('project/models/SettingModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const moment = require('moment');
const GeneralConstant = require('project/constants/GeneralConstant');

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const partnerInfo = request.auth.partnerInfo;
    const accountInfo = request.auth.accountInfo;

    // tìm thông tin GD mua
    const buyTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.BUY,
      partnerId: partnerInfo.id,
      accountId: accountInfo.id
    }).lean();
    console.log('Thong tin GD--------->', JSON.stringify({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.BUY,
      partnerId: partnerInfo.id,
      accountId: accountInfo.id
      // buyTradeRequestInfo
    }));
    if (!buyTradeRequestInfo) {
      throw { message: 'Không tìm thấy thông tin giao dịch' };
    }
    if (buyTradeRequestInfo.status !== TradeConstant.TRADE_STATUS.PENDING) {
      throw { message: 'Trạng thái giao dịch không được phép hủy' };
    }
    const now = moment(new Date());
    const expiredAt = moment(new Date(buyTradeRequestInfo.expiredAt));
    if (now.diff(expiredAt, 'minutes') < 15) throw { message: 'Chỉ được hủy giao dịch 15 phút sau khi tạo' };
    // cap nhật trạng thái đã thanh toán cho GD của người bán và cả người mua
    const changedStatus = {
      from: buyTradeRequestInfo.status,
      to: TradeConstant.TRADE_STATUS.CANCELLED,
      reason: payload.reason,
      accountAction: accountInfo.id,
      updatedAt: new Date()
    };
    const updated = await TradeRequestModel.updateMany(
      {
        transaction: buyTradeRequestInfo.transaction,
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
      { id: buyTradeRequestInfo.adsId },
      {
        $inc: {
          amount: buyTradeRequestInfo.amount
        }
      });
    if (!adsInfoUpdated || adsInfoUpdated.nModified !== 1) {

      throw { message: 'Không thể hoàn trả cho quảng cáo, vui lòng kiểm tra lại' };
    }

    return reply.api({
      transaction: buyTradeRequestInfo.transaction,
      status: TradeConstant.TRADE_STATUS.EXPIRED
    }).code(ResponseCode.REQUEST_SUCCESS);
    // chuyển V cho user mua => accouuntId của partner => chuyển đến bước user bán xác nhận đã nhận tiền
  } catch (err) {
    console.log('🚀 ~ file: Module.js ~ line 64 ~ module.exports= ~ err', err);
    return reply
      .api({
        message: err.message
      })
      .code(ResponseCode.REQUEST_FAIL);
  }
};
