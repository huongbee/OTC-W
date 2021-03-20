const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'DELETE',
    path: '/v1/announcement/{id}',
    handler: require('./Module'),
    options: {
      description: 'Hủy quảng cáo',
      validate: {
        params: Joi.object({
          id: Joi.number().required().example(1).description('Id')
        })
      },
      tags: ['api', 'v1', 'otc-ads'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Hủy quảng cáo thành công').description('Hủy quảng cáo thành công')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Hủy quảng cáo thất bại').description('Hủy quảng cáo thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];