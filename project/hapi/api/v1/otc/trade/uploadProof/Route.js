const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/trade-request/upload',
    handler: require('./Module'),
    options: {
      payload: {
        output: 'stream',
        maxBytes: 1024 * 1024 * 20,
        allow: 'multipart/form-data',
        multipart: true
      },
      description: 'Upload bằng chứng chuyển tiền',
      validate: {
        payload: Joi.object({
          files: Joi.required().example('Files').description('Files'),
          transaction: Joi.required().example('234567832343').description('transaction Id')
        })
      },
      tags: ['api', 'v1'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Upload thành công').description('Upload thành công'),
            data: Joi.array().items(Joi.object({
              fileName: Joi.string().allow(null, '').example('DDDDDDD.jpg'),
              state: Joi.string().allow(null, '').example('SUCCEEDED'),
              message: Joi.string().allow(null, '').example('Thành công'),
              path: Joi.string().allow(null, '').example('http://localhost/trades/VVVVVV/DDDDDD.jpg')
            }))
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Upload thất bại').description('Upload thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];