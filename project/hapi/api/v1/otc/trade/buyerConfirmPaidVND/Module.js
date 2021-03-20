const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');
const TradeRequestModel = require('project/models/TradeRequestModel');
const TradeConstant = require('project/constants/TradeConstant');
const RequestService = require('project/services/RequestService');
const AccountModel = require('project/models/AccountModel');
const SendEmailWorker = require('project/worker/SendEmail');
const numeral = require('numeral');
const SocialConfig = require('project/config/SocialId');
const NotificationModel = require('project/models/NotificationModel');
const SendNotificationWorker = require('project/worker/SendNotification');

module.exports = async (request, reply) => {
  const { payload } = request;
  try {
    const authInfo = request.auth.credentials;
    const accountInfo = request.auth.accountInfo;
    const buyerTradeRequest = await TradeRequestModel.findOne({
      accountId: authInfo.accountId,
      transaction: payload.transaction
    }).lean();
    if (!buyerTradeRequest) {
      return reply.api({
        message: 'Không tìm thấy thông tin giao dịch'
      }).code(ResponseCode.REQUEST_FAIL);
    }
    console.log('buyer xác nhận đac CK,', JSON.stringify(buyerTradeRequest));
    if (!_.includes([TradeConstant.TRADE_STATUS.PENDING], buyerTradeRequest.status)) {
      return reply.api({
        message: 'Trạng thái giao dịch không hợp lệ'
      }).code(ResponseCode.REQUEST_FAIL);
    }

    let sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: buyerTradeRequest.transaction,
      type: TradeConstant.TRADE_TYPE.SELL
    });
    const changedStatus = {
      from: buyerTradeRequest.status,
      to: TradeConstant.TRADE_STATUS.PAID,
      reason: 'Người mua xác nhận đã thanh toán VNĐ',
      accountAction: authInfo.accountId,
      updatedAt: new Date()
    };
    if (sellerTradeRequestInfo.partnerTransaction) {
      await TradeRequestModel.updateMany(
        {
          id: { $in: [buyerTradeRequest.id, sellerTradeRequestInfo.id] }
        },
        {
          $set: {
            status: TradeConstant.TRADE_STATUS.PAID,
            proof: {
              filePath: payload.filePath,
              sentAt: new Date()
            }
          },
          $push: {
            changedStatus
          }
        });
      const sellerInfo = await AccountModel.findOne({ id: sellerTradeRequestInfo.accountId }).lean();

      SendEmailWorker.pushSendEmail(
        sellerInfo.email,
        `*Người mua đã xác nhận chuyển tiền cho giao dịch BÁN của quý khách đã tạo<br>
        Mã giao dịch: <b>#${sellerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(sellerTradeRequestInfo.amount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${sellerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a> `,
        `WMV thông báo giao dịch BÁN. Mã #${sellerTradeRequestInfo.transaction}`,
        'send-notification');
      // gọi api xác nhận GD thành công thay cho partner
      // #region Xác nhận Thành công thay user
      // const body = {
      //   content: buyerTradeRequest.paymentInfo.content,
      //   transaction: buyerTradeRequest.transaction,
      //   amount: buyerTradeRequest.amount
      // };

      // // tìm token đang hoạt động nếu có => nếu ko có thì sinh ra (TODO: sau đó hủy luôn)
      // let accessTokenCreated = await AccessTokenModel.findOne({
      //   accountId: sellerTradeRequestInfo.accountId,
      //   isExpired: false
      // });
      // if (!accessTokenCreated) {
      //   accessTokenCreated = await AccessTokenModel.create({
      //     accountId: sellerTradeRequestInfo.accountId
      //   });
      // }

      // const accessTokenInfo = {
      //   id: accessTokenCreated.id,
      //   accountId: sellerTradeRequestInfo.accountId,
      //   isActive: true
      // };
      // const accessTokenPartnerConfirmReceiveVnd = JsonWebToken.sign(accessTokenInfo, AuthenticationConfig.partnerSecretKey);
      // console.log({ accessTokenPartnerConfirmReceiveVnd });
      // const headers = {
      //   authorization: accessTokenPartnerConfirmReceiveVnd
      // };
      // const logRequest = await RequestService.requestPost(SocialConfig.environment.api, '/v1/trade-request/confirm_received_vnd', body, headers);
      // console.log('1----/v1/trade-request/xác nhận đã thanh toán: sellerTradeRequestInfo.ipnUrl response from ', sellerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
      // #endregion
      if (sellerTradeRequestInfo.ipnUrl) {
        sellerTradeRequestInfo = await TradeRequestModel.findOne({
          id: sellerTradeRequestInfo.id
        }).lean();
        const body = {
          transaction: sellerTradeRequestInfo.transaction,
          partnerTransaction: sellerTradeRequestInfo.partnerTransaction,
          amountInfo: {
            amount: sellerTradeRequestInfo.amount,
            fee: sellerTradeRequestInfo.feeAmount,
            total: sellerTradeRequestInfo.totalAmount
          },
          valueInfo: {
            value: sellerTradeRequestInfo.value,
            fee: sellerTradeRequestInfo.fee,
            total: sellerTradeRequestInfo.totalValue
          },
          status: sellerTradeRequestInfo.status
        };
        await TradeRequestModel.updateOne(
          { id: sellerTradeRequestInfo.id },
          {
            $inc: {
              'sentIpn.count': 1 // tăng số lần gọi
            }
          });
        const logRequest = await RequestService.requestPost(sellerTradeRequestInfo.ipnUrl, null, body, {});
        await TradeRequestModel.updateOne(
          { id: sellerTradeRequestInfo.id },
          {
            $set: {
              'sentIpn.isSentIPN': true // ipn thành công
            }
          });
        console.log('1----/v1/trade-request/xác nhận đã thanh toán: sellerTradeRequestInfo.ipnUrl response from ', sellerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
      }
      return reply.api({
        message: 'Cập nhật thành công',
        transaction: payload.transaction,
        status: TradeConstant.TRADE_STATUS.PAID
      }).code(ResponseCode.REQUEST_SUCCESS);
    } else {
      const changedStatus = {
        from: buyerTradeRequest.status,
        to: TradeConstant.TRADE_STATUS.PAID,
        reason: 'Người mua xác nhận đã thanh toán VNĐ',
        accountAction: authInfo.accountId,
        updatedAt: new Date()
      };
      await TradeRequestModel.updateMany(
        { id: { $in: [buyerTradeRequest.id, sellerTradeRequestInfo.id] } },
        {
          $set: {
            status: TradeConstant.TRADE_STATUS.PAID,
            proof: {
              filePath: payload.filePath,
              sentAt: new Date()
            }
          },
          $push: {
            changedStatus
          }
        });
      const sellerInfo = await AccountModel.findOne({ id: sellerTradeRequestInfo.accountId }).lean();

      SendEmailWorker.pushSendEmail(
        sellerInfo.email,
        `*Có người mua đã xác nhận chuyển tiền cho giao dịch BÁN của quý khách đã tạo<br>
        Mã giao dịch: <b>#${sellerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(sellerTradeRequestInfo.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${sellerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a> `,
        `WMV thông báo giao dịch BÁN. Mã #${sellerTradeRequestInfo.transaction}`,
        'send-notification');

      return reply.api({
        message: 'Cập nhật thành công',
        transaction: payload.transaction,
        status: TradeConstant.TRADE_STATUS.PAID
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
  } catch (error) {
    throw error;
    // return reply.api({
    //   message: error.message
    // }).code(ResponseCode.REQUEST_FAIL);
  }
};
