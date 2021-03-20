const TradeRequestModel = require('project/models/TradeRequestModel');
const ResponseCode = require('project/constants/ResponseCode');
const GeneralConstant = require('project/constants/GeneralConstant');
const ProccessingTransactionService = require('project/services/ProccessingTransactionService');

// user trong hệ thống xác nhận đã nhận tiền của người mua => xác nhận lênh sell minh đã tạo hoặc sell được tạo do người mua đã thực hiện lệnh mua
// nếu gửi lớn hơn số tiền yc thì tính lại số V sẽ gửi đi với điều kiện quảng cáo đã tạo còn đủ V sẽ gửi, nếu ko thì báo lỗi ko đủ V
// bán cho user trong hệ thống => không chia commision
// bán cho user ngoài hệ thống => có commision
module.exports = async (request, reply) => {
  try {
    const payload = request.payload;
    const authInfo = request.auth.credentials;
    const accountInfo = request.auth.accountInfo;

    const result = await ProccessingTransactionService.confirmReceiveVND(payload, accountInfo);

    const sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      accountId: accountInfo.id
    }).lean();
    if (result.code !== 1) {
      return reply.api({
        message: request.__(result.message)
      }).code(ResponseCode.REQUEST_FAIL);
    }
    return reply.api({
      message: request.__(result.message),
      transaction: sellerTradeRequestInfo.transaction,
      status: sellerTradeRequestInfo.status
    }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (err) {
    console.log('🚀 ~ file: Module.js ~ line 64 ~ module.exports= ~ err', err);
    return reply.api({
      message: err.message
    }).code(ResponseCode.REQUEST_FAIL);
  }
};
