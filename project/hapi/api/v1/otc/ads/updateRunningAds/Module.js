const AccountModel = require('project/models/AccountModel');
const AdsModel = require('project/models/AdsModel');
const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    if (_.get(userInfo, 'email', false) !== false) {
      const ads = await AdsModel.findOne({
        id: request.params.id,
        accountId: authInfo.accountId
      }).lean();
      if (!ads) throw { message: 'Không tìm thấy thông tin quảng cáo' };

      const filter = {};
      _.forEach(Object.entries(request.payload), ([key, value]) => filter[key] = value);

      if (filter.minAmount && filter.minAmount > filter.amount)
        throw { message: 'Số V tối thiểu phải nhỏ hơn hoặc bằng số V cần giao dịch' };
      const updated = await AdsModel.updateOne({ id: ads.id }, { $set: filter });
      if (!updated.nModified) {
        throw { message: 'Cập nhật quảng cáo thất bại' };
      }
      return reply.api({
        message: 'Cập nhật quảng cáo thành công'
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    throw { message: 'Không tìm thấy tài khoản' };
  } catch (err) {
    return reply.api({
      message: request.__(err.message)
    }).code(ResponseCode.REQUEST_FAIL);
  }
};