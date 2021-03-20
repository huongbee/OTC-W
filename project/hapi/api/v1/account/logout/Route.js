const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'POST',
    path: '/v1/account/logout',
    handler: require('./Module'),
    options: {
      description: 'User logout',
      validate: {
      },
      tags: ['api', 'v1', 'account'],
      response: {
        status: {
          [Code.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Thành công')
          }).description('Thành công'),
          [Code.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại!').description('Lý do thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];
