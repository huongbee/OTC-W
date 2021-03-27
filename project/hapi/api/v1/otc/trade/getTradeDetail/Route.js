const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'GET',
    path: '/v1/trade/{transaction}',
    handler: require('./Module'),
    options: {
      description: 'Lấy chi tiết giao dịch trade',
      validate: {
        params: Joi.object({
          transaction: Joi.string().example('98765432123').description('transaction')
        })
      },
      tags: ['api', 'v1'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            paymentInfo: Joi.object({
              value: Joi.number().allow(null, '').example(100000).description('Số tiền VNĐ'),
              transferAt: Joi.date().allow(null, '').example(Date()).description('Thời gian chuyển khoản'),
              accountNumber: Joi.string().allow(null, '').example('124151234124').description('Số tài khoản'),
              holder: Joi.string().allow(null, '').example('Trương Tam Phong').description('Tên tài khoản'),
              bankName: Joi.string().allow(null, '').example('Techcombank').description('Tên ngân hàng'),
              content: Joi.string().allow(null, '').example('asdasdasd').description('Nội dung chuyển khoản'),
              branch: Joi.string().allow(null, '').example('asdasdasd').description('Chi nhánh')
            }),
            userInfo: Joi.object({
              fullname: Joi.string().allow(null, '').example('Trương Tam Phong').description('Mua từ'),
              facebook: Joi.string().allow(null, '').example('asdasdsd').description('facebook'),
              telegram: Joi.string().allow(null, '').example('asasds').description('telegram')
            }).description('Thông tin người mua/người bán'),
            tradeInfo: {
              id: Joi.number().allow(null, '').example(1).description('ID giao dịch'),
              status: Joi.string().allow(null, '').example('PAID').description('Trạng thái'),
              type: Joi.string().allow(null, '').example('BUY').description('Loại GD'),
              transaction: Joi.string().allow(null, '').example('asasds').description('Mã giao dịch'),
              amount: Joi.number().allow(null, '').example(12415165).description('Số V giao dịch'),
              amountConfirmReceived: Joi.number().allow(null, '').example(100000).description('Số V người mua đã xác nhận chuyển khoản'),
              createdAt: Joi.date().allow(null, '').example('').description('Thời gian giao dịch'),
              updatedAt: Joi.date().allow(null, '').example(Date()).description('Ngày cập nhật'),
              expiredAt: Joi.date().allow(null, '').example(Date()).description('Thời gian hết hạn GD'),
              proof: {
                filePath: Joi.string().allow(null, '').example('upload/trades/162784236482/abc.png').description('File bằng chứng chuyển khoản'),
                sentAt: Joi.date().allow(null, '').example(Date()).description('Thời gian gửi')
              },
              description: Joi.string().allow(null, '').example('Thanh toán đơn hàng của ABC').description('Chi tiết đơn hàng')
            }
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại').description('Lấy chi tiết giao dịch thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];