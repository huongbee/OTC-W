const AccountModel = require('project/models/AccountModel');
const SettingModel = require('project/models/SettingModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();
    if (userInfo) {
      const { filter } = request.payload || {};
      let query = {};
      if (filter.keys)
        query = { key: {$in: filter.keys} }
        
      const configs = await SettingModel.find(query).select('-_id key value').lean();
      if (configs.length)
      return reply.api({
        message: "Thành công",
        data: configs
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    throw { message: 'Không tìm thấy tài khoản' }
  } catch (err) {
    return reply.api({
      message: err.message,
    }).code(ResponseCode.REQUEST_FAIL);
  }
}