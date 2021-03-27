const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'DELETE',
    path: '/v1/trade-request/{transaction}/{type?}',
    handler: require('./Module'),
    options: {
      description: 'Hủy giao dịch ',
      validate: {
        params: Joi.object({
          transaction: Joi.string().example('345678906543').description('Mã giao dịch'),
          type: Joi.string().example(TradeConstant.TRADE_TYPE.BUY).valid(..._.values(TradeConstant.TRADE_TYPE)).description('Loại GD')
        })
      },
      tags: ['api', 'v1', 'otc-trade-request', 'buy'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Hủy giao dịch thành công').description('Hủy giao dịch thành công')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Hủy giao dịch thất bại').description('Hủy giao dịch thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];