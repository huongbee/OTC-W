const AccountModel = require('project/models/AccountModel');
const AdsModel = require('project/models/AdsModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const GeneralConstant = require('project/constants/GeneralConstant');
const GetUserBalance = require('project/helpers/GetUserBalance');
const UuidService = require('project/services/UuidService');
const Decimal = require('decimal.js');
const BankAccountModel = require('project/models/BankAccountModel');
const SettingModel = require('project/models/SettingModel');
const UserBalanceService = require('project/services/UserBalanceService');
const SendEmailWorker = require('project/worker/SendEmail');
const numeral = require('numeral');
const SocialConfig = require('project/config/SocialId');
const uniqid = require('uniqid');

module.exports = async (request, reply) => {
  try {
    const { amount, type, paymentType } = request.payload;
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    if (_.get(userInfo, 'id', false) === false) {
      throw { message: 'Không tìm thấy tài khoản' };
    }
    if (userInfo.accountType === -1) {
      throw { message: 'Bạn không có quyền thực hiện' };
    }
    // load setting
    if (amount < 10000) throw { message: 'Số V quảng cáo tối thiểu là 10,000' };
    else if (amount > 1000000000) throw { message: 'Số V quảng cáo tối đa là 1,000,000,000' };
    const userBalance = await GetUserBalance(userInfo);
    const minAmount = request.payload.minAmount || 10000;
    if (type === TradeConstant.ADS_TYPE.SELL) {
      if (!minAmount) throw { message: 'Yêu cầu số V tối thiểu' };
      if (minAmount > amount) throw { message: 'Số V tối thiểu phải nhỏ hơn hoặc bằng số V cần giao dịch' };
      if (amount > userBalance.availableBalance) throw { message: 'Không đủ số V trong tài khoản' };
    }
    if (minAmount < 10000) throw { message: 'Số V quảng cáo tối thiểu là 10,000' };
    const paymentInfo = {};
    if (paymentType === TradeConstant.PAYMENT_TYPE.BANKTRANSFER) {
      // lay thông tin NH mặc định của user
      const bankInfo = await BankAccountModel.findOne({ accountId: authInfo.accountId, isDefault: true }).lean();
      if (!bankInfo) {
        throw { message: 'Vui lòng thêm thông tin ngân hàng mặc định' };
      }

      paymentInfo.swiftCode = bankInfo.swiftCode;
      paymentInfo.bankName = bankInfo.bankName;
      paymentInfo.accountNumber = bankInfo.accountNumber;
      paymentInfo.holder = bankInfo.holder;
      paymentInfo.branch = bankInfo.branch;
    }
    const uuidService = new UuidService('OTC_ADS_TRANSACTION');
    const uuidData = await uuidService.getUUID(1, request.payload);
    let transaction = uniqid.process().toUpperCase();
    if (uuidData.code === 1 && uuidData.data.length > 0) {
      transaction = uuidData.data.uuid[0];
    }

    let rate = 1;
    let description = 'Tạo quảng cáo';
    if (type === TradeConstant.ADS_TYPE.SELL) {
      rate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
      description += ` bán #${transaction}`;
    }
    else {
      rate = await SettingModel.findOne({ key: 'RATE_BUY' }).lean();
      description += ` mua #${transaction}`;
    }
    rate = _.get(rate, 'value', null) !== null ? rate.value : 1;
    const valueVND = _.toNumber((amount * rate));

    // - LV1 tạo lệnh mua —> LV0 khớp lệnh
    // - LV1 tạo lệnh bán —> LV2 (con nó) khớp lệnh —> chỉ các LV2 con nó mới có thể nhìn thấy các lệnh của LV1 cha
    // - LV2 tạo lệnh mua-bán —> chỉ khớp với LV3 hoặc LV1 cha nó nhìn thấy và khớp. Các LV2 đồng môn cũng không thấy
    // - LV2 khác địa bàn —> không thấy lệnh của nhau
    let levelAllowed = [0];
    if (userInfo.accountType === 0) {
      levelAllowed = [0, 1];
    }
    if (userInfo.accountType === 1) {
      if (type === TradeConstant.ADS_TYPE.BUY) {
        levelAllowed = [0];
      }
      else { // lệnh bán
        levelAllowed = [2]; // chỉ các LV2 con nó mới có thể nhìn thấy các lệnh của LV1 cha => lọc ở bước lấy ds ADS
      }
    }
    if (userInfo.accountType === 2) {
      levelAllowed = [1, 3];
    }
    const ads = await AdsModel.create({
      accountId: userInfo.id,
      transaction,
      amount,
      minAmount,
      filledAmount: 0,
      value: valueVND,
      type,
      status: TradeConstant.ADS_STATUS.ACTIVE,
      paymentType,
      paymentInfo,
      levelAllowed
    });
    if (!ads) {
      throw { message: 'Lệnh tạo quảng cáo thất bại' };
    }
    if (type === TradeConstant.ADS_TYPE.SELL) {
      // tru V cho GD sell
      const userBalanceCreate = await UserBalanceService.minusBalance(
        userInfo.id,
        amount,
        description,
        ads,
        GeneralConstant.SOURCE_NAME.ADS
      );
      if (userBalanceCreate.code !== 1) {
        // rollback ads
        await AdsModel.updateOne(
          { id: ads.id },
          {
            status: TradeConstant.ADS_STATUS.FAILED
          }
        );
        throw { message: 'Tạo quảng cáo thất bại' };
      }
    }
    if (type === TradeConstant.ADS_TYPE.SELL) {
      SendEmailWorker.pushSendEmail(
        userInfo.email,
        `Quý khách vừa tạo quảng cáo BÁN mới<br>
        Mã quảng cáo: <b>#${ads.transaction}</b> <br>
        Lượng giao dịch: ${numeral(ads.amount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home" target="_blank">TẠI ĐÂY</a>`,
        'Quý khách vừa tạo quảng cáo BÁN',
        'send-notification');
    }
    return reply.api({
      message: request.__('Tạo quảng cáo thành công')
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (err) {
    return reply.api({
      message: request.__(err.message)
    }).code(ResponseCode.REQUEST_FAIL);
  }
};
