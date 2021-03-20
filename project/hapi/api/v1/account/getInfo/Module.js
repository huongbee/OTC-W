const AccountModel = require('project/models/AccountModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const SocialConfig = require('project/config/SocialId');
const BankAccountModel = require('project/models/BankAccountModel');
const ScopeGroupModel = require('project/models/ScopeGroupModel');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    if (_.get(userInfo, 'id', false) !== false) {

      const bankInfo = await BankAccountModel.findOne({ accountId: authInfo.accountId, isDefault: true }).lean();

      let requiredUserInfo = false;
      if (!userInfo.phone || !userInfo.contactPhone || !userInfo.telegram || !bankInfo) {
        requiredUserInfo = true;
      }
      const scopesGroup = await ScopeGroupModel.find({
        id: { $in: userInfo.scope }
      }).select('-_id id name description scopes').lean();

      return reply.api({
        phone: userInfo.phone,
        contactPhone: userInfo.contactPhone,
        email: userInfo.email,
        fullname: userInfo.fullname,
        avatar: userInfo.avatar,
        birthday: userInfo.birthday,
        address: userInfo.address,
        username: userInfo.username,
        createdAt: userInfo.createdAt,
        id: userInfo.id,
        isSetPassword: userInfo.password ? false : true,
        isActive: userInfo.isActive,
        twoStepVerifyChannel: userInfo.twoStepVerifyChannel || [],
        facebook: userInfo.facebook,
        telegram: userInfo.telegram,
        accountType: userInfo.accountType,
        refLink: _.toNumber(userInfo.accountType) < 2 ? `${SocialConfig.environment.web}?ref=${userInfo.id}` : null,
        requiredUserInfo,
        scope: scopesGroup
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    return reply.api({
      message: request.__('Không thể lấy thông tin User')
    }).code(ResponseCode.REQUEST_FAIL);

  } catch (err) {
    throw err;
  }
};