const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'GET',
    path: '/v1/external/sell-rate',
    handler: require('./Module'),
    options: {
      auth: 'Partner',
      description: 'Partner lấy tỉ giá bán',
      tags: ['api', 'v1', 'otc-external-api'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            rate: Joi.number().example(1.05).description('Tỉ giá bán')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];
