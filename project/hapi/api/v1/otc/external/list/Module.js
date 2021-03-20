const TradeRequestModel = require('project/models/TradeRequestModel');
const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const { filter, paging: { start, limit }, sort } = request.payload;
    const where = {};
    if (filter.type) where.type = filter.type;
    if (filter.transaction) where.partnerTransaction = filter.transaction;
    const authInfo = request.auth.credentials;
    where.accountId = authInfo.accountId;
    if (_.isEmpty(sort)) sort.id = -1;
    const tradeRequests = await TradeRequestModel.find(where, { _id: 0 })
      .sort(sort)
      .skip(start)
      .limit(limit)
      .lean();
    const item = tradeRequests.map(trade => {
      return {
        id: trade.id,
        adsId: trade.adsId,
        transaction: trade.transaction,
        partnerId: trade.partnerId,
        partnerTransaction: trade.partnerTransaction,
        accountId: trade.accountId,
        type: trade.type,
        status: trade.status,
        amount: trade.amount,
        feeAmount: trade.feeAmount,
        totalAmount: trade.totalAmount,
        filledAmount: trade.filledAmount,
        value: trade.value,
        filledValue: trade.filledValue,
        fee: trade.fee,
        totalValue: trade.totalValue,
        paymentType: trade.paymentType,
        paymentInfo: {
          content: trade.paymentInfo.content,
          swiftCode: trade.paymentInfo.swiftCode,
          bankName: trade.paymentInfo.bankName,
          accountNumber: trade.paymentInfo.accountNumber,
          holder: trade.paymentInfo.holder
        },
        createdAt: trade.createdAt,
        updatedAt: trade.updatedAt
      };
    });

    const totalRecords = await TradeRequestModel.countDocuments(where);
    return reply.api({
      message: 'Thành công',
      data: item,
      totalRecords
    }).code(ResponseCode.REQUEST_SUCCESS);

  } catch (err) {
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};