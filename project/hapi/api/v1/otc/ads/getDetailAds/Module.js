const AccountModel = require('project/models/AccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const AdsModel = require('project/models/AdsModel');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const ExternalService = require('project/services/ExternalService');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;

    const ads = await AdsModel.findOne({
      id: request.params.id,
      accountId: authInfo.accountId
    }).lean();

    return reply.api({
      id: ads.id,
      amount: ads.amount,
      filledAmount: ads.filledAmount,
      value: ads.value,
      updatedAt: ads.updatedAt,
      createdAt: ads.createdAt,
      paymentType: ads.paymentType,
      status: ads.status,
      transaction: ads.transaction
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};