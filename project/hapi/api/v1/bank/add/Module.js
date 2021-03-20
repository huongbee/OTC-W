const AccountModel = require('project/models/AccountModel');
const BankAccountModel = require('project/models/BankAccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const BankConstant = require('project/constants/BankConstant');

const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const authInfo = request.auth.credentials;
    // const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    // if(_.get(userInfo, 'id', false) === false) {
    //   return reply.api({
    //     message: request.__('Không tìm thấy tài khoản')
    //   }).code(ResponseCode.REQUEST_FAIL);
    // }

    // kiểm tra nếu tài khoản ngân hàng đã được thêm trước đó
    const bankInfo = BankConstant.find((bank) => bank.swiftCode === payload.swiftCode);
    if (!bankInfo) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin ngân hàng')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const isExisted = await BankAccountModel.findOne({
      $and: [
        { accountNumber: payload.accountNumber },
        // { swiftCode: payload.swiftCode },
        { accountId: authInfo.accountId }
      ]
    }).lean();

    if (isExisted) {
      return reply.api({
        message: request.__('Tài khoản ngân hàng đã có sẵn')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const numberOfBankAccount = await BankAccountModel.countDocuments({ accountId: authInfo.accountId });

    // đặt tài khoản ngân hàng đầu tiên làm mặc định
    // const isHavingBankAccount = await BankAccountModel.findOne({ accountId: userInfo.id });

    const result = await BankAccountModel.create({
      accountId: authInfo.accountId,
      isDefault: (numberOfBankAccount > 0) ? false : true,
      swiftCode: bankInfo.swiftCode,
      accountNumber: _.trim(payload.accountNumber),
      bankName: bankInfo.vi,
      holder: payload.holder,
      branch: payload.branch,
      area: payload.area
    });

    if (!result) {
      return reply.api({
        message: request.__('Thêm tài khoản ngân hàng thất bại')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    return reply.api({
      message: request.__('Thêm tài khoản ngân hàng thành công')
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};