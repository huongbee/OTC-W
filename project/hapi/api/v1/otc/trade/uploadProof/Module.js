const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');
const AsyncForEach = require('await-async-foreach');
const Fs = require('fs');
const Path = require('path');
const Randomstring = require('randomstring');
const TradeRequestModel = require('project/models/TradeRequestModel');
const TradeConstant = require('project/constants/TradeConstant');
const RequestService = require('project/services/RequestService');
const AccountModel = require('project/models/AccountModel');
const SendEmailWorker = require('project/worker/SendEmail');
const numeral = require('numeral');
const SocialConfig = require('project/config/SocialId');
const AdsModel = require('project/models/AdsModel');
const AccessTokenModel = require('project/models/AccessTokenModel');
const JsonWebToken = require('jsonwebtoken');
const AuthenticationConfig = require('project/config/Authentication');

//TODO kiểm tra khác amount
module.exports = async (request, reply) => {
  const { payload } = request;
  const path = `${__dirname}/../../../../../../../public/upload`;

  let files = [];
  const response = [];
  if (!_.isArray(payload.files)) {
    files.push(payload.files);
  } else {
    files = payload.files;
  }

  try {
    const authInfo = request.auth.credentials;
    const buyerTradeRequest = await TradeRequestModel.findOne({
      accountId: authInfo.accountId,
      transaction: payload.transaction
    }).lean();
    if (!buyerTradeRequest) {
      return reply.api({
        message: 'Không tìm thấy thông tin giao dịch'
      }).code(ResponseCode.REQUEST_FAIL);
    }
    if (!_.includes([TradeConstant.TRADE_STATUS.PENDING], buyerTradeRequest.status)) {
      return reply.api({
        message: 'Trạng thái giao dịch không hợp lệ'
      }).code(ResponseCode.REQUEST_FAIL);
    }
    await AsyncForEach(files, (file) => {
      console.log(file.hapi.header);
      if (!_.includes(GeneralConstant.allowMimeType, _.toLower(_.get(file, 'hapi.headers.content-type', null)))) {
        response.push({
          fileName: file.hapi.filename,
          state: 'UNSUPPORT_MIME_TYPE',
          message: 'Định dạng file không hỗ trợ'
        });
        return false;
      }

      const filePath = Path.resolve(`${path}/trades/${buyerTradeRequest.transaction}`);
      const fileName = `${Randomstring.generate({ length: 9, charset: 'alphanumeric' })}${file.hapi.filename.substr(-4, 4)}`;
      Fs.mkdirSync(filePath, { recursive: true });

      // eslint-disable-next-line no-underscore-dangle
      const data = file._data;
      if (data) {
        const fullPath = `${filePath}/${fileName}`;
        Fs.writeFileSync(fullPath, data);
        response.push({
          fileName: file.hapi.filename,
          state: 'SUCCEEDED',
          message: 'Thành công',
          path: `upload/trades/${buyerTradeRequest.transaction}/${fileName}`
        });
        return true;
      }
      response.push({
        fileName: file.hapi.filename,
        state: 'FAILED',
        message: 'Thất bại'
      });
      return false;
    }, 'parallel', 1);
    if (response[0].state !== 'SUCCEEDED') {
      console.log(JSON.stringify(response), '<==========response upload');
      return reply.api({
        message: 'Upload thất bại'
      }).code(ResponseCode.REQUEST_FAIL);
    }
    let sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: buyerTradeRequest.transaction,
      type: TradeConstant.TRADE_TYPE.SELL
    });
    if (sellerTradeRequestInfo.partnerTransaction) {
      await TradeRequestModel.updateMany(
        {
          id: { $in: [buyerTradeRequest.id, sellerTradeRequestInfo.id] }
        },
        {
          $set: {
            status: TradeConstant.TRADE_STATUS.PAID,
            proof: {
              filePath: response[0].path,
              sentAt: new Date()
            }
          },
          $push: {
            changedStatus: {
              from: buyerTradeRequest.status,
              to: TradeConstant.TRADE_STATUS.PAID,
              reason: 'Người mua xác nhận đã thanh toán VNĐ',
              accountAction: authInfo.accountId,
              updatedAt: new Date()
            }
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
      const body = {
        content: buyerTradeRequest.paymentInfo.content,
        transaction: buyerTradeRequest.transaction,
        amount: buyerTradeRequest.amount
      };

      // tìm token đang hoạt động nếu có => nếu ko có thì sinh ra (TODO: sau đó hủy luôn)
      let accessTokenCreated = await AccessTokenModel.findOne({
        accountId: sellerTradeRequestInfo.accountId,
        isExpired: false
      });
      if (!accessTokenCreated) {
        accessTokenCreated = await AccessTokenModel.create({
          accountId: sellerTradeRequestInfo.accountId
        });
      }

      const accessTokenInfo = {
        id: accessTokenCreated.id,
        accountId: sellerTradeRequestInfo.accountId,
        isActive: true
      };
      const accessTokenPartnerConfirmReceiveVnd = JsonWebToken.sign(accessTokenInfo, AuthenticationConfig.partnerSecretKey);
      console.log({ accessTokenPartnerConfirmReceiveVnd });
      const headers = {
        authorization: accessTokenPartnerConfirmReceiveVnd
      };
      const logRequest = await RequestService.requestPost(SocialConfig.environment.api, '/v1/trade-request/confirm_received_vnd', body, headers);
      console.log('1----/v1/trade-request/xác nhận đã thanh toán: sellerTradeRequestInfo.ipnUrl response from ', '/v1/trade-request/confirm_received_vnd', JSON.stringify({ body, logRequest }));

      return reply.api({
        message: 'Cập nhật thành công',
        data: response
      }).code(ResponseCode.REQUEST_SUCCESS);
    } else {
      await TradeRequestModel.updateMany(
        { id: { $in: [buyerTradeRequest.id, sellerTradeRequestInfo.id] } },
        {
          $set: {
            status: TradeConstant.TRADE_STATUS.PAID,
            proof: {
              filePath: response[0].path,
              sentAt: new Date()
            }
          },
          $push: {
            changedStatus: {
              from: buyerTradeRequest.status,
              to: TradeConstant.TRADE_STATUS.PAID,
              reason: 'Người mua xác nhận đã thanh toán VNĐ',
              accountAction: authInfo.accountId,
              updatedAt: new Date()
            }
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
        message: 'Upload Success',
        data: response
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
  } catch (error) {
    throw error;
    // return reply.api({
    //   message: error.message
    // }).code(ResponseCode.REQUEST_FAIL);
  }
};
