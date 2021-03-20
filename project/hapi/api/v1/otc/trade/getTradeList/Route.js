const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/trade-request/user-trade-list',
    handler: require('./Module'),
    options: {
      description: 'Lấy danh sách giao dịch của user ',
      validate: {
        payload: Joi.object({
          filter: {
            status: Joi.string().allow(null, '').example(TradeConstant.TRADE_STATUS.PENDING).valid(..._.values(TradeConstant.TRADE_STATUS)).description('Trạng thái giao dịch')
          },
          paging: {
            start: Joi.number().required().example(0).default(0)
              .description('Số bắt đầu'),
            limit: Joi.number().required().example(10).max(1000)
              .default(100)
              .description('Số dòng trên 1 trang')
          },
          sort: Joi.object().example({ createdAt: -1 }).default({ createdAt: -1 }).description('Điều kiện sắp xếp dữ liệu')
        })
      },
      tags: ['api', 'v1', 'otc-trade-request'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            total: Joi.number().example(123).description('Total'),
            data: Joi.array().items(Joi.object({
              transaction: Joi.string().allow(null, '').example('124141555').description('Mã giao dịch'),
              amount: Joi.number().allow(null, '').example(100000).description('Số V'),
              amountConfirmReceived: Joi.number().allow(null, '').example(100000).description('Số V người mua đã xác nhận chuyển khoản'),
              value: Joi.number().allow(null, '').example(100000).description('Số VND'),
              type: Joi.string().example('SELL').description('Loại lệnh'),
              createdAt: Joi.date().allow(null, '').example('2020-12-16 00:00:00').description('Thời gian'),
              status: Joi.string().allow(null, '').example('PENDING').description('Trạng thái'),
              description: Joi.string().allow(null, '').example('Thanh toán đơn hàng của ABC').description('Chi tiết đơn hàng')
            }))
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại').description('Lấy chi tiết giao dịch thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];