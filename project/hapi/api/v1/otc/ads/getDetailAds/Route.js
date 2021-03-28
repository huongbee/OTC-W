const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'GET',
    path: '/v1/announcement/{id}',
    handler: require('./Module'),
    options: {
      description: 'Lấy chi tiết quảng cáo',
      validate: {
        params: Joi.object({
          id: Joi.number().required().example(1).description('Mã quảng cáo')
        })
      },
      tags: ['api', 'v1', 'otc-ads'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            id: Joi.number().allow(null, '').example('1').description('Mã quảng cáo'),
            amount: Joi.number().allow(null, '').example(100000).description('Tổng V'),
            filledAmount: Joi.number().allow(null, '').example(100000).description('V thành công'),
            value: Joi.number().allow(null, '').example(100000).description('VND thành công'),
            updatedAt: Joi.date().allow(null, '').example('2020-12-12 00:00:00').description('Thời gian cập nhật'),
            createdAt: Joi.date().allow(null, '').example('2020-12-12 00:00:00').description('Thời gian tạo'),
            paymentType: Joi.string().allow(null, '').example('Chuyển khoản').description('Phương thức giao dịch'),
            status: Joi.string().allow(null, '').example('Hoạt động').description('Trạng thái'),
            transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại').description('Lấy chi tiết giao dịch thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];