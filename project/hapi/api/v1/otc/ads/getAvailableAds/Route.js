const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/announcement/available',
    handler: require('./Module'),
    options: {
      description: 'Lấy danh sách quảng cáo hiện có trên sàn',
      validate: {
        payload: Joi.object({
          filter: {
            type: Joi.string().required().example(TradeConstant.ADS_TYPE.SELL).valid(..._.values(TradeConstant.ADS_TYPE)).description('Loại quảng cáo')
          },
          paging: {
            start: Joi.number().required().example(0).default(0)
              .description('Số bắt đầu'),
            limit: Joi.number().required().example(10).max(1000)
              .default(100)
              .description('Số dòng trên 1 trang')
          },
          sort: Joi.object().example({ id: -1 }).default({ id: -1 }).description('Điều kiện sắp xếp dữ liệu')
        })
      },
      tags: ['api', 'v1', 'otc-ads'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            total: Joi.number().allow(null, '').example(12314).description('total'),
            data: Joi.array().items(Joi.object({
              id: Joi.number().allow(null, '').example('1').description('Mã quảng cáo'),
              amount: Joi.number().allow(null, '').example(100000).description('Tổng V'),
              filledAmount: Joi.number().allow(null, '').example(100000).description('V thành công'),
              filledValue: Joi.number().allow(null, '').example(100000).description('VND thành công'),
              updatedAt: Joi.date().allow(null, '').example('2020-12-12 00:00:00').description('Thời gian cập nhật'),
              createdAt: Joi.date().allow(null, '').example('2020-12-12 00:00:00').description('Thời gian tạo'),
              owner: Joi.string().allow(null, '').example('Lệnh Hồ Xung').description('Người bán/mua'),
              paymentType: Joi.string().allow(null, '').example('Chuyển khoản').description('Phương thức giao dịch'),
              status: Joi.string().allow(null, '').example('Hoạt động').description('Trạng thái'),
              transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch')
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