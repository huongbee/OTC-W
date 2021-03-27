const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');
const GeneralConstant = require('project/constants/GeneralConstant');
const _ = require('lodash');

module.exports = [
  {
    method: 'POST',
    path: '/v1/account/register',
    handler: require('./Module'),
    options: {
      auth: false,
      description: 'Register a new account',
      validate: {
        payload: Joi.object({
          username: Joi.string().required().example('huongntn').description('User name'),
          email: Joi.string().allow(null, '').example('huongntn@gmail.com').description('Email'),
          phone: Joi.string().allow(null, '').example('03887575738').description('Số điện thoại'),
          password: Joi.string().required().example('sha256').description('Mật khẩu'),
          fullname: Joi.string().required().example('Nguyễn Văn A').description('Họ và tên'),
          gender: Joi.string().required().allow(null, '').valid('MALE', 'FEMALE', 'OTHER').example('MALE').description('Giới tính'),
          birthday: Joi.date().allow(null, '').example(new Date()).description('Ngày sinh'),
          ref: Joi.string().allow(null, '').example('1234321').description('Mã giới thiệu')
        })
      },
      tags: ['api', 'v1', 'account'],
      response: {
        status: {
          [Code.REQUEST_SUCCESS]: Joi.object({
            phone: Joi.string().allow(null, '').example('843880303030').description('Điện thoại'),
            email: Joi.string().allow(null, '').example('huong@payme.vn').description('Email'),
            fullname: Joi.string().allow(null, '').example('Huong').description('Họ Tên'),
            avatar: Joi.string().allow(null, '').example('http://a.png').description('Ảnh đai diện'),
            birthday: Joi.date().allow(null, '').example(new Date()).description('Ngày sinh'),
            address: Joi.string().allow(null, '').example('15 NCT').description('Địa chỉ'),
            username: Joi.string().allow(null, '').example('843880303030').description('Username'),
            createdAt: Joi.date().allow(null, '').example(new Date()).description('createdAt'),
            id: Joi.number().allow(null, '').example(1).description('ID')
          }).description('Thành công'),
          [Code.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại!').description('Không thể tạo tài khoản')
          }).description('Thất bại')
        }
      }
    }
  }
];