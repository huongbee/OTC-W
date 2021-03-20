const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'PUT',
    path: '/v1/bank/{id}',
    handler: require('./Module'),
    options: {
      description: 'Update tài khoản ngân hàng mặc định',
      validate: {
        params: Joi.object({
          id: Joi.number().required().example(1).description('id')
        }),
        payload: Joi.object({
          isDefault: Joi.boolean().required().example(true).description('Thêm/xóa ngân hàng mặc định')
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