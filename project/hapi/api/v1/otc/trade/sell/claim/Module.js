const TradeRequestModel = require('project/models/TradeRequestModel');
const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const moment = require('moment');
const ProccessingTransactionService = require('project/services/ProccessingTransactionService');

module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const authInfo = request.auth.credentials;

    const result = await ProccessingTransactionService.sellerClaimTradeRequest(payload.transaction, payload.reason, authInfo.accountId);
    if (result.code !== 1) {
      return reply.api({
        message: result.message
      }).code(ResponseCode.REQUEST_FAIL);
    }
    return reply.api({
      message: 'Đã ghi nhận khiếu nại, chờ xử lý',
      transaction: _.get(result, 'data.transaction', payload.transaction),
      status: _.get(result, 'data.status', '')
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (err) {
    console.log('🚀 ~ file: Module.js ~ line 64 ~ module.exports= ~ err', err);
    return reply
      .api({
        message: err.message
      })
      .code(ResponseCode.REQUEST_FAIL);
  }
};
