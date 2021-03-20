const AdsModel = require('project/models/AdsModel');
const BankAccountModel = require('project/models/BankAccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const GeneralConstant = require('project/constants/GeneralConstant');

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const params = request.params;
    const authInfo = request.auth.credentials;
    const userInfo = request.auth.accountInfo; //await AccountModel.findOne({ id: authInfo.accountId }).lean();

    // if (_.get(userInfo, 'id', false) === false) {
    //   return reply.api({
    //     message: request.__('Không tìm thấy tài khoản')
    //   }).code(ResponseCode.REQUEST_FAIL);
    // }
    if (payload.isDefault === true) {
      // có chọn set default
      const deleteDefault = await BankAccountModel.updateMany(
        {
          accountId: authInfo.accountId
        },
        { isDefault: false }
      );

      if (deleteDefault.nModified == 0) {
        return reply.api({
          message: request.__('Đặt tài khoản mặc định thất bại')
        }).code(ResponseCode.REQUEST_FAIL);
      }
    }

    const setDefault = await BankAccountModel.updateOne(
      {
        accountId: authInfo.accountId,
        id: params.id
      },
      { isDefault: payload.isDefault }
    );

    // cập nhật lại thông tin ngân hàng mặc định trong ADS
    const bankInfo = await BankAccountModel.findOne({
      accountId: authInfo.accountId,
      isDefault: true
    }).lean();
    if (!bankInfo) {
      await BankAccountModel.updateOne(
        {
          accountId: authInfo.accountId,
          id: params.id
        },
        { isDefault: !payload.isDefault }
      );
      return reply.api({
        message: request.__('Vui lòng cài đặt ít nhất một ngân hàng mặc định')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    if (bankInfo) {
      const paymentInfo = {
        swiftCode: bankInfo.swiftCode,
        bankName: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
        holder: bankInfo.holder,
        branch: bankInfo.branch
      };
      // tìm thông tin bank có trong ads => update bank trong ads
      const updateData = await AdsModel.updateMany(
        {
          status: { $in: [TradeConstant.ADS_STATUS.ACTIVE, TradeConstant.ADS_STATUS.INACTIVE] },
          paymentType: TradeConstant.PAYMENT_TYPE.BANKTRANSFER,
          accountId: bankInfo.accountId
        },
        {
          $set: {
            paymentInfo
          }
        }
      );
      console.log({ bankInfo, updateData }, {
        'paymentInfo.swiftCode': bankInfo.swiftCode,
        'paymentInfo.accountNumber': bankInfo.accountNumber,
        status: { $in: [TradeConstant.ADS_STATUS.ACTIVE, TradeConstant.ADS_STATUS.INACTIVE] },
        paymentType: TradeConstant.PAYMENT_TYPE.BANKTRANSFER
      });
    }

    if (setDefault && setDefault.nModified > 0) {

      return reply.api({
        message: request.__('Cập nhật thành công')
      }).code(ResponseCode.REQUEST_SUCCESS);
    }

    return reply.api({
      message: request.__('Cập nhật thất bại')
    }).code(ResponseCode.REQUEST_FAIL);
  }
  catch (err) {
    throw err;
  }
};