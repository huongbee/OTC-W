const UserBalanceModel = require('project/models/UserBalanceModel');
const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const moment = require('moment');
const GeneralConstant = require('project/constants/GeneralConstant');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const { filter, paging: { start, limit }, sort } = request.payload;
    if (_.isEmpty(sort)) sort.createdAt = -1;

    let where = {
      accountId: authInfo.accountId
    };

    const from = filter.createdAt ? filter.createdAt.from : null;
    const to = filter.createdAt ? filter.createdAt.to : null;
    if (from) {
      where.createdAt = {};
      where.createdAt.$gte = moment(new Date(from));
    }
    if (to) {
      if (!where.createdAt) where.createdAt = {};
      where.createdAt.$lte = new Date(to);
    }
    if (filter.transaction) {
      where.refTransaction = filter.transaction;
    }
    if (filter.sourceName) {
      where.sourceName = filter.sourceName;
    }
    let balances = await UserBalanceModel.find(where).sort(sort).skip(start).limit(limit).lean();
    balances = balances.map(item => {
      item.sourceName = GeneralConstant.SOURCE_NAME_EXPLAIN[item.sourceName];
      return item;
    });
    const totalRecords = await UserBalanceModel.countDocuments(where);
    return reply.api({
      message: 'Thành công',
      items: balances,
      totalRecords
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (err) {
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};