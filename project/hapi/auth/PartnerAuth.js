const AuthenticationConfig = require('project/config/Authentication');
const PartnerModel = require('project/models/PartnerModel');
const AccountModel = require('project/models/AccountModel');
const AccessTokenModel = require('project/models/AccessTokenModel');
const moment = require('moment');
const _ = require('lodash');

module.exports = {
  key: AuthenticationConfig.partnerSecretKey,
  async validate(decoded, request, reply) {
    console.log('Partner Auth decoded:', JSON.stringify(decoded));
    const partnerInfo = await PartnerModel.findOne({ id: decoded.partnerId }).select('-_id').lean();
    if (!partnerInfo || !partnerInfo.isActive) {
      return { isValid: false };
    }
    // get accountInfo
    const userInfo = await AccountModel.findOne({ id: partnerInfo.accountId }).select('-_id').lean();
    if (!userInfo) {
      return { isValid: false };
    }
    if (userInfo.id !== decoded.accountId) {
      return { isValid: false };
    }
    if (decoded.id) { // token sinh ra do user login => có accessToken id
      const accessToken = await AccessTokenModel.findOne({
        id: decoded.id,
        accountId: decoded.accountId
      }).lean();

      // console.log('accessToken Default Auth 2....', JSON.stringify({ decoded, accessToken }));
      if (_.get(accessToken, 'id', false) === false) {
        console.log('accessToken Partner Auth 2 false....', JSON.stringify({ decoded, accessToken }));
        return { isValid: false };
      }
      if (moment(accessToken.expiredAt).isBefore(new Date())) {
        console.log('token expire', JSON.stringify({ decoded, accessToken }));
        return { isValid: false };
      }
    }
    request.auth.partnerInfo = partnerInfo;
    request.auth.accountInfo = userInfo;
    return { isValid: true };
  }
};
