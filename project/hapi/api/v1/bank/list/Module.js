const AccountModel = require('project/models/AccountModel');
const BankAccountModel = require('project/models/BankAccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const { paging: { start, limit } } = request.payload;
    const authInfo = request.auth.credentials;
    // const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    // if (_.get(userInfo, 'id', false) === false) {
    //   return reply.api({
    //     message: request.__('Không tìm thấy tài khoản')
    //   }).code(ResponseCode.REQUEST_FAIL);
    // }

    const bank = await BankAccountModel.find({ accountId: authInfo.accountId })
      .select('-_id id isDefault accountNumber swiftCode bankName holder branch area')
      .skip(start)
      .limit(limit)
      .lean();

    return reply.api({
      items: bank
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};