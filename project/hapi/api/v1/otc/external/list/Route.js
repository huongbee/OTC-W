const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/external/trade/list',
    handler: require('./Module'),
    options: {
      auth: 'Partner',
      description: 'Lấy danh sách lệnh trade đã',
      validate: {
        payload: Joi.object({
          filter: {
            type: Joi.string().allow(null, '').example(TradeConstant.ADS_TYPE.SELL).valid(..._.values(TradeConstant.ADS_TYPE)).description('Loại quảng cáo'),
            transaction: Joi.number().allow(null, '').example(1000).description('MÃ GD đối tác')
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
      tags: ['api', 'v1', 'external', 'external buy', 'external sell'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Lấy danh sách quảng cáo thành công'),
            data: Joi.array().items(Joi.object({
              adsId: Joi.number().allow(null, '').example(1).description('Mã quảng cáo'),
              partnerId: Joi.number().allow(null, '').example(1000).description('Id đối tác'),
              partnerTransaction: Joi.number().allow(null, '').example(1000).description('MÃ GD đối tác'),
              id: Joi.number().example(1).allow(null, '').description('Id'),
              accountId: Joi.number().allow(null, '').example(1).description('Id user'),
              amount: Joi.number().allow(null, '').example(100000).description('Số V'),
              feeAmount: Joi.number().allow(null, '').example(100000).description('Số fee V'),
              totalAmount: Joi.number().allow(null, '').example(100000).description('Số tổng V và fee V'),
              filledAmount: Joi.number().allow(null, '').example(1999).description('Số V đã giao dịch thành công'),
              fee: Joi.number().allow(null, '').example(1000).description('Fee giao dịch'),
              totalValue: Joi.number().allow(null, '').example(1000).description('Tổng tiền VND có fee giao dịch'),
              value: Joi.number().allow(null, '').example(20000).description('Số vnđ thực tế'),
              filledValue: Joi.number().allow(null, '').example(2222).description('Số tiền vnd (không có fee) đã giao dịch thành công'),
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
                holder: Joi.string().allow(null, '').example('TT133222').description('Tên chủ thẻ')
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