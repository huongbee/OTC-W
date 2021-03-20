const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'POST',
    path: '/v1/bank/list',
    handler: require('./Module'),
    options: {
      description: 'Lấy danh sách ngân hàng theo tài khoản',
      validate: {
        payload: Joi.object({
          filter: Joi.object({}),
          paging: {
            start: Joi.number().required().example(0).default(0)
              .description('Số bắt đầu'),
            limit: Joi.number().required().example(10).max(1000)
              .default(100)
              .description('Số dòng trên 1 trang')
          },
          sort: Joi.object({}).default({ id: -1 }).description('Sort field')
        })
      },
      tags: ['api', 'v1', 'bank'],
      response: {
        status: {
          [Code.REQUEST_SUCCESS]: Joi.object({
            items: Joi.array().items(Joi.object({
              id: Joi.number().example(1).description('id'),
              isDefault: Joi.boolean().example(true).description('Tài khoản mặc định'),
              accountNumber: Joi.string().example('123456789123').description('Số tài khoản'),
              swiftCode: Joi.string().example('WBVNVNVX').description('SwiftCode'),
              bankName: Joi.string().example('Techcombank').description('Tên ngân hàng'),
              holder: Joi.string().example('Lệnh Hồ Xung').description('Chủ tài khoản'),
              branch: Joi.string().example('Tân Bình').description('Chi nhánh'),
              area: Joi.string().example('Hồ Chí Minh').description('Tỉnh thành')
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