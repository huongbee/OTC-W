const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/trade-request/confirm_received_vnd',
    handler: require('./Module'),
    options: {
      description: 'Xác nhận đã nhận tiền',
      validate: {
        payload: Joi.object({
          content: Joi.string().required().example('98765432').description('Nội dung chuyển tiền NH'),
          transaction: Joi.string().required().example('98765432').description('Mã GD'),
          amount: Joi.number().required().example(100000).description('Số tiền đã nhận ')
        })
      },
      tags: ['api', 'v1', 'otc-trade-request', 'buy'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Tạo lệnh mua thành công'),
            transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch'),
            status: Joi.string().allow(null, '').example(TradeConstant.TRADE_STATUS.PAID).description('Trạng thái')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Tạo yêu cầu thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];