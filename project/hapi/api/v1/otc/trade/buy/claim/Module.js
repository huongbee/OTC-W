const SettingModel = require('project/models/SettingModel');
const RequestService = require('project/services/RequestService');
const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const Moment = require('moment');
const moment = require('moment');
const AccountModel = require('project/models/AccountModel');
const GeneralConstant = require('project/constants/GeneralConstant');
const numeral = require('numeral');
const NotificationModel = require('project/models/NotificationModel');
const SocialConfig = require('project/config/SocialId');
const SendEmailWorker = require('project/worker/SendEmail');
const SendNotificationWorker = require('project/worker/SendNotification');

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const authInfo = request.auth.credentials;
    const accountInfo = request.auth.authInfo;
    // tìm thông tin GD mua
    const buyTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.BUY,
      accountId: authInfo.accountId
    }).lean();
    console.log('Thong tin GD--------->', JSON.stringify({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.BUY,
      accountId: authInfo.accountId
      // buyTradeRequestInfo
    }));
    if (!buyTradeRequestInfo) {
      throw { message: 'Không tìm thấy thông tin giao dịch' };
    }
    if (buyTradeRequestInfo.status !== TradeConstant.TRADE_STATUS.PAID) {
      throw { message: 'Trạng thái giao dịch không hợp lệ' };
    }
    const sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: buyTradeRequestInfo.transaction,
      type: TradeConstant.TRADE_TYPE.SELL,
      status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
    });
    // kiem tra thoi gian khiếu nại với createdAt
    const now = moment(new Date());
    const createdAt = moment(new Date(buyTradeRequestInfo.createdAt));
    if (now.diff(createdAt, 'minutes') < 15) throw { message: 'Vui lòng đợi 15 phút sau khi tạo giao dịch' };
    // cap nhật trạng thái  cho GD của người mua và lý do khiếu nại
    const claim = {
      status: TradeConstant.CLAIM_STATUS.BUYER_CLAIM,
      sentAt: Moment(new Date()).toISOString(),
      reason: payload.reason,
      accountId: authInfo.accountId // id của người gửi claim
    };
    const updated = await TradeRequestModel.updateMany(
      {
        id: { $in: [sellerTradeRequestInfo.id, buyTradeRequestInfo.id] }
      },
      {
        $set: {
          claim
        }
      },
      { multi: true }
    );
    if (!updated || updated.nModified !== 2) {
      throw { message: 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại' };
    }
    const ipnUrl = sellerTradeRequestInfo.ipnUrl ? sellerTradeRequestInfo.ipnUrl : buyTradeRequestInfo.ipnUrl;
    if (ipnUrl) {
      const partnerTransaction = sellerTradeRequestInfo.partnerTransaction || buyTradeRequestInfo.partnerTransaction || sellerTradeRequestInfo.paymentInfo.content;
      const logRequest = await RequestService.requestPost(ipnUrl, null, {
        transaction: sellerTradeRequestInfo.transaction,
        partnerTransaction,
        status: TradeConstant.TRADE_STATUS.WARNING
      }, {});
      console.log('User hủy GD response from ', ipnUrl, JSON.stringify({ logRequest }));
    }
    const sellerInfo = await AccountModel.findOne({ id: sellerTradeRequestInfo.accountId }).lean();

    SendEmailWorker.pushSendEmail(
      sellerInfo.email,
      `Người mua gửi khiếu nại giao dịch<br>
        Mã giao dịch: <b>#${sellerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(sellerTradeRequestInfo.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết: <a href="${SocialConfig.environment.web}/home/trade/${sellerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
      `WMV thông báo giao dịch KHIẾU NẠI #${sellerTradeRequestInfo.transaction}`,
      'send-notification');
    return reply.api({
      message: 'Đã ghi nhận khiếu nại, chờ xử lý',
      transaction: buyTradeRequestInfo.transaction,
      status: buyTradeRequestInfo.status
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
