const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'PUT',
    path: '/v1/announcement/{id}',
    handler: require('./Module'),
    options: {
      description: 'Cập nhật quảng cáo',
      validate: {
        params: Joi.object({
          id: Joi.number().required().example(1).description('Id')
        }),
        payload: Joi.object({
          amount: Joi.number().optional().example(100000).description('Số V'),
          minAmount: Joi.number().optional().example(1000).description('Số V tối thiểu của một giao dịch'),
          status: Joi.string().optional().example(TradeConstant.ADS_STATUS.ACTIVE).valid(TradeConstant.ADS_STATUS.ACTIVE, TradeConstant.ADS_STATUS.INACTIVE).description('Trạng thái'),
          paymentType: Joi.string().example(TradeConstant.PAYMENT_TYPE.BANKTRANSFER).optional().valid(..._.values(TradeConstant.PAYMENT_TYPE)).description('Hình thức giao dịch')
        })
      },
      tags: ['api', 'v1', 'otc-ads'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Cập nhật quảng cáo thành công').description('Cập nhật quảng cáo thành công')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Cập nhật quảng cáo thất bại').description('Cập nhật quảng cáo thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];