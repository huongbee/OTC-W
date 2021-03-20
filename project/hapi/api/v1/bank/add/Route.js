const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'POST',
    path: '/v1/bank',
    handler: require('./Module'),
    options: {
      description: 'Thêm tài khoản ngân hàng',
      validate: {
        payload: Joi.object({
          accountNumber: Joi.string().required().example('1234567809123').description('Số tài khoản'),
          swiftCode: Joi.string().required().example('WBVNVNVX').description('swiftCode ngân hàng'),
          holder: Joi.string().required().example('Lệnh Hồ Xung').description('Chủ tài khoản'),
          branch: Joi.string().required().example('Tân Bình').description('Chi nhánh'),
          area: Joi.string().required().example('Hồ Chí Minh').description('Hồ Chí Minh')
        })
      },
      tags: ['api', 'v1', 'bank'],
      response: {
        status: {
          [Code.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công!').description('Cập nhật thành công')
          }).description('Thành công'),
          [Code.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại!').description('Cập nhật thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];