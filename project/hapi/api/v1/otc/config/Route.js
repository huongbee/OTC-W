const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/config/list',
    handler: require('./Module'),
    options: {
      description: 'Lấy configs',
      validate: {
        payload: Joi.object({
          filter: Joi.object({
            keys: Joi.array().items(Joi.string().required().example('rate').description('Key Config'))
          })
        })
      },
      tags: ['api', 'v1', 'otc-config'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Thành công'),
            data: Joi.array().items(Joi.object({
              key: Joi.string().example('rate').description('Key'),
              value: Joi.any().example(1.05).description('Value')
            }))
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại').description('Thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];