const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/announcement/search',
    handler: require('./Module'),
    options: {
      description: 'Lấy danh sách quảng cáo theo level',
      validate: {
        payload: Joi.object({
          filter: {
            level: Joi.number().required().valid(1, 2, 3),
            type: Joi.string().allow('', null).valid('BUY', 'SELL').required().example('BUY')
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
            message: Joi.string().example('Thành công').description('Lấy danh sách quảng cáo thành công'),
            data: Joi.array().items(Joi.object({
              id: Joi.number().example(1).allow(null, '').description('Id'),
              accountId: Joi.number().allow(null, '').example(1).description('Id user'),
              amount: Joi.number().allow(null, '').example(100000).description('Số V'),
              feeAmount: Joi.number().allow(null, '').example(3).description('Fee V, tính bằng V, cho GD bán'),
              totalAmount: Joi.number().allow(null, '').example(100003).description('Tổng V GD, bao gồm fee V'),
              filledAmount: Joi.number().allow(null, '').example(1999).description('Số V đã giao dịch thành công'),
              value: Joi.number().allow(null, '').example(20000).description('Số vnđ giao dịch'),
              fee: Joi.number().allow(null, '').example(2).description('Số  fee vnđ '),
              totalValue: Joi.number().allow(null, '').example(20002).description('Tổng vnđ giao dịch, bao gồm feeVND'),
              filledValue: Joi.number().allow(null, '').example(2222).description('Số tiền vnd đã giao dịch thành công'),
              minAmount: Joi.number().allow(null, '').example(1000).description('Số V tối thiểu của một giao dịch'),
              type: Joi.string().allow(null, '').example(TradeConstant.ADS_TYPE.SELL).valid(..._.values(TradeConstant.ADS_TYPE)).description('Loại quảng cáo'),
              status: Joi.string().allow(null, '').example(TradeConstant.ADS_STATUS.ACTIVE).description('Trạng thái'),
              paymentType: Joi.string().allow(null, '').example(TradeConstant.PAYMENT_TYPE.BANKTRANSFER).valid(..._.values(TradeConstant.PAYMENT_TYPE)).description('Hình thức giao dịch'),
              createdAt: Joi.date().allow(null, '').example(Date()).description('Ngày tạo quảng cáo'),
              updatedAt: Joi.date().allow(null, '').example(Date()).description('Ngày cập nhật quảng cáo'),
              transaction: Joi.string().allow(null, '').example('12345123').description('Mã giao dịch'),
              paymentInfo: Joi.object({
                content: Joi.string().allow(null, '').example('TT133222').description('Nội dung giao dịch'),
                swiftCode: Joi.string().allow(null, '').example('ASCBVNVX').description('swiftCode'),
                bankName: Joi.string().allow(null, '').example('BIDV').description('Tên ngân hàng'),
                accountNumber: Joi.string().allow(null, '').example('TT133222').description('STK'),
                holder: Joi.string().allow(null, '').example('TT133222').description('Tên chủ thẻ'),
                branch: Joi.string().allow(null, '').example('Ho Chi Minh').description('Chi nhánh')
              })
            })),
            totalRecords: Joi.number().example('1000').description('Tổng records')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại').description('Lấy danh sách quảng cáo thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];