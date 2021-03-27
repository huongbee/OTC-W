const SettingModel = require('project/models/SettingModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const BankAccountModel = require('project/models/BankAccountModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const GetUserBalance = require('project/helpers/GetUserBalance');
const UuidService = require('project/services/UuidService');
const Decimal = require('decimal.js');
const GeneralConstant = require('project/constants/GeneralConstant');
const uniqid = require('uniqid');
const Moment = require('moment');
const UserBalanceService = require('project/services/UserBalanceService');
const AccountModel = require('project/models/AccountModel');
const SendEmailWorker = require('project/worker/SendEmail');
const numeral = require('numeral');
const SocialConfig = require('project/config/SocialId');
const PartnerModel = require('project/models/PartnerModel');
const CommisionModel = require('project/models/CommisionModel');
const ExternalService = require('project/services/ExternalService');

// User Bán V => khớp lệnh BUY => tỉnh tỉ giá BUY
// Đại lý mua V
module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const authInfo = request.auth.credentials;
    const accountInfo = request.auth.accountInfo;
    let adsInfo = null;

    // tim thong tin bank của user sell
    const bankInfo = await BankAccountModel.findOne({ accountId: authInfo.accountId, isDefault: true }).lean();
    if (!bankInfo) {
      throw { message: 'Vui lòng thêm thông tin ngân hàng mặc định' };
    }
    if (payload.amount > 100000000 || payload.amount < 10000) {
      throw { message: 'Số V giao dịch không phù hợp' };
    }
    if (accountInfo.accountType === 3) { // danh cho account đối tác C3
      const partnerInfo = await PartnerModel.findOne({ accountId: authInfo.accountId }).lean();
      // if (!partnerInfo) {
      //   throw { message: 'Không tìm thấy thông tin đối tác' };
      // }

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

      const uuidService = new UuidService('OTC_TRADE_TRANSACTION');
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
        partnerId: partnerInfo ? partnerInfo.id : null,
        partnerTransaction: _.toUpper(uniqid.process('self')),
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
          swiftCode: bankInfo.swiftCode,
          bankName: bankInfo.vi || bankInfo.bankName,
          accountNumber: bankInfo.accountNumber,
          holder: bankInfo.holder,
          branch: bankInfo.branch
        },
        ipnUrl: null,
        expiredAt: Moment(new Date()).add(15, 'minutes'),
        proactiveRequest: true
      });
      if (!tradeRequestSeller) {
        throw { message: 'Lỗi hệ thống' };
      }
      //  chỉ lấy GD của user cấp 2
      const selectedAds = await ExternalService.assignBuyRequest(
        _.get(payload, 'amount'),
        accountInfo.id,
        3,
        tradeRequestSeller.exceptedAccount
      );
      console.log('selectedAds selectedAds', JSON.stringify(selectedAds));
      if (selectedAds.code !== 1) {
        throw { message: selectedAds.message };
      }
      const adsInfo = await AdsModel.findOne({ id: selectedAds.data.id }).lean();
      if (!adsInfo) {
        throw { message: 'Không tìm thấy quảng cáo phù hợp' };
      }
      if (payload.amount > adsInfo.amount) {
        throw { message: 'Số V giao dịch không phù hợp' };
      }
      if (payload.amount < adsInfo.minAmount) {
        throw { message: `Số V giao dịch tối thiếu là ${numeral(adsInfo.minAmount).format('0,0')}` };
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
        `Tạo giao dịch bán #${tradeRequestSeller.transaction}`,
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
        `Phí thanh toán cho giao dịch #${tradeRequestSeller.transaction}`,
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
        description: `Nhận commision từ giao dịch bán #${tradeRequestSeller.transaction}`,
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
        feeAmount: 0,
        totalAmount: payload.amount,
        filledAmount: 0,
        value: valueVND,
        fee: 0,
        totalValue: valueVND,
        filledValue: 0,
        extraData: adsInfo,
        paymentInfo: {// thông tin NH của người bán
          content: payload.content || `SELL${transaction}`,
          swiftCode: bankInfo.swiftCode,
          bankName: bankInfo.vi || bankInfo.bankName,
          accountNumber: bankInfo.accountNumber,
          holder: bankInfo.holder,
          branch: bankInfo.branch
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
      // push teleram notification
      const buyerInfo = await AccountModel.findOne({ id: adsInfo.accountId }).lean();
      // SendEmailWorker.pushSendEmail(
      //   buyerInfo.email,
      //   `Quý khách có giao dịch MUA mới<br>
      //   Mã giao dịch: <b>#${tradeRequestBuyer.transaction}</b> <br>
      //   Lượng giao dịch: ${numeral(tradeRequestBuyer.totalAmount).format('0,0')} </b> <br>
      //   Xem chi tiết: <a href="${SocialConfig.environment.web}/home/trade/${tradeRequestBuyer.transaction}" target="_blank">TẠI ĐÂY</a>`,
      //   `WMV thông báo giao dịch BÁN. #${tradeRequestBuyer.transaction}`,
      //   'send-notification');
      return reply.api({
        message: request.__('Tạo giao dịch thành công'),
        transaction: tradeRequestSeller.transaction,
        status: tradeRequestSeller.status,
        amount: tradeRequestSeller.amount,
        minAmount: tradeRequestSeller.minAmount,
        feeAmount: tradeRequestSeller.feeAmount,
        totalAmount: tradeRequestSeller.totalAmount,
        paymentType: tradeRequestSeller.paymentType,
        paymentInfo: {
          content: tradeRequestSeller.paymentInfo.content,
          swiftCode: tradeRequestSeller.paymentInfo.swiftCode,
          bankName: tradeRequestSeller.paymentInfo.bankName,
          accountNumber: tradeRequestSeller.paymentInfo.accountNumber,
          holder: tradeRequestSeller.paymentInfo.holder,
          branch: tradeRequestSeller.paymentInfo.branch
        },
        createdAt: tradeRequestSeller.createdAt,
        updatedAt: tradeRequestSeller.updatedAt,
        expiredAt: tradeRequestSeller.expiredAt
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    if (!payload.adsId) {
      throw { message: 'Vui lòn chọn quảng cáo!' };
    }
    adsInfo = await AdsModel.findOne({ id: payload.adsId, type: TradeConstant.TRADE_TYPE.BUY }).lean();
    if (!adsInfo) {
      throw { message: 'Không tìm thấy thông tin quảng cáo' };
    }
    console.log('adsInfo external SELL======>', JSON.stringify(adsInfo));
    if (payload.amount > adsInfo.amount) {
      throw { message: 'Số V giao dịch không phù hợp' };
    }
    if (payload.amount < adsInfo.minAmount) {
      throw { message: `Số V giao dịch tối thiếu là ${numeral(adsInfo.minAmount).format('0,0')}` };
    }
    if (adsInfo.accountId === authInfo.accountId) {
      throw { message: 'Không thể thực hiện bán với giao giao dịch của chính bạn' };
    }
    // kiểm tra số dư V
    let feePercent = await SettingModel.findOne({ key: 'FEE_PERCENT' }).lean();
    feePercent = _.get(feePercent, 'value', null) !== null ? feePercent.value : 0;
    const feeV = 0;
    const totalAmount = _.toNumber(new Decimal(payload.amount).add(feeV));
    const userBalance = await GetUserBalance({ id: authInfo.accountId });
    if (userBalance.availableBalance < totalAmount) throw { message: 'Không đủ số V trong tài khoản' };

    // trừ V trong GD Buy ads
    const adsInfoUpdated = await AdsModel.findOneAndUpdate(
      { id: adsInfo.id },
      {
        $inc: {
          amount: -payload.amount
        }
      },
      { new: true });

    const uuidService = new UuidService('OTC_TRADE_TRANSACTION');
    const uuidData = await uuidService.getUUID(1, payload);
    let transaction = uniqid.process().toUpperCase();
    if (uuidData.code === 1 && uuidData.data.length > 0) {
      transaction = uuidData.data.uuid[0];
    }

    let sellRate = await SettingModel.findOne({ key: 'RATE_BUY' }).lean();
    sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;
    const valueVND = _.toNumber((payload.amount * sellRate).toFixed(2));

    const feeVND = _.toNumber((feeV * feePercent).toFixed(2));
    // Khởi tạo tradeRequest cho seller
    // A3 -> A2: 100V Sell Order
    // A3 -> A0: 3V commission
    let tradeRequestSeller = await TradeRequestModel.create({
      adsId: adsInfoUpdated.id,
      transaction,
      partnerId: null,
      partnerTransaction: null,
      accountId: authInfo.accountId,
      type: TradeConstant.TRADE_TYPE.SELL,
      status: TradeConstant.TRADE_STATUS.FAILED,
      amount: payload.amount,
      feeAmount: feeV,
      totalAmount,
      filledAmount: 0,
      value: valueVND,
      feeValue: feeVND,
      totalValue: valueVND,
      filledValue: 0,
      extraData: adsInfoUpdated,
      paymentInfo: {
        // thông tin NH của người bán
        content: `SELL${transaction} `,
        swiftCode: bankInfo.swiftCode,
        bankName: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
        holder: bankInfo.holder,
        branch: bankInfo.branch
      },
      ipnUrl: null,
      expiredAt: Moment(new Date()).add(15, 'minutes'),
      proactiveRequest: true
    });
    if (!tradeRequestSeller) {
      throw { message: 'Tạo yêu cầu mua thất bại, vui lòng thử lại!' };
    }

    const userBalanceTradeCreate = await UserBalanceService.minusBalance(
      authInfo.accountId,
      payload.amount,
      `Bán V #${tradeRequestSeller.transaction} `,
      tradeRequestSeller,
      GeneralConstant.SOURCE_NAME.TRADE
    );
    if (userBalanceTradeCreate.code !== 1) {
      throw { message: 'Tạo giao dịch thất bại' };
    }
    tradeRequestSeller = await TradeRequestModel.findOneAndUpdate(
      { id: tradeRequestSeller.id },
      { $set: { status: TradeConstant.TRADE_STATUS.PENDING } },
      { new: true }
    );

    // tạo GD cho người mua => GD trade cho ADS đã select được
    const tradeRequestBuyer = await TradeRequestModel.create({
      adsId: adsInfo.id,
      transaction,
      accountId: adsInfo.accountId,
      type: TradeConstant.TRADE_TYPE.BUY,
      status: TradeConstant.TRADE_STATUS.PENDING,
      amount: payload.amount,
      feeAmount: 0,
      totalAmount: payload.amount,
      filledAmount: 0,
      value: valueVND,
      feeValue: 0,
      totalValue: valueVND,
      filledValue: 0,
      extraData: adsInfo,
      paymentInfo: {// thông tin NH của người bán
        content: `SELL${transaction} `,
        swiftCode: bankInfo.swiftCode,
        bankName: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
        holder: bankInfo.holder,
        branch: bankInfo.branch
      },
      expiredAt: Moment(new Date()).add(15, 'minutes')
    });
    if (!tradeRequestBuyer) {
      throw { message: 'Tạo yêu cầu bán thất bại, vui lòng thử lại' };
    }

    // push teleram notification
    const buyerInfo = await AccountModel.findOne({ id: adsInfo.accountId }).lean();
    // SendEmailWorker.pushSendEmail(
    //   buyerInfo.email,
    //   `Quý khách có giao dịch MUA mới < br >
    //     Mã giao dịch: <b>#${tradeRequestBuyer.transaction}</b> <br>
    //       Lượng giao dịch: ${numeral(tradeRequestBuyer.totalAmount).format('0,0')} </b> <br>
    //         Xem chi tiết: <a href="${SocialConfig.environment.web}/home/trade/${tradeRequestBuyer.transaction}" target="_blank">TẠI ĐÂY</a>`,
    //   `WMV thông báo giao dịch BÁN. #${tradeRequestBuyer.transaction}`,
    //   'send-notification');
    return reply.api({
      message: request.__('Tạo giao dịch thành công'),
      transaction: tradeRequestSeller.transaction,
      status: tradeRequestSeller.status,
      amount: tradeRequestSeller.amount,
      minAmount: tradeRequestSeller.minAmount,
      feeAmount: tradeRequestSeller.feeAmount,
      totalAmount: tradeRequestSeller.totalAmount,
      paymentType: tradeRequestSeller.paymentType,
      paymentInfo: {
        content: tradeRequestSeller.paymentInfo.content,
        swiftCode: tradeRequestSeller.paymentInfo.swiftCode,
        bankName: tradeRequestSeller.paymentInfo.bankName,
        accountNumber: tradeRequestSeller.paymentInfo.accountNumber,
        holder: tradeRequestSeller.paymentInfo.holder,
        branch: tradeRequestSeller.paymentInfo.branch
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
