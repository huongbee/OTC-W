const AccountModel = require('project/models/AccountModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const { filter: { level, type }, paging: { start, limit }, sort } = request.payload;
    const where = { type };
    const accounts = await AccountModel.find({
      accountType: level,
      isActive: true
    }).lean();
    const accountIds = accounts.map(acc => acc.id);
    where.accountId = { $in: accountIds };
    if (_.isEmpty(sort)) sort.createdAt = -1;
    const adsInfo = await AdsModel.find(where, { _id: 0 }).sort(sort)
      .skip(start).limit(limit).lean();

    const item = adsInfo.map(ads => {
      return {
        id: ads.id,
        accountId: ads.accountId,
        amount: ads.amount,
        feeAmount: ads.feeAmount,
        totalAmount: ads.totalAmount,
        filledAmount: ads.filledAmount,
        value: ads.value,
        fee: ads.fee,
        totalValue: ads.totalValue,
        filledValue: ads.filledValue,
        minAmount: ads.minAmount,
        type: ads.type,
        status: ads.status,
        paymentType: ads.paymentType,
        createdAt: ads.createdAt,
        updatedAt: ads.updatedAt,
        transaction: ads.transaction,
        paymentInfo: {
          content: ads.paymentInfo.content,
          swiftCode: ads.paymentInfo.swiftCode,
          bankName: ads.paymentInfo.bankName,
          accountNumber: ads.paymentInfo.accountNumber,
          holder: ads.paymentInfo.holder,
          branch: ads.paymentInfo.branch
        }
      };
    });
    //console.log({ data, item });

    const totalRecords = await AdsModel.countDocuments(where);
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