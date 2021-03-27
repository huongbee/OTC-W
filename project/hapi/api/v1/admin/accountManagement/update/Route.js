const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');
const GeneralConstant = require('project/constants/GeneralConstant');
const _ = require('lodash');

module.exports = [
  {
    method: 'PUT',
    path: '/v1/admin/account/{id}',
    handler: require('./Module'),
    options: {
      auth: 'Admin',
      description: 'Cập nhật trạng thái tài khoản',
      validate: {
        params: Joi.object({
          id: Joi.number().required().example(1).description('id')
        }),
        payload: Joi.object({
          isActive: Joi.boolean().required().example(true).description('Cập nhật trạng thái tài khoản'),
          accountType: Joi.number().allow(null, '').example(GeneralConstant.ACCOUNT_TYPE.LEVEL_1).valid(..._.values(GeneralConstant.ACCOUNT_TYPE)).description('Loại tài khoản'),
          email: Joi.string().allow(null, '').example('trangnt@gmail.com').description('Email')
        })
      },
      tags: ['api', 'v1', 'account management'],
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