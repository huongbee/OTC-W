const _ = require('lodash');
const JsonWebToken = require('jsonwebtoken');
const ResponseCode = require('project/constants/ResponseCode');
const AccountModel = require('project/models/AccountModel');
const AccessTokenModel = require('project/models/AccessTokenModel');
const AuthenticationConfig = require('project/config/Authentication');
const RedisService = require('project/services/RedisService');
const PasswordHelper = require('project/helpers/PasswordHelper');

const Login = async (request, reply) => {
  try {
    const payload = request.payload;

    let accountInfo = {};
    accountInfo = await AccountModel.findOne({
      $or: [
        { email: _.trim(payload.account) },
        { username: _.trim(payload.account) }
      ]
    }).lean();
    if (_.get(accountInfo, 'id', false) === false) {
      return reply.api({
        message: request.__('Thông tin đăng nhập không chính xác')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    let check = await RedisService.get(`LOCK_USER_${accountInfo.id}`);
    check = _.toNumber(check) || 0;
    if (check === 3) {
      return reply.api({
        message: request.__('Bạn đã đăng nhập sai quá 3 lần liên tiếp, vui lòng thử lại sau ít phút!')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    if (accountInfo.isActive !== true) {
      return reply.api({
        message: request.__('Tài khoản hiện đã bị khoá!')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    const passwordHelper = new PasswordHelper();
    if (_.get(accountInfo, 'id', false) === false || passwordHelper.comparePassword(payload.password, accountInfo.password) === false) {
      // push to redis
      await RedisService.set(`LOCK_USER_${accountInfo.id}`, check + 1, 10 * 60);
      return reply.api({
        message: request.__('Thông tin đăng nhập không chính xác!!')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    await AccessTokenModel.updateMany(
      {
        accountId: accountInfo.id,
        isExpired: false
      },
      {
        isExpired: true
      });
    const accessTokenCreated = await AccessTokenModel.create({
      accountId: accountInfo.id
    });

    if (_.get(accessTokenCreated, 'id', false) === false) {
      return reply.api({
        message: request.__('Đăng nhập thất bại')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    const accessTokenInfo = {
      id: accessTokenCreated.id,
      accountId: accountInfo.id,
      isActive: accountInfo.isActive
    };
    // remove in redis
    await RedisService.delete(`LOCK_USER_${accountInfo.id}`);
    return reply.api({
      accessToken: JsonWebToken.sign(accessTokenInfo, AuthenticationConfig.userSecretKey)
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (error) {
    throw (error);
  }
};

module.exports = Login;
