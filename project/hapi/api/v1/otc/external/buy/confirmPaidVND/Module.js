const SettingModel = require('project/models/SettingModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const GetUserBalance = require('project/helpers/GetUserBalance');
const UuidService = require('project/services/UuidService');
const Decimal = require('decimal.js');
const ExternalService = require('project/services/ExternalService');
const AccountModel = require('project/models/AccountModel');
const GeneralConstant = require('project/constants/GeneralConstant');
const numeral = require('numeral');
const SocialConfig = require('project/config/SocialId');
const NotificationModel = require('project/models/NotificationModel');
const SendEmailWorker = require('project/worker/SendEmail');
const SendNotificationWorker = require('project/worker/SendNotification');

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const partnerInfo = request.auth.partnerInfo;
    const accountInfo = request.auth.accountInfo;

    // tìm thông tin GD mua của đối tác
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
      throw { message: 'Trạng thái giao dịch không hợp lệ' };
    }
    let sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: buyTradeRequestInfo.transaction,
      type: TradeConstant.TRADE_TYPE.SELL
    });
    // kiểm tra amountVND đã gửi có trùng với amount của GD hay ko

    // cap nhật trạng thái đã thanh toán cho GD của người bán và cả người mua
    const changedStatus = {
      from: buyTradeRequestInfo.status,
      to: TradeConstant.TRADE_STATUS.PAID,
      reason: 'Người mua xác nhận đã thanh toán VNĐ',
      accountAction: accountInfo.id,
      updatedAt: new Date()
    };
    const updated = await TradeRequestModel.updateMany(
      {
        id: { $in: [buyTradeRequestInfo.id, sellerTradeRequestInfo.id] }
      },
      {
        $set: {
          status: TradeConstant.TRADE_STATUS.PAID,
          proof: {
            filePath: payload.proofImage,
            sentAt: new Date()
          },
          'paymentInfo.content': payload.content || buyTradeRequestInfo.paymentInfo.content
        },
        $push: {
          changedStatus
        }
      },
      { multi: true });
    if (!updated || updated.nModified !== 2) {
      throw { message: 'Có lỗi thực thi giao dịch, vui lòng kiểm tra lại' };
    }
    const sellerInfo = await AccountModel.findOne({ id: sellerTradeRequestInfo.accountId }).lean();
    SendEmailWorker.pushSendEmail(
      sellerInfo.email,
      `*Người mua đã xác nhận chuyển tiền cho giao dịch BÁN của quý khách đã tạo<br>
        Mã giao dịch: <b>#${sellerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(sellerTradeRequestInfo.amount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${sellerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a> `,
      `WMV thông báo giao dịch BÁN. Mã #${sellerTradeRequestInfo.transaction}`,
      'send-notification');
    return reply.api({
      transaction: buyTradeRequestInfo.transaction,
      status: TradeConstant.TRADE_STATUS.PAID
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
