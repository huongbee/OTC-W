const moment = require('moment');
const _ = require('lodash');
const AccessTokenModel = require('project/models/AccessTokenModel');
const AccountModel = require('project/models/AccountModel');
const AuthenticationConfig = require('../../config/Authentication');

module.exports = {
  key: AuthenticationConfig.userSecretKey,
  async validate(decoded, request, reply) {
    if (!decoded.id) {
      return { isValid: false };
    }
    const user = await AccountModel.findOne({ id: decoded.accountId }).lean();
    //console.log('Default Auth user', JSON.stringify(user));
    if (!user) {
      return { isValid: false };
    }
    // console.log('Default Auth request.url.pathname', request.url.pathname);
    if (!user.isActive) {
      console.log('Default Auth request.url.pathname', request.url.pathname);
      return { isValid: false };
    }
    const accessToken = await AccessTokenModel.findOne({
      id: decoded.id,
      accountId: decoded.accountId
    }).lean();
    if (_.get(accessToken, 'id', false) === false) {
      console.log('accessToken Default Auth 2 false....', JSON.stringify({ decoded, accessToken }));
      return { isValid: false };
    }
    if (moment(accessToken.expiredAt).isBefore(new Date())) {
      console.log('token expire', JSON.stringify({ decoded, accessToken }));
      return { isValid: false };
    }
    request.auth.accountInfo = user;
    return { isValid: true };
  }
};
