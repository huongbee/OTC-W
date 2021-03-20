const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'POST',
    path: '/v1/account/login',
    handler: require('./Module'),
    options: {
      auth: false,
      description: 'User login',
      validate: {
        payload: Joi.object({
          account: Joi.string().required().example('superadmin@gmail.com').description('username/email'),
          password: Joi.string().required().example('bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a').description('Mật khẩu'),
          securityCode: Joi.string().allow(null, '').length(6).example('123211').description('OTP xác thực 2 bước')
        })
      },
      tags: ['api', 'v1', 'account'],
      response: {
        status: {
          [Code.REQUEST_SUCCESS]: Joi.object({
            accessToken: Joi.string().example('accessToken').description('Access Token')
          }).description('Thành công'),
          [Code.VERIFY_OTP_REQUIRED]: Joi.object({
            message: Joi.string().example('Vui lòng nhập OTP').description('Lý do thất bại')
          }).description('Thành công'),
          [Code.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại!').description('Lý do thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];
