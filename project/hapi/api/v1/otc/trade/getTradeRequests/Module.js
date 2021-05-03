const AccountModel = require('project/models/AccountModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const { filter: { transaction, type }, paging: { start, limit }, sort } = request.payload;
    const authInfo = request.auth.credentials;

    if (_.isEmpty(sort)) sort.updatedAt = -1;
    // const ads = await AdsModel.find({ accountId: authInfo.accountId }, { _id: 0 }).lean();
    // const adsIds = _.map(ads, 'id');
    // console.log(adsIds);
    const where = {
      accountId: authInfo.accountId,
      type
    };
    if (transaction) {
      where.transaction = transaction;
    }
    const tradeRequests = await TradeRequestModel.find(where, { _id: 0, createdAt: 0 })
      .sort(sort)
      .skip(start)
      .limit(limit)
      .lean();
    const data = tradeRequests.map(trade => {
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
        fee: trade.fee,
        totalValue: trade.totalValue,
        filledValue: trade.filledValue,
        paymentType: trade.paymentType,
        paymentInfo: {
          content: trade.paymentInfo.content,
          swiftCode: trade.paymentInfo.swiftCode,
          bankName: trade.paymentInfo.bankName,
          accountNumber: trade.paymentInfo.accountNumber,
          holder: trade.paymentInfo.holder,
          branch: trade.paymentInfo.branch
        },
        expiredAt: trade.expiredAt,
        claim: {
          sentAt: trade.claim ? trade.claim.sentAt : null,
          reason: trade.claim ? trade.claim.reason : null
        },
        createdAt: trade.createdAt,
        updatedAt: trade.updatedAt
      };
    });
    const totalRecords = await TradeRequestModel.countDocuments(where);
    return reply.api({
      message: 'Thành công',
      data,
      totalRecords
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (err) {
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};
