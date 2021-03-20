const ResponseCode = require('project/constants/ResponseCode');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');
const AsyncForEach = require('await-async-foreach');
const Fs = require('fs');
const Path = require('path');
const Randomstring = require('randomstring');
const TradeRequestModel = require('project/models/TradeRequestModel');
const CommisionModel = require('project/models/CommisionModel');
const TradeConstant = require('project/constants/TradeConstant');
const UserBalanceService = require('project/services/UserBalanceService');
const ExternalService = require('project/services/ExternalService');
const RequestService = require('project/services/RequestService');
const AccountModel = require('project/models/AccountModel');
const SendEmailWorker = require('project/worker/SendEmail');
const numeral = require('numeral');
const SocialConfig = require('project/config/SocialId');
const AdsModel = require('project/models/AdsModel');
const AccessTokenModel = require('project/models/AccessTokenModel');
const JsonWebToken = require('jsonwebtoken');
const AuthenticationConfig = require('project/config/Authentication');
const NotificationModel = require('project/models/NotificationModel');
const SendNotificationWorker = require('project/worker/SendNotification');

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
    // update file cho buyerTradeRequest
    // await TradeRequestModel.updateMany(
    //   { transaction: payload.transaction },
    //   {
    //     $set: {
    //       status: TradeConstant.TRADE_STATUS.PAID,
    //       proof: {
    //         filePath: response[0].path,
    //         sentAt: new Date()
    //       }
    //     }
    //   });
    let sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: buyerTradeRequest.transaction,
      type: TradeConstant.TRADE_TYPE.SELL
    });
    if (sellerTradeRequestInfo.partnerTransaction) {
      // lệnh mua  của mình khớp lệnh SELL của đối tác => BUY V => +V, -vnd
      // update 2 trade requests

      //#region GD thành công luôn sau đó cho TH user trong hệ thống xác nhận GD SELL của partner
      /**
        const update2TradeRequest = await TradeRequestModel.updateMany(
          { transaction: buyerTradeRequest.transaction },
          {
            $set: {
              status: TradeConstant.TRADE_STATUS.SUCCEEDED,
              filledValue: buyerTradeRequest.totalValue,
              filledAmount: buyerTradeRequest.totalAmount,
              proof: {
                filePath: response[0].path,
                sentAt: new Date()
              }
            }
          },
          { multi: true }
        );
        if (!update2TradeRequest || update2TradeRequest.nModified !== 2) {
          throw { message: 'Không thể cập nhật trạng thái giao dịch, vui lòng kiểm tra lại!' };
        }
        // +filledAmount trong ads
        await AdsModel.updateOne(
          { id: buyerTradeRequest.adsId },
          {
            $inc: {
              filledAmount: buyerTradeRequest.totalAmount
            }
          });
        // update GD commision của A0 thành công
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        const commissionA0 = await CommisionModel.findOne({
          accountId: systemAccountId,
          transaction: buyerTradeRequest.transaction,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE
        }).lean();
        if (!commissionA0) {
          console.log('Không tìm thấy giao dịch commision =>>>> FIND BY', JSON.stringify({
            accountId: systemAccountId,
            transaction: buyerTradeRequest.transaction,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE
          }));
          throw { message: 'Không tìm thấy giao dịch commision' };
        }
        await CommisionModel.updateOne(
          { id: commissionA0.id },
          { status: TradeConstant.COMMISION_STATUS.SUCCEEDED }
        );
        // +V  cho người mua
        const userBalanceCreate = await UserBalanceService.addBalance(
          buyerTradeRequest.accountId,
          buyerTradeRequest.amount,
          `Mua V #${buyerTradeRequest.transaction}`,
          sellerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (userBalanceCreate.code !== 1) {
          //TODO
          throw { message: 'Không thể cộng V cho người mua!' };
        }
        // +V cho A0
        const addCommisionA0Data = await UserBalanceService.addBalance(
          commissionA0.accountId,
          commissionA0.amount,
          `Cộng commision từ fee của GD bán V #${sellerTradeRequestInfo.transaction}`,
          commissionA0,
          GeneralConstant.SOURCE_NAME.COMMISION
        );
        if (addCommisionA0Data.code !== 1) {
       throw { message: 'Không thể cộng V cho user cấp 0!' };
        }

        // -V của A0 để chia cho A1 và A2
        const minusCommisionA0Data = await ExternalService.minusCommissionSystemUser(
          {
            amount: sellerTradeRequestInfo.amount,
            transaction: sellerTradeRequestInfo.transaction
          },
          sellerTradeRequestInfo,
          `Chia commision cho user từ GD bán #${sellerTradeRequestInfo.transaction}`
        );
        console.log('--------->Trừ commision A0!', JSON.stringify(minusCommisionA0Data));
        if (minusCommisionA0Data.code !== 1) {
          // throw Error(minusCommisionData.message);
        }
        // +V cho các cấp user
        const commisionData = await ExternalService.addCommissionUser(
          {
            amount: buyerTradeRequest.amount,
            transaction: buyerTradeRequest.transaction
          },
          buyerTradeRequest,
          GeneralConstant.COMMISION_TYPE.COMMISION,
          `Nhận commision từ giao dịch mua #${buyerTradeRequest.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('Upload bằng chứng chuyển tiển--------->chia commision cho user C1 và C2 Errorrrrrr!', JSON.stringify(commisionData));
          // throw Error(commisionData.message);

        }
        console.log('sellerTradeRequestInfo upload proof =>>>>', JSON.stringify(sellerTradeRequestInfo));
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
            status: TradeConstant.TRADE_STATUS.SUCCEEDED
          };
          const logRequest = await RequestService.requestPost(sellerTradeRequestInfo.ipnUrl, null, body, {});
          console.log('1----/v1/trade-request/xác nhận đã thanh toán: sellerTradeRequestInfo.ipnUrl response from ', sellerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
        }
     */
      //#endregion

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
