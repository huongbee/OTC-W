const SettingModel = require('project/models/SettingModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const uniqid = require('uniqid');
const UuidService = require('project/services/UuidService');
const ExternalService = require('project/services/ExternalService');
const Moment = require('moment');
const AccountModel = require('project/models/AccountModel');
const GeneralConstant = require('project/constants/GeneralConstant');
const SendEmailWorker = require('project/worker/SendEmail');
const numeral = require('numeral');
const SocialConfig = require('project/config/SocialId');
const PartnerModel = require('project/models/PartnerModel');
const SendNotificationWorker = require('project/worker/SendNotification');
const NotificationModel = require('project/models/NotificationModel');

// User Mua V: Mua 100V, Trả 100 VND -> A3 - 100VNĐ; A2: +100VNĐ, -100V, +2V bonus; A1: +1 V bonus; A0: -3V bonus;
// A2 -> A3: 100V Buy Order
// A0 -> A2: 2V bonus
// A0 -> A1: 1V bonus

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const authInfo = request.auth.credentials;
    const accountInfo = request.auth.accountInfo;
    let partnerInfo = null;
    let adsInfo = null;
    console.log('accountInfo', JSON.stringify(accountInfo));
    if (accountInfo.accountType === 3) {
      const selectedAds = await ExternalService.assignSellRequest(
        _.get(payload, 'amount'),
        accountInfo.id,
        3,
        []
      );
      if (selectedAds.code !== 1) {
        throw { message: selectedAds.message };
      }
      adsInfo = selectedAds.data;
      partnerInfo = await PartnerModel.findOne({ accountId: authInfo.accountId }).lean();
      // if (!partnerInfo) {
      //   throw { message: 'Không tìm thấy thông tin đối tác' };
      // }
    } else {
      adsInfo = await AdsModel.findOne({ id: payload.adsId, type: TradeConstant.TRADE_TYPE.SELL }).lean();
    }
    if (!adsInfo) {
      throw { message: 'Không tìm thấy thông tin quảng cáo' };
    }
    console.log('adsInfo external BUY======>', JSON.stringify(adsInfo));
    if (payload.amount > adsInfo.amount) {
      throw { message: 'Số V mua không phù hợp' };
    }
    if (payload.amount < adsInfo.minAmount) {
      throw { message: `Số V giao dịch tối thiếu là ${numeral(adsInfo.minAmount).format('0,0')}` };
    }
    if (adsInfo.accountId === authInfo.accountId) {
      throw { message: 'Không thể thực hiện mua với giao giao dịch của chính bạn' };
    }
    const uuidService = new UuidService('TRADE_TRANSACTION_PROD');
    let uuidData = await uuidService.getUUID(1, payload);
    let transaction = uniqid.process().toUpperCase();
    if (uuidData.code === 1 && uuidData.data.length > 0) {
      transaction = uuidData.data.uuid[0];
    } else {
      uuidData = await uuidService.getUUID(1, payload); // thử lại lần 2
      if (uuidData.code === 1 && uuidData.data.length > 0) {
        transaction = uuidData.data.uuid[0];
      }
    }
    if (isNaN(transaction)) {
      throw { message: 'Có lỗi xảy ra, vui lòng thử lại!' };
    }

    // trừ V trong GD ads
    const adsInfoUpdated = await AdsModel.findOneAndUpdate(
      { id: adsInfo.id },
      {
        $inc: {
          amount: -payload.amount
        }
      },
      { new: true }
    );

    // Khởi tạo tradeRequest cho buyer
    if (_.get(adsInfoUpdated, 'paymentInfo', null) !== null) {
      adsInfoUpdated.paymentInfo.content = `BUY${transaction}`;
    }
    let buyRate = await SettingModel.findOne({ key: 'RATE_BUY' }).lean();
    buyRate = _.get(buyRate, 'value', null) !== null ? buyRate.value : 1;
    const valueVND = _.toNumber((payload.amount * buyRate).toFixed(2));

    // let feePercent = await SettingModel.findOne({ key: 'FEE_PERCENT' }).lean();
    // feePercent = _.get(feePercent, 'value', null) !== null ? feePercent.value : 0.3;
    // const feeVND = _.toNumber(new Decimal(payload.amount).mul(feePercent).div(100).toFixed(2));
    // const totalVND = _.toNumber(new Decimal(valueVND).plus(feeVND));
    // console.log({ valueVND, amount: payload.amount, feeVND, totalVND, buyRate });

    const feeVND = 0;
    const totalVND = valueVND;
    const feeAmountV = 0;
    const totalAmountV = _.toNumber(payload.amount) + feeAmountV;
    const tradeRequestBuyer = await TradeRequestModel.create({
      adsId: adsInfoUpdated.id,
      transaction,
      partnerId: partnerInfo ? partnerInfo.id : null,
      partnerTransaction: _.toUpper(uniqid.process('self')),
      accountId: authInfo.accountId,
      type: TradeConstant.TRADE_TYPE.BUY,
      status: TradeConstant.TRADE_STATUS.PENDING,
      amount: payload.amount,
      feeAmount: feeAmountV,
      totalAmount: totalAmountV,
      filledAmount: 0,
      value: valueVND,
      fee: feeVND,
      totalValue: totalVND,
      filledValue: 0,
      extraData: adsInfoUpdated,
      paymentInfo: adsInfoUpdated.paymentInfo,
      ipnUrl: null,
      expiredAt: Moment(new Date()).add(15, 'minutes'),
      proactiveRequest: true
    });
    if (!tradeRequestBuyer) {
      // + lại V
      await AdsModel.updateOne(
        { id: adsInfo.id },
        {
          $inc: {
            amount: payload.amount
          }
        });
      throw { message: 'Tạo yêu cầu mua thất bại, vui lòng thử lại' };
    }
    // Khởi tạo tradeRequest cho seller
    const tradeRequestSeller = await TradeRequestModel.create({
      adsId: adsInfoUpdated.id,
      transaction,
      accountId: adsInfoUpdated.accountId,
      type: TradeConstant.TRADE_TYPE.SELL,
      status: TradeConstant.TRADE_STATUS.PENDING,
      amount: payload.amount,
      feeAmount: feeAmountV,
      totalAmount: totalAmountV,
      filledAmount: 0,
      value: valueVND,
      fee: feeVND,
      totalValue: totalVND,
      filledValue: 0,
      extraData: adsInfoUpdated,
      paymentInfo: adsInfoUpdated.paymentInfo,  // thông tin NH của người bán
      expiredAt: Moment(new Date()).add(15, 'minutes')
    });
    if (!tradeRequestSeller) {
      await AdsModel.updateOne(
        { id: adsInfo.id },
        {
          $inc: {
            amount: payload.amount
          }
        });
      await TradeRequestModel.updateOne({ id: tradeRequestBuyer.id }, { status: TradeConstant.TRADE_STATUS.FAILED });
      throw { message: 'Tạo yêu cầu mua thất bại, vui lòng thử lại!' };
    }

    // push teleram notification
    const sellerInfo = await AccountModel.findOne({ id: adsInfo.accountId }).lean();
    console.log('sellerInfosellerInfo', JSON.stringify(sellerInfo));

    SendEmailWorker.pushSendEmail(
      sellerInfo.email,
      `Quý khách có giao dịch BÁN mới <br>
        Mã giao dịch: <b>#${tradeRequestSeller.transaction}</b> <br>
        Lượng giao dịch: ${numeral(tradeRequestSeller.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${tradeRequestSeller.transaction}" target="_blank">TẠI ĐÂY</a>`,
      `WMV thông báo giao dịch BÁN. Mã #${tradeRequestSeller.transaction}`,
      'send-notification');
    return reply.api({
      message: request.__('Tạo giao dịch thành công'),
      transaction: tradeRequestBuyer.transaction,
      status: tradeRequestBuyer.status,
      amount: tradeRequestBuyer.amount,
      minAmount: tradeRequestBuyer.minAmount,
      value: tradeRequestBuyer.value,
      fee: tradeRequestBuyer.fee,
      totalValue: tradeRequestBuyer.totalValue,
      paymentInfo: {
        content: tradeRequestBuyer.paymentInfo.content,
        swiftCode: tradeRequestBuyer.paymentInfo.swiftCode,
        bankName: tradeRequestBuyer.paymentInfo.bankName,
        accountNumber: tradeRequestBuyer.paymentInfo.accountNumber,
        holder: tradeRequestBuyer.paymentInfo.holder,
        branch: tradeRequestBuyer.paymentInfo.branch
      },
      paymentType: tradeRequestBuyer.paymentType,
      createdAt: tradeRequestBuyer.createdAt,
      updatedAt: tradeRequestBuyer.updatedAt,
      expiredAt: tradeRequestBuyer.expiredAt
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
