const AccountModel = require('project/models/AccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const GeneralConstant = require('project/constants/GeneralConstant');
const PasswordHelper = require('project/helpers/PasswordHelper');
const PhoneHelper = require('project/helpers/PhoneHelper');
const _ = require('lodash');
const UuidService = require('project/services/UuidService');

const Register = async (request, reply) => {
  try {
    const payload = request.payload;
    const passwordHepler = new PasswordHelper();
    let phone = null;
    if (payload.phone) {
      const phoneHelper = new PhoneHelper();
      const checkPhone = phoneHelper.validatePhone(_.trim(payload.phone));
      if (!checkPhone.isValid) {
        return reply.api({
          message: request.__('Vui lòng nhập đúng định dạng số điện thoại')
        }).code(ResponseCode.REQUEST_FAIL);
      }
      phone = phoneHelper.format(payload.phone);
      const existedPhone = await AccountModel.findOne({ phone }).lean();
      if (existedPhone) {
        return reply.api({
          message: request.__('Số điện thoại đã tồn tại')
        }).code(ResponseCode.REQUEST_FAIL);
      }
    }
    if (_.trim(payload.email)) {
      const existedEmail = await AccountModel.findOne({ email: _.trim(payload.email) }).lean();
      if (existedEmail) {
        return reply.api({
          message: request.__('Email đã tồn tại')
        }).code(ResponseCode.REQUEST_FAIL);
      }
    }
    const existedUsername = await AccountModel.findOne({ username: _.trim(payload.username) }).lean();
    if (existedUsername) {
      return reply.api({
        message: request.__('Username đã tồn tại')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const uuidService = new UuidService('OTC_ACCOUNT_ID');
    const uuidData = await uuidService.getUUID(1, payload);
    let uuidAccountId = null;
    if (uuidData.code === 1 && uuidData.data.length > 0) {
      uuidAccountId = uuidData.data.uuid[0];
    }
    if (uuidAccountId === null) {
      return reply.api({
        message: request.__('Không thể khởi tạo tài khoản, vui lòng thử lại')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    const checkAccountIdExist = await AccountModel.findOne({ id: uuidAccountId }).lean();
    if (_.get(checkAccountIdExist, 'id', null) !== null) {
      return reply.api({
        message: request.__('Không thể khởi tạo tài khoản, vui lòng thử lại!')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    let parentId = null;
    const accountLevel1 = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_LEVEL1 }).lean();
    if (accountLevel1) parentId = accountLevel1.id;
    let accountType = GeneralConstant.ACCOUNT_TYPE.LEVEL_2;
    if (payload.ref) {
      const refInfo = await AccountModel.findOne({ id: _.toNumber(payload.ref) }).lean();
      if (_.get(refInfo, 'id', null) !== null && _.toNumber(refInfo.accountType) < 2) {
        parentId = refInfo.id;
        accountType = _.toNumber(refInfo.accountType) + 1;
      }
    }
    if (payload.ref) {
      const refInfo = await AccountModel.findOne({ id: _.toNumber(payload.ref) }).lean();
      if (_.get(refInfo, 'id', null) !== null) {
        parentId = refInfo.id;
      }
    }
    const newUser = await AccountModel.create({
      id: uuidAccountId,
      username: payload.username,
      email: payload.email,
      fullname: payload.fullname,
      isActive: false,
      accountType,
      parentId
    });
    if (!newUser) {
      return reply.api({
        message: request.__('Tạo tài khoản thất bại')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    return reply.api({
      phone: newUser.phone,
      email: newUser.email,
      fullname: newUser.fullname,
      avatar: newUser.avatar,
      birthday: newUser.birthday,
      address: newUser.address,
      username: newUser.username,
      createdAt: newUser.createdAt,
      id: newUser.id
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw (err);
  }
};

module.exports = Register;