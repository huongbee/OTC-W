const ResponseCode = require('project/constants/ResponseCode');
const AccountModel = require('project/models/AccountModel');
const AccessTokenModel = require('project/models/AccessTokenModel');
const moment = require('moment');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const accountInfo = await AccountModel.findOneAndUpdate(
      {
        id: authInfo.accountId
      },
      { lastedLogoutAt: moment(new Date()) }
    );
    await AccessTokenModel.deleteMany({ accountId: accountInfo.id });
    return reply.api({
      message: request.__('Thành công')
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (error) {
    throw (error);
  }
};
