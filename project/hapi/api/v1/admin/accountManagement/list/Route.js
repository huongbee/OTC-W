const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'POST',
    path: '/v1/admin/account/list',
    handler: require('./Module'),
    options: {
      auth: 'Admin',
      description: 'Lấy danh sách user',
      validate: {
        payload: Joi.object({
          filter: {
            accountType: Joi.alternatives().try(
              Joi.number().example(1).description('Loại tài khoản'),
              Joi.array().allow(null, '').example([1, 2, 3]).description('DS Loại tài khoản')
            ),
            searchQuery: Joi.string().example('0123456789').allow('', null).optional().description('Search text'),
            isActive: Joi.boolean().example(true).description('Trạng thái')
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
      tags: ['api', 'v1', 'account management'],
      response: {
        status: {
          [Code.REQUEST_SUCCESS]: Joi.object({
            total: Joi.number().example(5).allow(null, '').description('Số lượng'),
            items: Joi.array().items(Joi.object({
              id: Joi.number().example(1).description('ID người dùng'),
              parentId: Joi.number().example(1).allow(null, '').description('ID parent'),
              parentEmail: Joi.string().example('admin@example.com').allow(null, '').description('email parent'),
              avatar: Joi.string().allow(null, '').example('google.com').description('Avatar'),
              fullname: Joi.string().allow(null, '').example('Hồ Hoàng Thương').description('Họ và tên'),
              email: Joi.string().allow(null, '').example('ThuongHH@payme.vn').description('Email'),
              phone: Joi.string().allow(null, '').example('0123456789').description('Số điện thoại'),
              accountType: Joi.number().allow(null, '').example('Quản lý cấp cao').description('Loại tài khoản'),
              isActive: Joi.boolean().example(true).description('Trạng thái'),
              createdAt: Joi.date().allow(null, '').example(new Date()).description('Thời gian tạo'),
              balance: Joi.number().example(100000).description('Số dư khả dụng'),
              scope: Joi.any()
            }))
          }).description('Thành công'),
          [Code.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại!').description('Cập nhật thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];