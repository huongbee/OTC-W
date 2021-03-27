const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'GET',
    path: '/v1/user/balance',
    handler: require('./Module'),
    options: {
      description: 'Lấy số dư tài khoản',
      validate: {},
      tags: ['api', 'v1'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Lấy số dư tài khoản thành công'),
            data: Joi.object({
              currentBalance: Joi.number().example(100000).description('Số dư hiện tại'),
              availableBalance: Joi.number().example(99999).description('Số dư khả dụng')
            })
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Lấy số dư tài khoản thất bại').description('Lấy số dư tài khoản thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];