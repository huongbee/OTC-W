const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

// không cho phép hủy giao dịch SELL
module.exports = [
  {
    method: 'DELETE',
    path: '/v1/external/sell',
    handler: require('./Module'),
    options: {
      auth: 'Partner',
      description: 'Hủy giao dịch bán',
      validate: {
        payload: Joi.object({
          transaction: Joi.string().required().example('98765432').description('Mã GD')
        })
      },
      tags: ['api', 'v1', 'external', 'external sell'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Tạo lệnh mua thành công'),
            transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch'),
            status: Joi.string().allow(null, '').example(TradeConstant.TRADE_STATUS.CANCELLED).description('Trạng thái')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Tạo yêu cầu thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];