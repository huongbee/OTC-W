const SettingModel = require('project/models/SettingModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const GeneralConstant = require('project/constants/GeneralConstant');
const moment = require('moment');
const RequestService = require('project/services/RequestService');

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

    //  kiem tra thoi gian khiếu nại với expiredAt
    const now = moment(new Date());
    const createdAt = moment(new Date(buyTradeRequestInfo.createdAt));
    if (now.diff(createdAt, 'minutes') < 15) throw { message: 'Vui lòng đợi 15 phút sau khi tạo giao dịch' };
    // cap nhật trạng thái  cho GD của người mua và lý do khiếu nại
    const updated = await TradeRequestModel.updateOne(
      {
        id: buyTradeRequestInfo.id
      },
      {
        $set: {
          claim: {
            status: TradeConstant.CLAIM_STATUS.BUYER_CLAIM,
            sentAt: moment(new Date()).toISOString(),
            reason: payload.reason,
            proofImage: payload.proofImage
          }
        }
      });
    if (!updated || updated.nModified !== 1) {
      throw { message: 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại' };
    }
    // cập nhật trạng thái cho người bán, không có lý do
    const claim = {
      status: TradeConstant.CLAIM_STATUS.BUYER_CLAIM,
      sentAt: moment(new Date()).toISOString(),
      reason: payload.reason
    };
    const tradeRequestSeller = await TradeRequestModel.findOneAndUpdate(
      {
        transaction: buyTradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.SELL,
        status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
      },
      {
        $set: {
          claim
        }
      },
      { new: true });
    if (!tradeRequestSeller) {
      throw {
        message: 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại!'
      };
    }
    const ipnUrl = tradeRequestSeller.ipnUrl ? tradeRequestSeller.ipnUrl : buyTradeRequestInfo.ipnUrl;
    if (ipnUrl) {
      const partnerTransaction = tradeRequestSeller.partnerTransaction || buyTradeRequestInfo.partnerTransaction || buyTradeRequestInfo.paymentInfo.content;
      const body = {
        transaction: tradeRequestSeller.transaction,
        partnerTransaction,
        status: TradeConstant.TRADE_STATUS.WARNING
      };
      const logRequest = await RequestService.requestPost(ipnUrl, null, body, {});
      console.log('1----/v1/trade-request/ exteranl buy claim response from ', ipnUrl, JSON.stringify({ body, logRequest }));
    }

    return reply.api({
      message: 'Đã ghi nhận khiếu nại, chờ xử lý',
      transaction: buyTradeRequestInfo.transaction,
      status: TradeConstant.TRADE_STATUS.WARNING
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (err) {
    console.log('🚀 ~ file: Module.js ~ line 64 ~ module.exports= ~ err', err);
    return reply
      .api({
        message: err.message
      })
      .code(ResponseCode.REQUEST_FAIL);
  }
};
