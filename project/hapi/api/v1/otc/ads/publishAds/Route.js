const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/announcement',
    handler: require('./Module'),
    options: {
      description: 'Tạo quảng cáo',
      validate: {
        payload: Joi.object({
          amount: Joi.number().required().example(100000).description('Số V'),
          minAmount: Joi.number().optional().example(10000).default(10000).description('Số V tối thiểu của một giao dịch'),
          type: Joi.string().required().example(TradeConstant.ADS_TYPE.SELL).valid(..._.values(TradeConstant.ADS_TYPE)).description('Loại quảng cáo'),
          paymentType: Joi.string().example(TradeConstant.PAYMENT_TYPE.BANKTRANSFER).required().valid(..._.values(TradeConstant.PAYMENT_TYPE)).description('Hình thức giao dịch')
        })
      },
      tags: ['api', 'v1', 'otc-ads'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Tạo quảng cáo thành công'),
            adsId: Joi.number().allow(null, '').example('1').description('Mã quảng cáo')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại').description('Tạo quảng cáo thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];