const AuthenticationConfig = require('project/config/Authentication');
const AccountModel = require('project/models/AccountModel');
const AccessTokenModel = require('project/models/AccessTokenModel');
const GeneralConstant = require('../../constants/GeneralConstant');
const moment = require('moment');
const _ = require('lodash');

module.exports = {
  key: AuthenticationConfig.userSecretKey,
  async validate(decoded, request, reply) {
    if (!decoded.id) {
      return { isValid: false };
    }

    const adminInfo = await AccountModel.findOne({
      id: decoded.accountId,
      accountType: GeneralConstant.ACCOUNT_TYPE.ADMIN
    }).select('-_id').lean();
    // console.log('Admin auth:...', JSON.stringify({ decoded, adminInfo }));
    if (!adminInfo) {
      return { isValid: false };
    }
    if (adminInfo.id !== decoded.accountId) {
      console.log('token Admin 1', JSON.stringify({ decoded, accessToken }));
      return { isValid: false };
    }
    if (!adminInfo.isActive) {
      console.log('token Admin 2', JSON.stringify({ decoded, accessToken }));
      return { isValid: false };
    }
    // if (_.intersection(adminInfo.scope || [], _.values(GeneralConstant.ACCOUNT_SCOPE)).length <= 0) { // check scope
    //   return { isValid: false };
    // }
    const accessToken = await AccessTokenModel.findOne({
      id: decoded.id,
      accountId: adminInfo.id
    }).lean();
    if (_.get(accessToken, 'id', false) === false) {
      console.log('accessToken Admin Auth 2 false....', JSON.stringify({ decoded, accessToken }));
      return { isValid: false };
    }
    if (moment(accessToken.expiredAt).isBefore(new Date())) {
      console.log('token Admin expire', JSON.stringify({ decoded, accessToken }));
      return { isValid: false };
    }

    request.auth.accountInfo = adminInfo;
    return { isValid: true };
  }
};
