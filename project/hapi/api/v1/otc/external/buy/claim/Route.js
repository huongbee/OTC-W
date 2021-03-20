const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/external/buy/claim',
    handler: require('./Module'),
    options: {
      auth: 'Partner',
      description: 'Khiếu nại giao dịch mua',
      validate: {
        payload: Joi.object({
          transaction: Joi.string().required().example('98765432').description('Mã GD'),
          reason: Joi.string().required().example('Tôi đã chuyển tiền nhưng chưa nhận được được coin').description('Lý do'),
          proofImage: Joi.string().allow(null, '').example('https://static.wmv.money/12345678.png').description('đường dẫn file BCCT')
        })
      },
      tags: ['api', 'v1', 'external', 'external buy'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Đã ghi nhận khiếu nại'),
            transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch'),
            status: Joi.string().allow(null, '').example(TradeConstant.TRADE_STATUS.WARNING).description('Trạng thái')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Tạo yêu cầu thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];