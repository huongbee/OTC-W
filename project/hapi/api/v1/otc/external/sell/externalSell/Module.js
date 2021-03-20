const SettingModel = require('project/models/SettingModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const CommisionModel = require('project/models/CommisionModel');
const uniqid = require('uniqid');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const GetUserBalance = require('project/helpers/GetUserBalance');
const UuidService = require('project/services/UuidService');
const Decimal = require('decimal.js');
const ExternalService = require('project/services/ExternalService');
const GeneralConstant = require('project/constants/GeneralConstant');
const BankConstant = require('project/constants/BankConstant');
const Moment = require('moment');
const UserBalanceService = require('project/services/UserBalanceService');
const numeral = require('numeral');
const AccountModel = require('project/models/AccountModel');
const SendEmailWorker = require('project/worker/SendEmail');
const SocialConfig = require('project/config/SocialId');
const SendNotificationWorker = require('project/worker/SendNotification');
const NotificationModel = require('project/models/NotificationModel');

// ĐẠI LÝ MUA V
// User Bán V: Bán 100V, Trừ - 100 V, -3V Fee -> A3: -103V; A2: - 100 VNĐ, + 100V, 2V commission; A1: +1V commission;
// A3 -> A2: 100V Sell Order
// A3 -> A0: 3V commission
// A0 -> A2: 2V commission
// A0 -> A1: 1V commission
module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const partnerInfo = request.auth.partnerInfo;
    const accountInfo = request.auth.accountInfo;

    const bankInfo = BankConstant.find((bank) => bank.swiftCode === payload.paymentInfo.swiftCode);
    if (!bankInfo) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin ngân hàng')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const tradeExist = await TradeRequestModel.findOne({
      partnerTransaction: payload.transaction,
      status: { $nin: [TradeConstant.TRADE_STATUS.FAILED] }
    }).lean();
    if (tradeExist) {
      throw { message: 'Mã giao dịch đã tồn tại' };
    }
    // -100V GD bán và -3V commision seller
    // -100V
    const userBalance = await GetUserBalance(accountInfo);
    let commissionPercent = await SettingModel.findOne({ key: 'COMMISION_PERCENT' }).lean();
    commissionPercent = _.get(commissionPercent, 'value', null) !== null ? commissionPercent.value : GeneralConstant.COMMISION_PERCENT;
    let commissionV = _.toNumber(new Decimal(payload.amount).mul(commissionPercent).div(100));
    commissionV = Math.ceil(commissionV);

    const totalV = _.toNumber(new Decimal(payload.amount).add(commissionV));
    console.log('External SELL: totalV=>>>>', totalV, 'userBalance=>>>>>', JSON.stringify(userBalance));
    if (totalV > userBalance.availableBalance) throw { message: 'Không đủ số V trong tài khoản' };

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
      console.log('Lỗi khởi tạo transaction GD SELL external, không thể lấy UUID');

      throw { message: 'Có lỗi xảy ra, vui lòng thử lại!' };
    }

    let sellRate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
    sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;
    const valueVND = _.toNumber((payload.amount * sellRate));

    let feePercent = await SettingModel.findOne({ key: 'FEE_PERCENT' }).lean();
    feePercent = _.get(feePercent, 'value', null) !== null ? feePercent.value : 1;
    const feeV = commissionV;
    const feeVND = _.toNumber((feeV * feePercent));
    const totalAmount = _.toNumber(new Decimal(payload.amount).add(feeV));
    const totalVND = _.toNumber(new Decimal(valueVND).add(feeVND));
    // Khởi tạo tradeRequest cho seller
    // A3 -> A2: 100V Sell Order
    // A3 -> A0: 3V commission
    let tradeRequestSeller = await TradeRequestModel.create({
      adsId: 0,
      transaction,
      partnerId: partnerInfo.id,
      partnerTransaction: payload.transaction,
      description: payload.description,
      accountId: accountInfo.id,
      type: TradeConstant.TRADE_TYPE.SELL,
      status: TradeConstant.TRADE_STATUS.FAILED,
      amount: payload.amount,
      feeAmount: feeV,
      totalAmount,
      filledAmount: 0,
      value: valueVND,
      fee: feeVND,
      totalValue: totalVND,
      filledValue: 0,
      paymentInfo: {
        // thông tin NH của người bán
        content: payload.content || `SELL${transaction} `,
        swiftCode: bankInfo.swiftCode,
        bankName: bankInfo.vi,
        accountNumber: payload.paymentInfo.accountNumber,
        holder: payload.paymentInfo.holder,
        branch: payload.paymentInfo.branch
      },
      ipnUrl: payload.ipnUrl,
      expiredAt: Moment(new Date()).add(15, 'minutes'),
      proactiveRequest: true
    });
    if (!tradeRequestSeller) {
      throw { message: 'Lỗi hệ thống' };
    }
    const selectedAds = await ExternalService.assignBuyRequest(
      _.get(payload, 'amount'),
      accountInfo.id,
      3,
      tradeRequestSeller.exceptedAccount
    );
    if (selectedAds.code !== 1) {
      throw { message: 'Không tìm thấy quảng cáo phù hợp!' };
    }
    const adsInfo = await AdsModel.findOne({ id: selectedAds.data.id }).lean();
    if (!adsInfo) {
      throw { message: 'Không tìm thấy quảng cáo phù hợp' };
    }
    console.log('adsInfo external SELL======>', JSON.stringify(adsInfo));
    if (payload.amount > adsInfo.amount) {
      throw { message: 'Số V giao dịch không phù hợp' };
    }
    if (payload.amount < adsInfo.minAmount) {
      throw {
        message: `Số V giao dịch tối thiếu là ${numeral(adsInfo.minAmount).format('0,0')}`
      };
    }
    // trừ V trong GD Buy ads
    const adsInfoUpdated = await AdsModel.updateOne(
      { id: adsInfo.id },
      {
        $inc: {
          amount: -payload.amount
        }
      }
    );
    if (!adsInfoUpdated || adsInfoUpdated.nModified !== 1) {
      throw { message: 'Lỗi khởi tạo giao dịch, vui lòng thử lại' };
    }
    tradeRequestSeller = await TradeRequestModel.findOneAndUpdate(
      { id: tradeRequestSeller.id },
      {
        $set: {
          adsId: adsInfo.id,
          status: TradeConstant.TRADE_STATUS.PENDING
        }
      },
      { new: true }
    );
    const userBalanceCreate = await UserBalanceService.minusBalance(
      accountInfo.id,
      payload.amount,
      `Tạo giao dịch bán #${tradeRequestSeller.transaction} `,
      tradeRequestSeller,
      GeneralConstant.SOURCE_NAME.TRADE
    );
    if (userBalanceCreate.code !== 1) {
      //  rollback trade request
      await TradeRequestModel.updateOne({ id: tradeRequestSeller.id }, { status: TradeConstant.TRADE_STATUS.FAILED });
      // trả V
      await AdsModel.updateOne(
        { id: adsInfo.id },
        {
          $inc: {
            amount: payload.amount
          }
        }
      );
      throw { message: 'Tạo giao dịch thất bại' };
    }

    // -3V cua seller
    const userBalanceCommisionCreate = await UserBalanceService.minusBalance(
      accountInfo.id,
      commissionV,
      `Phí thanh toán cho giao dịch #${tradeRequestSeller.transaction} `,
      tradeRequestSeller,
      GeneralConstant.SOURCE_NAME.TRADE_FEE
    );
    if (userBalanceCommisionCreate.code !== 1) {
      //  rollback trade request
      await TradeRequestModel.updateOne({ id: tradeRequestSeller.id }, { status: TradeConstant.TRADE_STATUS.FAILED });
      // trả V
      await AdsModel.updateOne(
        { id: adsInfo.id },
        {
          $inc: {
            amount: payload.amount
          }
        }
      );

      throw { message: 'Tạo giao dịch thất bại' };
    }
    //// A3 -> A0: 3V commission
    // +3V cho A0 (từ 3V của seller)
    // lấy thông tin account A0
    let systemAccountId = null;
    const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
    if (systemAccount) systemAccountId = systemAccount.id;
    const commissionA0 = await CommisionModel.create({
      transaction,
      accountId: systemAccountId,
      sourceName: GeneralConstant.SOURCE_NAME.TRADE,
      status: TradeConstant.COMMISION_STATUS.PENDING,
      amount: commissionV,
      adsId: adsInfo.id,
      tradeId: tradeRequestSeller.id,
      description: `Nhận commision từ giao dịch bán #${tradeRequestSeller.transaction} `,
      type: GeneralConstant.COMMISION_TYPE.COMMISION,
      extraData: {
        adsInfo,
        tradeRequestSeller
      }
    });
    if (!commissionA0) {
      throw { message: 'Tạo yêu cầu bán thất bại, vui lòng thử lại' };
    }
    // tạo GD cho người mua => GD trade cho ADS đã select được
    const tradeRequestBuyer = await TradeRequestModel.create({
      adsId: adsInfo.id,
      transaction,
      accountId: adsInfo.accountId,
      type: TradeConstant.TRADE_TYPE.BUY,
      status: TradeConstant.TRADE_STATUS.PENDING,
      amount: payload.amount,
      description: payload.description,
      feeAmount: 0,
      totalAmount: payload.amount,
      filledAmount: 0,
      value: valueVND,
      fee: 0,
      totalValue: valueVND,
      filledValue: 0,
      extraData: adsInfo,
      paymentInfo: {// thông tin NH của người bán
        content: payload.content || `SELL${transaction} `,
        swiftCode: bankInfo.swiftCode,
        bankName: bankInfo.vi,
        accountNumber: payload.paymentInfo.accountNumber,
        holder: payload.paymentInfo.holder,
        branch: payload.paymentInfo.branch
      },
      expiredAt: Moment(new Date()).add(15, 'minutes')
    });
    if (!tradeRequestBuyer) {
      throw { message: 'Tạo yêu cầu bán thất bại, vui lòng thử lại' };
    }
    /// ko chọn lại acount BUYER cho lần sau
    await TradeRequestModel.updateOne(
      {
        transaction: tradeRequestBuyer.transaction,
        type: TradeConstant.TRADE_TYPE.SELL
      },
      {
        $addToSet: {
          exceptedAccount: adsInfo.accountId
        }
      });

    const buyerInfo = await AccountModel.findOne({ id: adsInfo.accountId }).lean();
    SendEmailWorker.pushSendEmail(
      buyerInfo.email,
      `Quý khách có giao dịch MUA mới<br>
        Mã giao dịch: <b>#${tradeRequestBuyer.transaction}</b> <br>
        Lượng giao dịch: ${numeral(tradeRequestBuyer.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết: <a href="${SocialConfig.environment.web}/home/trade/${tradeRequestBuyer.transaction}" target="_blank">TẠI ĐÂY</a>`,
      `WMV thông báo giao dịch BÁN. #${tradeRequestBuyer.transaction}`,
      'send-notification');
    return reply.api({
      message: request.__('Tạo giao dịch thành công'),
      transaction: tradeRequestSeller.transaction,
      partnerTransaction: tradeRequestSeller.partnerTransaction,
      status: tradeRequestSeller.status,
      amountInfo: {
        amount: tradeRequestSeller.amount,
        fee: tradeRequestSeller.feeAmount,
        total: tradeRequestSeller.totalAmount
      },
      valueInfo: {
        value: tradeRequestSeller.value,
        fee: tradeRequestSeller.fee,
        total: tradeRequestSeller.totalValue
      },
      createdAt: tradeRequestSeller.createdAt,
      updatedAt: tradeRequestSeller.updatedAt,
      expiredAt: tradeRequestSeller.expiredAt
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
