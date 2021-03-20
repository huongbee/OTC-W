const ResponseCode = require('project/constants/ResponseCode');
const Joi = require('mecore').Joi;
const GeneralConstant = require('project/constants/GeneralConstant');
const _ = require('lodash');
module.exports = [
  {
    method: 'POST',
    path: '/v1/user/balance_history',
    handler: require('./Module'),
    options: {
      description: 'Xem lịch sử thay đổi số dư tài khoản',
      validate: {
        payload: Joi.object({
          filter: {
            transaction: Joi.string().allow(null, '').example('2345623456').description('Mã GD'),
            sourceName: Joi.string().allow(null, '').example(GeneralConstant.SOURCE_NAME.TRADE).valid(..._.values(GeneralConstant.SOURCE_NAME)).description('Loại GD'),
            createdAt: Joi.object({
              from: Joi.date().example(new Date()).description('Từ Ngày'),
              to: Joi.date().example(new Date()).description('Tới Ngày')
            }).description('Thời gian tạo')
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
      tags: ['api', 'v1', 'otc-user'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Lấy lịch sử số dư thành công'),
            items: Joi.any().example({}),
            totalRecords: Joi.number().example('1000').description('Tổng records')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Lấy số dư tài khoản thất bại').description('Lấy số dư tài khoản thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];