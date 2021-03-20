const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/trade-request/sell',
    handler: require('./Module'),
    options: {
      description: 'Thực hiện yêu cầu bán V',
      validate: {
        payload: Joi.object({
          amount: Joi.number().required().example(100000).min(1000).description('Số V cần mua, là số nguyên'),
          adsId: Joi.number().allow(null, '').example(1).description('Mã quảng cáo')
        })
      },
      tags: ['api', 'v1', 'otc-trade-request', 'sell'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Thành công'),
            transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch'),
            status: Joi.string().allow(null, '').example(TradeConstant.ADS_STATUS.ACTIVE).description('Trạng thái'),
            amount: Joi.number().allow(null, '').example(100000).description('Số V'),
            feeAmount: Joi.number().allow(null, '').example(100000).description('Số fee V'),
            totalAmount: Joi.number().allow(null, '').example(100000).description('Số tổng V và fee V'),
            minAmount: Joi.number().allow(null, '').example(1000).description('Số V tối thiểu của một giao dịch'),
            paymentInfo: Joi.object({
              content: Joi.string().allow(null, '').example('TT133222').description('Nội dung giao dịch'),
              swiftCode: Joi.string().allow(null, '').example('ASCBVNVX').description('swiftCode'),
              bankName: Joi.string().allow(null, '').example('BIDV').description('Tên ngân hàng'),
              accountNumber: Joi.string().allow(null, '').example('TT133222').description('STK'),
              holder: Joi.string().allow(null, '').example('TT133222').description('Tên chủ thẻ'),
              branch: Joi.string().allow(null, '').example('Ho Chi Minh').description('Chi nhánh')
            }),
            paymentType: Joi.string().allow(null, '').example(TradeConstant.PAYMENT_TYPE.BANKTRANSFER).valid(..._.values(TradeConstant.PAYMENT_TYPE)).description('Hình thức giao dịch'),
            expiredAt: Joi.date().allow(null, '').example(Date()).description('Thời gian hết hạn giao dịch'),
            createdAt: Joi.date().allow(null, '').example(Date()).description('Ngày tạo giao dịch'),
            updatedAt: Joi.date().allow(null, '').example(Date()).description('Ngày cập nhật giao dịch')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Tạo yêu cầu thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];
