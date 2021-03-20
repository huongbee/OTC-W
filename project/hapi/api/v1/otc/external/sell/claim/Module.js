const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const moment = require('moment');
const RequestService = require('project/services/RequestService');

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
    // kiem tra thoi gian khiếu nại với createdAt
    const now = moment(new Date());
    const createdAt = moment(new Date(sellTradeRequestInfo.createdAt));
    if (now.diff(createdAt, 'minutes') < 15) throw { message: 'Vui lòng đợi 15 phút sau khi tạo giao dịch' };
    // cap nhật trạng thái  cho GD của người bán và lý do khiếu nại
    const updated = await TradeRequestModel.updateOne(
      {
        id: sellTradeRequestInfo.id
      },
      {
        $set: {
          claim: {
            status: TradeConstant.CLAIM_STATUS.SELLER_CLAIM,
            sentAt: moment(new Date()).toISOString(),
            reason: payload.reason
          }
        }
      });
    if (!updated || updated.nModified !== 1) {
      throw { message: 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại' };
    }
    const claim = {
      status: TradeConstant.CLAIM_STATUS.SELLER_CLAIM,
      sentAt: moment(new Date()).toISOString(),
      reason: payload.reason
    };
    // cập nhật trạng thái cho người mua, không có lý do
    const buyTradeRequestInfo = await TradeRequestModel.findOneAndUpdate(
      {
        transaction: sellTradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.BUY,
        status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
      },
      {
        $set: {
          claim
        }
      });
    if (!buyTradeRequestInfo) {
      throw {
        message: 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại!'
      };
    }
    // GD commision của A3->A0 chưa thay đổi trạng thái
    const ipnUrl = sellTradeRequestInfo.ipnUrl ? sellTradeRequestInfo.ipnUrl : buyTradeRequestInfo.ipnUrl;
    if (ipnUrl) {
      const partnerTransaction = sellTradeRequestInfo.partnerTransaction || buyTradeRequestInfo.partnerTransaction || buyTradeRequestInfo.paymentInfo.content;
      const body = {
        transaction: buyTradeRequestInfo.transaction,
        partnerTransaction,
        status: TradeConstant.TRADE_STATUS.WARNING
      };
      const logRequest = await RequestService.requestPost(ipnUrl, null, body, {});
      console.log('1----/v1/trade-request/ exteranl buy claim response from ', ipnUrl, JSON.stringify({ body, logRequest }));
    }

    return reply.api({
      message: 'Đã ghi nhận khiếu nại, chờ xử lý',
      transaction: sellTradeRequestInfo.transaction,
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
