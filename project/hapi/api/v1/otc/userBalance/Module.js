const AccountModel = require('project/models/AccountModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const GetUserBalance = require('project/helpers/GetUserBalance');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();
    if (_.get(userInfo, 'id', false) !== false) {
      const data = await GetUserBalance(userInfo);

      return reply.api({
        message: 'Thành công',
        data
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    throw { message: 'Không tìm thấy tài khoản' };
  } catch (err) {
    console.log(err.message);
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};