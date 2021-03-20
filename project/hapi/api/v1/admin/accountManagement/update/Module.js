const AccountModel = require('project/models/AccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const GeneralConstant = require('project/constants/GeneralConstant');
const AuthorizedScope = require('project/helpers/AuthorizedScope');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    // const adminInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();
    // if (_.get(adminInfo, 'id', false) !== false && _.get(adminInfo, 'accountType', false) !== false) {
    //   if (adminInfo.accountType !== GeneralConstant.ACCOUNT_TYPE.ADMIN) {
    //     throw { message: 'Bạn không có quyền thực hiện hành động này' };
    //   }
    // }
    const accountInfo = request.auth.accountInfo;
    if (!AuthorizedScope(accountInfo.scope, [GeneralConstant.ACCOUNT_SCOPE.ROOT])) {
      return reply.api({
        message: 'Bạn không có quyền thực hiện'
      }).code(ResponseCode.REQUEST_FAIL);
    }
    const { id } = request.params;
    const { isActive, accountType, email } = request.payload;

    const updateData = {};
    if (_.isBoolean(isActive)) {
      updateData.isActive = isActive;
    }
    if (_.isNumber(accountType)) {
      updateData.accountType = accountType;
    }
    if (_.isString(email)) {
      const existed = await AccountModel.findOne({ email });
      if (existed && existed.id !== id) throw { message: 'Đã tồn tại tài khoản với địa chỉ email này.' };
      if (!existed) {
        updateData.email = email;

        await AccountModel.updateOne(
          { id },
          { $set: { username: email } }
        );
      }
    }
    const userInfo = await AccountModel.findOne({ id }).lean();
    if (!userInfo) {
      return reply.api({
        message: request.__('Cập nhật thất bại')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    const result = await AccountModel.updateOne(
      { id: id },
      { $set: updateData }
    );

    if (result && result.nModified > 0) {
      return reply.api({
        message: request.__('Cập nhật thành công')
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    return reply.api({
      message: request.__('Cập nhật thất bại')
    }).code(ResponseCode.REQUEST_FAIL);
  }
  catch (err) {
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};