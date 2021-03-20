const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/external/sell',
    handler: require('./Module'),
    options: {
      auth: 'Partner',
      description: 'Thực hiện yêu cầu bán V',
      validate: {
        payload: Joi.object({
          amount: Joi.number().required().example(100000).min(1000).description('Số vnđ cần bán'),
          transaction: Joi.string().required().example('98765432').description('Mã GD của đối tác'),
          content: Joi.string().example('Nội dung thanh toán cho ngân hàng').allow(null, '').description('Nội dung thanh toán'),
          description: Joi.string().allow(null, '').example('Thanh toán  đơn hàng của ABC').description('Chi tiết đơn hàng'),
          paymentInfo: Joi.object({
            swiftCode: Joi.string().required().example('ASCBVNVX').description('swiftCode'),
            accountNumber: Joi.string().required().example('TT133222').description('STK'),
            holder: Joi.string().required().example('TT133222').description('Tên chủ thẻ'),
            branch: Joi.string().required().example('Ho Chi Minh').description('Chi nhánh')
          }),
          ipnUrl: Joi.string().allow(null, '').example('http://localhost.vn').description('callback url sau khi GD thành công')
        })
      },
      tags: ['api', 'v1', 'external', 'external sell'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Thành công'),
            transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch'),
            partnerTransaction: Joi.string().allow(null, '').example('100015678').description('MÃ GD đối tác'),
            status: Joi.string().allow(null, '').example(TradeConstant.TRADE_STATUS.PENDING).description('Trạng thái'),
            amountInfo: {
              amount: Joi.number().allow(null, '').example(100000).description('Số V'),
              fee: Joi.number().allow(null, '').example(100000).description('Số fee V'),
              total: Joi.number().allow(null, '').example(100000).description('Số tổng V và fee V')
            },
            valueInfo: {
              value: Joi.number().allow(null, '').example(20000).description('Số vnđ thực tế tương ứng với số V'),
              fee: Joi.number().allow(null, '').example(1000).description('Fee giao dịch vnđ'),
              total: Joi.number().allow(null, '').example(1000).description('Tổng tiền VND có fee giao dịch')
            },
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
