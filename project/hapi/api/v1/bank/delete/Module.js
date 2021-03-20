const AccountModel = require('project/models/AccountModel');
const BankAccountModel = require('project/models/BankAccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const AdsModel = require('project/models/AdsModel');
const _ = require('lodash');
const TradeConstant = require('project/constants/TradeConstant');

module.exports = async (request, reply) => {
  try {
    const { id } = request.payload;
    const authInfo = request.auth.credentials;
    // const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    // if(_.get(userInfo, 'id', false) === false) {
    //   return reply.api({
    //     message: request.__('Không tìm thấy tài khoản')
    //   }).code(ResponseCode.REQUEST_FAIL);
    // }
    const bankInfo = await BankAccountModel.findOne(
      {
        accountId: authInfo.accountId,
        id: id
      }
    );
    if (!bankInfo) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin ngân hàng')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    // tìm thông tin bank có trong ads
    const adsInfo = await AdsModel.findOne({
      'paymentInfo.swiftCode': bankInfo.swiftCode,
      'paymentInfo.accountNumber': bankInfo.accountNumber,
      status: { $in: [TradeConstant.ADS_STATUS.ACTIVE, TradeConstant.ADS_STATUS.INACTIVE] }
    });
    if (adsInfo) {
      return reply.api({
        message: request.__('Ngân hàng đang được sử dụng trong quảng cáo, vui lòng thử lại')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const result = await BankAccountModel.deleteOne(
      {
        accountId: authInfo.accountId,
        id: id
      }
    );

    if (result.deletedCount > 0) {
      return reply.api({
        message: request.__('Xoá thông tin ngân hàng thành công')
      }).code(ResponseCode.REQUEST_SUCCESS);
    }

    return reply.api({
      message: request.__('Xoá thông tin ngân hàng thất bại')
    }).code(ResponseCode.REQUEST_FAIL);
  }
  catch (err) {
    throw err;
  }
};