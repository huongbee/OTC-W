const AccountModel = require('project/models/AccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const TradeRequestModel = require('project/models/TradeRequestModel');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    if (_.get(userInfo, 'id', false) === false) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin tài khoản')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const { filter: { status }, paging: { start, limit }, sort } = request.payload;
    const where = {};

    where.accountId = userInfo.id;
    if (status) where.status = status;

    if (_.isEmpty(sort)) sort.createdAt = -1;

    const tradeList = await TradeRequestModel.find(where)
      .select('-_id transaction amount amountConfirmReceived value type createdAt status description')
      .skip(start)
      .limit(limit)
      .lean();

    const total = await TradeRequestModel.countDocuments(where);

    return reply.api({
      total: total,
      data: tradeList
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};