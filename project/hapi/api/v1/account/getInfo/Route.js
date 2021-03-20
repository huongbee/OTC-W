const ResponseCode = require('project/constants/ResponseCode');
const GeneralConstant = require('project/constants/GeneralConstant');
const Joi = require('mecore').Joi;
const _ = require('lodash');

module.exports = [
  {
    method: 'GET',
    path: '/v1/account',
    handler: require('./Module'),
    options: {
      tags: ['api', 'v1', 'account'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            phone: Joi.string().allow(null, '').example('843880303030').description('Điện thoại'),
            contactPhone: Joi.string().allow(null, '').example('843880303030').description('Điện thoại liên hệ'),
            email: Joi.string().allow(null, '').example('huong@payme.vn').description('Email'),
            fullname: Joi.string().allow(null, '').example('Huong').description('Họ Tên'),
            avatar: Joi.string().allow(null, '').example('http://a.png').description('Ảnh đai diện'),
            birthday: Joi.date().allow(null, '').example(new Date()).description('Ngày sinh'),
            address: Joi.string().allow(null, '').example('15 NCT').description('Địa chỉ'),
            username: Joi.string().allow(null, '').example('843880303030').description('Username'),
            createdAt: Joi.date().allow(null, '').example(new Date()).description('createdAt'),
            id: Joi.number().allow(null, '').example(1).description('ID'),
            isSetPassword: Joi.boolean().example(true).description('Cho phép tạo MK lần đầu hay ko'),
            isActive: Joi.boolean().example(true).description('isActive'),
            required2FA: Joi.boolean().example(true).description('yc xác thực 2 bước hay không'),
            isLinkedTelegram: Joi.boolean().example(true).description('Tài khoản đã liên kết telegram chưa'),
            isLinkedGoogle: Joi.boolean().example(true).description('Tài khoản đã liên kết google chưa'),
            facebook: Joi.string().allow(null, '').example('').description('thông tin facebook'),
            telegram: Joi.string().allow(null, '').example('').description('thông tin telegram'),
            accountType: Joi.number().example(1).description('Loại tài khoản'),
            refLink: Joi.string().allow(null, '').example('https://otc.wmv.money?ref=121312').description('Link giới thiệu'),
            requiredUserInfo: Joi.boolean().example(true).description('YC cập nhật thông tin cá nhân'),
            scope: Joi.any().description('Quyền usr')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại!').description('Lấy thông tin thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];