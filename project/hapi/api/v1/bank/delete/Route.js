const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'DELETE',
    path: '/v1/bank',
    handler: require('./Module'),
    options: {
      description: 'Xoá tài khoản ngân hàng',
      validate: {
        payload: Joi.object({
          id: Joi.number().required().example(1).description('Bank account id')
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