const AccountModel = require('project/models/AccountModel');
const BankAccountModel = require('project/models/BankAccountModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;

    const { transaction } = request.params;
    const tradeRequest = await TradeRequestModel.find({
      transaction: transaction
    }).lean();
    if (tradeRequest.length === 0) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin giao dịch')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const selfTrade = _.find(tradeRequest, { accountId: authInfo.accountId });
    const userOtherTrade = _.xorBy([selfTrade], tradeRequest, 'type')[0];
    // console.log(JSON.stringify(userOtherTrade, tradeRequest));
    if (!selfTrade || !userOtherTrade) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin giao dịch!!')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    if (!userOtherTrade) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin giao dịch!')
      }).code(ResponseCode.REQUEST_FAIL);
    }
    const userOtherInfo = await AccountModel.findOne({ id: userOtherTrade.accountId })
      .select('-_id fullname telegram facebook')
      .lean();
    const sellTradeInfo = {
      paymentInfo: {
        value: selfTrade.value,
        transferAt: selfTrade.proof ? selfTrade.proof.sentAt : '',
        accountNumber: selfTrade.paymentInfo.accountNumber,
        holder: selfTrade.paymentInfo.holder,
        bankName: selfTrade.paymentInfo.bankName,
        content: selfTrade.paymentInfo.content,
        branch: selfTrade.paymentInfo.branch
      },
      userInfo: {
        ...userOtherInfo
      },
      tradeInfo: {
        id: selfTrade.id,
        status: selfTrade.status,
        type: selfTrade.type,
        transaction: selfTrade.transaction,
        amount: selfTrade.amount,
        amountConfirmReceived: selfTrade.amountConfirmReceived,
        createdAt: selfTrade.createdAt,
        updatedAt: selfTrade.updatedAt,
        expiredAt: selfTrade.expiredAt,
        proof: {
          filePath: selfTrade.proof ? selfTrade.proof.filePath : '',
          sentAt: selfTrade.proof ? selfTrade.proof.sentAt : ''
        },
        description: selfTrade.description
      }
    };

    return reply.api(sellTradeInfo).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};