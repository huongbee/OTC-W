const TradeRequestModel = require('project/models/TradeRequestModel');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const AdsModel = require('project/models/AdsModel');
const moment = require('moment');
const GeneralConstant = require('project/constants/GeneralConstant');
const SettingModel = require('project/models/SettingModel');
const Decimal = require('decimal.js');
const AccountModel = require('project/models/AccountModel');
const ExternalService = require('project/services/ExternalService');
const UserBalanceService = require('project/services/UserBalanceService');
const CommisionModel = require('project/models/CommisionModel');
const RequestService = require('project/services/RequestService');
const SendEmailWorker = require('project/worker/SendEmail');
const SocialConfig = require('project/config/SocialId');
const numeral = require('numeral');
const UserBalanceModel = require('project/models/UserBalanceModel');
const GetUserBalance = require('project/helpers/GetUserBalance');
const NotificationModel = require('project/models/NotificationModel');
module.exports = {
  async addNotification(message) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    const messageType = _.get(message, 'text') ? 'text' : _.get(message, 'photo') ? 'photo' : 'document';
    const notificationCreate = await NotificationModel.create({
      type: 'telegram',
      receiver: ['BOT'],
      sender: message.from.id,
      messageType: 'RECEIVE',
      message: {
        accountId: message.from.id,
        transaction: '',
        message_id: message.message_id,
        type: messageType,
        content: messageType === 'text' ? _.get(message, 'text') : ''
      },
      sendTime: moment(new Date()),
      extraData: message
    });
    if (_.get(notificationCreate, 'id', null) !== null) {
      response.code = 1;
      response.message = 'Thêm thông báo thành công';
      response.data = notificationCreate;
      return response;
    }
    response.message = 'Thêm thông báo thất bại';
    return response;
  },
  /**
  * hủy GD BUY của ĐẠI LÝ và tìm Ads khác để khớp cho user
  * @param {*} payload {id, transaction, status, reason}  status: trạng thái cần chuyển (REFUSED|EXPIRED|CANCELLED)
  * @param {*} agencyInfo {id} thông tin của đại lý MUA
  * @param {*} accountAction id user thực hiện
  */
  async refuseTradeBuy(payload, agencyInfo, accountAction) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    console.log('refuseTradeBuy ===>', JSON.stringify({ payload, agencyInfo, accountAction }));
    const systemAccountLevel2 = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_LEVEL2 }).lean();
    if (!systemAccountLevel2) {
      response.message = '[ERR!] Không thể từ chối giao dịch';
      return response;
    }
    if (systemAccountLevel2.id === agencyInfo.id) {
      response.message = 'Bạn không thể từ chối giao dịch!';
      return response;
    }
    // hủy GD BUY của ĐẠI LÝ
    const tradeRequestBuyer = await TradeRequestModel.findOne({
      id: payload.id,
      accountId: agencyInfo.id,
      type: TradeConstant.TRADE_TYPE.BUY,
      transaction: payload.transaction,
      status: { $nin: [TradeConstant.TRADE_STATUS.REFUSED, TradeConstant.TRADE_STATUS.EXPIRED] }
    }).lean();
    if (!tradeRequestBuyer) {
      response.message = 'Không tìm thấy lệnh';
      return response;
    }
    console.log('refuseTradeBuy Info ===>Không thể từ chối giao dịch', JSON.stringify(tradeRequestBuyer));
    if (tradeRequestBuyer.status === TradeConstant.TRADE_STATUS.SUCCEEDED) {
      response.message = 'Giao dịch đã thành công, không thể từ chối';
      return response;
    }
    if (tradeRequestBuyer.status !== TradeConstant.TRADE_STATUS.PENDING) {
      response.message = 'Trạng thái giao dịch không thể từ chối';
      return response;
    }
    let status = TradeConstant.TRADE_STATUS.REFUSED;
    if (payload.status) status = payload.status;
    const updatedBuyTrade = await TradeRequestModel.updateOne(
      { id: tradeRequestBuyer.id },
      {
        $set: {
          status
        },
        $push: {
          changedStatus: {
            from: tradeRequestBuyer.status,
            to: status,
            reason: payload.reason,
            accountAction: accountAction,
            updatedAt: new Date()
          }
        }
      });
    if (!updatedBuyTrade || updatedBuyTrade.nModified !== 1) {
      response.message = 'Từ chối thất bại';
      return response;
    }
    // hoàn V cho ADS của BUYER
    const adsInfoRefund = await AdsModel.updateOne(
      { id: tradeRequestBuyer.adsId },
      {
        $inc: {
          amount: tradeRequestBuyer.amount
        }
      }
    );
    if (!adsInfoRefund || adsInfoRefund.nModified !== 1) {
      response.message = 'Lỗi cập nhật GD';
      return response;
    }
    const tradeRequestSeller = await TradeRequestModel.findOne({
      transaction: tradeRequestBuyer.transaction,
      type: TradeConstant.TRADE_TYPE.SELL
    }).lean();
    // chọn lại ĐẠI LÝ BUYER level 2
    const selectedAds = await ExternalService.assignBuyRequest(
      tradeRequestBuyer.amount,
      tradeRequestSeller.accountId,
      3,
      tradeRequestSeller.exceptedAccount
    );
    if (selectedAds.code !== 1) {
      response.message = 'Không tìm thấy quảng cáo phù hợp';
      return response;
    }
    const adsInfo = await AdsModel.findOne({ id: selectedAds.data.id }).lean();
    if (!adsInfo) {
      response.message = 'Không tìm thấy quảng cáo phù hợp';
      return response;
    }
    console.log('adsInfo external SELL======>', JSON.stringify(adsInfo));
    if (tradeRequestBuyer.amount > adsInfo.amount) {
      response.message = 'Số V giao dịch không phù hợp';
      return response;
    }
    if (tradeRequestBuyer.amount < adsInfo.minAmount) {
      response.message = `Số V giao dịch tối thiếu là ${numeral(adsInfo.minAmount).format('0, 0')}`;
      return response;
    }
    // trừ V trong GD Buy ads
    const adsInfoUpdated = await AdsModel.updateOne(
      { id: adsInfo.id },
      {
        $inc: {
          amount: -tradeRequestBuyer.amount
        }
      }
    );
    if (!adsInfoUpdated || adsInfoUpdated.nModified !== 1) {
      response.message = 'Lỗi khởi tạo giao dịch, vui lòng thử lại';
      return response;
    }

    const newTradeRequestBuyer = await TradeRequestModel.create({
      adsId: adsInfo.id,
      transaction: tradeRequestBuyer.transaction,
      accountId: adsInfo.accountId,
      type: TradeConstant.TRADE_TYPE.BUY,
      status: TradeConstant.TRADE_STATUS.PENDING,
      amount: tradeRequestBuyer.amount,
      feeAmount: tradeRequestBuyer.feeAmount,
      totalAmount: tradeRequestBuyer.totalAmount,
      filledAmount: tradeRequestBuyer.filledAmount,
      value: tradeRequestBuyer.value,
      fee: tradeRequestBuyer.fee,
      totalValue: tradeRequestBuyer.totalValue,
      filledValue: tradeRequestBuyer.filledValue,
      extraData: adsInfo,
      paymentInfo: tradeRequestBuyer.paymentInfo,
      expiredAt: moment(new Date()).add(15, 'minutes')
    });
    if (!newTradeRequestBuyer) {
      response.message = 'Tạo lại GD thất bại';
      return response;
    }
    await TradeRequestModel.updateOne(
      {
        transaction: tradeRequestBuyer.transaction,
        type: TradeConstant.TRADE_TYPE.SELL
      },
      {
        adsId: adsInfo.id,
        $addToSet: {
          exceptedAccount: adsInfo.accountId
        }
      }
    );
    const buyerInfo = await AccountModel.findOne({ id: adsInfo.accountId }).lean();
    SendEmailWorker.pushSendEmail(
      buyerInfo.email,
      `Quý khách có giao dịch MUA mới<br>
        Mã giao dịch: <b>#${tradeRequestBuyer.transaction}</b> <br>
        Lượng giao dịch: ${numeral(tradeRequestBuyer.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết: <a href="${SocialConfig.environment.web}/home/trade/${tradeRequestBuyer.transaction}" target="_blank">TẠI ĐÂY</a>`,
      `WMV thông báo giao dịch BÁN. #${tradeRequestBuyer.transaction}`,
      'send-notification');

    response.code = 1;
    response.message = 'Tạo lại GD thành công';
    response.data = { tradeRequestInfo: tradeRequestBuyer };
    return response;
  },
  /**
   *
   * @param {*} payload {transaction}
   * @param {*} accountInfo {id}
   */
  async acceptTradeBuy(payload, accountInfo) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    const tradeRequestBuyer = await TradeRequestModel.findOne({
      accountId: accountInfo.id,
      type: TradeConstant.TRADE_TYPE.BUY,
      transaction: payload.transaction
      // status: TradeConstant.TRADE_STATUS.PENDING
    }).lean();
    if (!tradeRequestBuyer) {
      response.message = 'Không tìm thấy lệnh';
      return response;
    }
    if (tradeRequestBuyer.status === TradeConstant.TRADE_STATUS.REFUSED) {
      response.message = 'Giao dịch đã bị từ chối';
      return response;
    }
    if (tradeRequestBuyer.status === TradeConstant.TRADE_STATUS.SUCCEEDED) {
      response.message = 'Giao dịch đã thành công';
      return response;
    }
    if (tradeRequestBuyer.status !== TradeConstant.TRADE_STATUS.PENDING) {
      response.message = 'Trạng thái giao dịch không hợp lệ';
      return response;
    }
    await TradeRequestModel.updateMany(
      {
        transaction: payload.transaction,
        status: TradeConstant.TRADE_STATUS.PENDING
      },
      {
        $set: {
          acceptedAccountId: accountInfo.id,
          'sentNotification.after10mins': true // off resent sau 10 mins
        }
      }
    );
    const tradeRequestSeller = await TradeRequestModel.findOne({
      type: TradeConstant.TRADE_TYPE.SELL,
      transaction: payload.transaction,
      status: TradeConstant.TRADE_STATUS.PENDING
    });
    const buyerInfo = await AccountModel.findOne({ id: accountInfo.id }).lean();
    SendEmailWorker.pushSendEmail(
      buyerInfo.email,
      `Quý khách có giao dịch MUA mới<br>
        Mã giao dịch: <b>#${tradeRequestBuyer.transaction}</b> <br>
        Lượng giao dịch: ${numeral(tradeRequestBuyer.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết: <a href="${SocialConfig.environment.web}/home/trade/${tradeRequestBuyer.transaction}" target="_blank">TẠI ĐÂY</a>`,
      `WMV thông báo giao dịch BÁN. #${tradeRequestBuyer.transaction}`,
      'send-notification');
    response.code = 1;
    response.message = 'Đã ghi nhận lệnh';
    response.data = { tradeRequestInfo: tradeRequestBuyer };
    return response;
  },
  /**
   *
   * @param {*} payload {transaction, proofImage}
   * @param {*} accountInfo // buyer
   */
  async confirmPaid(payload, accountInfo) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    const buyerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      accountId: accountInfo.id,
      type: TradeConstant.TRADE_TYPE.BUY
    }).lean();
    console.log('Proccessing Transss ... Thong tin GD  mua  --------->', JSON.stringify({
      transaction: payload.transaction,
      accountId: accountInfo.id,
      buyerTradeRequestInfo
    }));
    if (_.get(buyerTradeRequestInfo, 'id', null) === null) {
      response.message = 'Không tìm thấy thông tin giao dịch';
      return response;
    }
    if (buyerTradeRequestInfo.status === TradeConstant.TRADE_STATUS.PAID) {
      response.message = 'Bạn đã xác nhận chuyển khoản trước đó';
      return response;
    }
    if (!_.includes([TradeConstant.TRADE_STATUS.PENDING], buyerTradeRequestInfo.status)) {
      response.message = 'Trạng thái giao dịch không hợp lệ';
      return response;
    }
    let sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: buyerTradeRequestInfo.transaction,
      type: TradeConstant.TRADE_TYPE.SELL,
      status: TradeConstant.TRADE_STATUS.PENDING
    });
    // cap nhật trạng thái đã thanh toán cho GD của người bán và cả người mua
    let proof = {};
    if (!payload.proofImage) {
      proof.isWaiting = true;
      proof.expiredAt = moment(new Date()).add(10, 'minutes');
    }
    const updated = await TradeRequestModel.updateMany(
      {
        id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
      },
      {
        $set: {
          status: TradeConstant.TRADE_STATUS.PAID,
          'paymentInfo.content': payload.content || buyerTradeRequestInfo.paymentInfo.content,
          proof
        },
        $push: {
          changedStatus: {
            from: buyerTradeRequestInfo.status,
            to: TradeConstant.TRADE_STATUS.PAID,
            reason: 'Người mua xác nhận đã thanh toán VNĐ',
            accountAction: accountInfo.id,
            updatedAt: new Date()
          }
        }
      },
      { multi: true });
    if (!updated || updated.nModified !== 2) {
      response.message = 'Có lỗi thực thi giao dịch!';
      return response;
    }

    const ipnUrl = buyerTradeRequestInfo.ipnUrl ? buyerTradeRequestInfo.ipnUrl : sellerTradeRequestInfo.ipnUrl;
    if (ipnUrl) {
      const partnerTransaction = buyerTradeRequestInfo.partnerTransaction || sellerTradeRequestInfo.partnerTransaction || sellerTradeRequestInfo.paymentInfo.content;
      const body = {
        transaction: buyerTradeRequestInfo.transaction,
        partnerTransaction: partnerTransaction,
        status: TradeConstant.TRADE_STATUS.PAID
      };
      const logRequest = await RequestService.requestPost(ipnUrl, null, body, {});
      console.log('1----/v1/trade-request/ xác nhận đã ck: sellerTradeRequestInfo.ipnUrl response from ', ipnUrl, JSON.stringify({ body, logRequest }));
    }
    const sellerInfo = await AccountModel.findOne({ id: sellerTradeRequestInfo.accountId }).lean();
    console.log('BUYER confirm paidddddd....=>sellerInfo', JSON.stringify(sellerInfo));

    SendEmailWorker.pushSendEmail(
      sellerInfo.email,
      `*Người mua đã xác nhận chuyển tiền cho giao dịch BÁN của quý khách<br>
        Mã giao dịch: <b>#${sellerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(sellerTradeRequestInfo.amount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${sellerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a> `,
      `WMV thông báo giao dịch BÁN. Mã #${sellerTradeRequestInfo.transaction}`,
      'send-notification');
    response.code = 1;
    response.message = 'Cập nhật giao dịch thành công';
    response.data = { tradeRequestInfo: sellerTradeRequestInfo };
    return response;
  },

  /**
   *
   * @param {*} payload { transaction}
   * @param {*} accountInfo {id}
   */
  async cancelBuyTradeRequest(payload, accountInfo) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    let trade = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.BUY,
      accountId: accountInfo.id
      // status: TradeConstant.TRADE_STATUS.PENDING
    }).lean();
    if (!trade) {
      response.message = 'Không tìm thấy thông tin giao dịch';
      return response;
    }
    if (trade.status !== TradeConstant.TRADE_STATUS.PENDING) {
      response.message = 'Trạng thái giao dịch không được phép hủy';
      return response;
    }
    const now = moment(new Date());
    const expiredAt = moment(new Date(trade.expiredAt));
    if (now.diff(expiredAt, 'minutes') < 15) {
      response.message = 'Chỉ được hủy giao dịch 15 phút sau khi tạo';
      return response;
    }
    const updated = await TradeRequestModel.updateMany(
      {
        transaction: trade.transaction,
        status: TradeConstant.TRADE_STATUS.PENDING
      },
      {
        $set: {
          status: TradeConstant.TRADE_STATUS.CANCELLED
        },
        $push: {
          changedStatus: {
            from: trade.status,
            to: TradeConstant.TRADE_STATUS.CANCELLED,
            reason: 'user yêu cầu hủy giao dịch',
            accountAction: accountInfo.id,
            updatedAt: new Date()
          }
        }
      },
      { multi: true }
    );
    if (!updated || updated.nModified !== 2) {
      response.message = 'Hủy giao dịch thất bại, vui lòng thử lại';
      return response;
    }
    //  // trả V lại cho ADS sell
    const adsInfoUpdated = await AdsModel.updateOne(
      { id: trade.adsId },
      {
        $inc: {
          amount: trade.amount
        }
      });
    if (!adsInfoUpdated || adsInfoUpdated.nModified !== 1) {
      response.message = 'Không thể hoàn trả cho quảng cáo, vui lòng kiểm tra lại';
      return response;
    }
    if (!trade.ipnUrl) {
      trade = await TradeRequestModel.findOne({
        transaction: payload.transaction,
        type: TradeConstant.TRADE_TYPE.SELL,
        status: TradeConstant.TRADE_STATUS.CANCELLED
      }).lean();
    }
    const ipnUrl = trade.ipnUrl;
    if (ipnUrl) {
      const partnerTransaction = trade.partnerTransaction;
      const body = {
        transaction: trade.transaction,
        partnerTransaction: partnerTransaction,
        status: TradeConstant.TRADE_STATUS.CANCELLED
      };
      const logRequest = await RequestService.requestPost(ipnUrl, null, body, {});
      console.log('1----/v1/trade-request/ hủy GD mua response from ', ipnUrl, JSON.stringify({ body, logRequest }));
    }

    response.code = 1;
    response.message = 'Hủy giao dịch thành công';
    response.data = { tradeRequestInfo: trade };
    return response;
  },

  /**
   * **Cập nhật trạng thái GD sang CANCELLED hoặc EXPIRED**
   * - CANCELLED khi user thực hiện hành động HỦY GD
   * - EXPIRED khi quá hạn 60p (cron update EXPIRED)
   * @param {*} payload { transaction, reason, status }
   * @param {*} accountInfo { id } seller info
   */
  async cancelSellTradeRequest(payload, accountInfo) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    const tradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      type: TradeConstant.TRADE_TYPE.SELL,
      accountId: accountInfo.id
    }).lean();
    if (!tradeRequestInfo) {
      response.message = 'Không tìm thấy thông tin giao dịch';
      return response;
    }
    if (!_.includes([TradeConstant.TRADE_STATUS.PENDING, TradeConstant.TRADE_STATUS.PAID], tradeRequestInfo.status)) {
      response.message = 'Trạng thái giao dịch không hợp lệ';
      return response;
    }
    const adsInfo = await AdsModel.findOne({
      id: tradeRequestInfo.adsId
      // type: TradeConstant.ADS_TYPE.BUY // quảng cáo Mua => Trade Sell
    }).lean();
    if (!adsInfo) {
      response.message = 'Không tìm thấy thông tin quảng cáo';
      return response;
    }
    const updatedTrade = await TradeRequestModel.updateMany(
      {
        transaction: tradeRequestInfo.transaction,
        status: { $in: [TradeConstant.TRADE_STATUS.PENDING, TradeConstant.TRADE_STATUS.PAID] }
      },
      {
        $set: {
          status: payload.status
        },
        $push: {
          changedStatus: {
            from: tradeRequestInfo.status,
            to: payload.status,
            reason: payload.reason,
            updatedAt: new Date(),
            accountId: 0
          }
        }
      },
      { multi: true }
    );
    // console.log({ updatedTrade });
    if (updatedTrade && updatedTrade.nModified === 2) {
      // trả V cho Ads
      const updateAds = await AdsModel.updateOne(
        { id: adsInfo.id },
        {
          $inc: {
            amount: tradeRequestInfo.totalAmount
          }
        });
      if (!updateAds) {
        // Notification
        response.message = 'Cập nhật giao dịch thất bại!';
        return response;
      }
      // // tìm seller
      const tradeSell = await TradeRequestModel.findOne({
        transaction: tradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.SELL
      });
      // // console.log(JSON.stringify(tradeSell));
      // if (!tradeSell) {
      //   response.message = 'Không tìm thấy thông tin trade của Seller!';
      //   return response;
      // }
      if (adsInfo.type === TradeConstant.ADS_TYPE.BUY) {
        const addBalanceSeller = await UserBalanceService.addBalance(
          tradeSell.accountId,
          tradeSell.totalAmount, // trả V và cả phí V
          `Hoàn trả V do lệnh SELL #${tradeSell.transaction} bị hủy`,
          tradeSell,
          GeneralConstant.SOURCE_NAME.TRADE_EXPIRED
        );
        console.log('addBalanceSelleraddBalanceSeller', JSON.stringify(addBalanceSeller));
        if (addBalanceSeller.code !== 1) {
          response.message = 'Hoàn V cho lệnh Trade bị hủy không thành công';
          return response;
        }
        // hủy commision đã tạo cho A0(nếu có)
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        const commissionA0 = await CommisionModel.findOne({
          transaction: tradeRequestInfo.transaction,
          accountId: systemAccountId,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE,
          status: TradeConstant.COMMISION_STATUS.PENDING,
          adsId: tradeSell.adsId,
          tradeId: tradeSell.id
        });
        if (commissionA0) {
          await CommisionModel.updateOne(
            { id: commissionA0.id },
            { status: TradeConstant.COMMISION_STATUS.CANCELLED }
          );
        }
      }

      if (!tradeSell.ipnUrl) {
        const tradeBuy = await TradeRequestModel.findOne({
          transaction: payload.transaction,
          type: TradeConstant.TRADE_TYPE.BUY,
          status: payload.status
        }).lean();
        const ipnUrl = tradeBuy.ipnUrl ? tradeBuy.ipnUrl : tradeSell.ipnUrl;
        if (ipnUrl) {
          const partnerTransaction = tradeBuy.partnerTransaction || tradeSell.partnerTransaction || tradeBuy.paymentInfo.content;
          const body = {
            transaction: tradeBuy.transaction,
            partnerTransaction: partnerTransaction,
            status: payload.status
          };
          const logRequest = await RequestService.requestPost(ipnUrl, null, body, {});
          console.log('1----/v1/trade-request/ hủy GD mua response from ', ipnUrl, JSON.stringify({ body, logRequest }));
        }
      }

      // notify cho người SELL
      const sellerInfo = await AccountModel.findOne({ id: tradeSell.accountId }).lean();

      SendEmailWorker.pushSendEmail(
        sellerInfo.email,
        `Giao dịch SELL của quý khách đã bị hủy do người mua không thực hiện giao dịch<br>
              Mã giao dịch: <b>#${tradeSell.transaction}</b> <br>
              Lượng giao dịch: ${numeral(tradeSell.amount).format('0,0')} </b> <br>
              Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${tradeSell.transaction}" target="_blank">TẠI ĐÂY</a>`,
        `Giao dịch SELL ${tradeSell.transaction} bị hủy`,
        'send-notification');
      // notification cho Buyer:
      const tradeBuy = await TradeRequestModel.findOne({
        transaction: tradeSell.transaction,
        type: TradeConstant.TRADE_TYPE.BUY,
        status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
      }).sort({ createdAt: -1 }).lean();
      const buyerInfo = await AccountModel.findOne({ id: tradeBuy.accountId }).lean();

      SendEmailWorker.pushSendEmail(
        buyerInfo.email,
        `Giao dịch BUY của quý khách đã bị hủy<br>
        Mã giao dịch: <b>#${tradeSell.transaction}</b> <br>
        Lượng giao dịch: ${numeral(tradeSell.amount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${tradeSell.transaction}" target="_blank">TẠI ĐÂY</a>`,
        `Giao dịch MUA ${tradeSell.transaction} bị hủy`,
        'send-notification');
      response.code = 1;
      response.message = 'Cập nhật thành công';
      response.data = { tradeRequestInfo };
      return response;
    }
    response.message = 'Cập nhật thất bại';
    return response;
  },
  /**
   *
   * @param {*} payload { transaction, amount }
   * @param {*} accountInfo {id, accountType} // account xác nhận
   */
  async confirmReceiveVND(payload, accountInfo) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    // tìm thông tin GD bán
    let sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      accountId: accountInfo.id
      // type: TradeConstant.TRADE_TYPE.SELL
    }).lean();
    console.log('Thong tin GD bán--------->', JSON.stringify({
      transaction: payload.transaction,
      accountId: accountInfo.id,
      sellerTradeRequestInfo
    }));
    if (!sellerTradeRequestInfo) {
      response.message = 'Không tìm thấy thông tin giao dịch';
      return response;
    }
    if (!_.includes(
      [
        TradeConstant.TRADE_STATUS.PAID,
        TradeConstant.TRADE_STATUS.PENDING,
        TradeConstant.TRADE_STATUS.WARNING,
        TradeConstant.TRADE_STATUS.CANCELLED,
        TradeConstant.TRADE_STATUS.EXPIRED
      ], sellerTradeRequestInfo.status)) {
      response.message = 'Trạng thái giao dịch không hợp lệ';
      return response;
    }
    if (!payload.amount) payload.amount = sellerTradeRequestInfo.amount;
    if (_.get(accountInfo, 'accountType', false) === false) {
      accountInfo = await AccountModel.findOne({ id: accountInfo.id }).lean();
    }
    if (_.includes(
      [
        TradeConstant.TRADE_STATUS.CANCELLED,
        TradeConstant.TRADE_STATUS.EXPIRED
      ], sellerTradeRequestInfo.status)) {
      // GD đã hoàn V cho ads, đã hoàn V sell => lấy lại lượng V
      const adsInfo = await AdsModel.findOne({
        id: sellerTradeRequestInfo.adsId,
        status: TradeConstant.ADS_STATUS.ACTIVE
      }).lean();
      if (!adsInfo) {
        response.message = 'Không tìm thấy thông tin quảng cáo BUY';
        return response;
      }
      if (sellerTradeRequestInfo.amount > adsInfo.amount) {
        response.message = 'Số V trong quảng cáo BUY không phù hợp';
        return response;
      }
      const updateAds = await AdsModel.updateOne(
        { id: sellerTradeRequestInfo.adsId },
        {
          $inc: {
            amount: -sellerTradeRequestInfo.amount
          }
        });
      if (!updateAds) {
        // Notification
        response.message = 'Trừ V của quảng cáo BUY thất bại!';
        return response;
      }
      // trừ V nếu là GD SELL => ADS BUY
      if (adsInfo.status === TradeConstant.ADS_TYPE.BUY) {
        const userBalance = await GetUserBalance(accountInfo);
        let commissionPercent = await SettingModel.findOne({ key: 'COMMISION_PERCENT' }).lean();
        commissionPercent = _.get(commissionPercent, 'value', null) !== null ? commissionPercent.value : GeneralConstant.COMMISION_PERCENT;
        let commissionV = _.toNumber(new Decimal(sellerTradeRequestInfo.amount).mul(commissionPercent).div(100));
        commissionV = Math.ceil(commissionV);

        const totalV = _.toNumber(new Decimal(sellerTradeRequestInfo.amount).add(commissionV));
        console.log('External SELL: totalV=>>>>', totalV, 'userBalance=>>>>>', JSON.stringify(userBalance));
        if (totalV > userBalance.availableBalance) {
          response.message = 'Không đủ số V trong tài khoản';
          return response;
        }

        const userBalanceCreate = await UserBalanceService.minusBalance(
          sellerTradeRequestInfo.accountId,
          sellerTradeRequestInfo.amount,
          `Trừ V vì GD bán #${sellerTradeRequestInfo.transaction} đã được xác nhận`,
          sellerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (userBalanceCreate.code !== 1) {
          // trả V
          await AdsModel.updateOne(
            { id: adsInfo.id },
            {
              $inc: {
                amount: sellerTradeRequestInfo.amount,
                filledAmount: -sellerTradeRequestInfo.amount
              }
            }
          );
          response.message = `Trừ V không thành công. ${userBalanceCreate.data.message}`;
          return response;
        }
        // trừ V fee (nếu có)
        if (accountInfo.accountType === 3) {
          const userBalanceCommisionCreate = await UserBalanceService.minusBalance(
            sellerTradeRequestInfo.accountId,
            commissionV,
            `Trừ phí thanh toán cho giao dịch #${sellerTradeRequestInfo.transaction} đã được xác nhận`,
            sellerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE_FEE
          );
          if (userBalanceCommisionCreate.code !== 1) {
            // trả V
            await AdsModel.updateOne(
              { id: adsInfo.id },
              {
                $inc: {
                  amount: sellerTradeRequestInfo.amount,
                  filledAmount: -sellerTradeRequestInfo.amount
                }
              }
            );
            response.message = `Trừ fee V không thành công. ${userBalanceCommisionCreate.data.message}`;
            return response;
          }

          let systemAccountId = null;
          const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
          if (systemAccount) systemAccountId = systemAccount.id;
          const commissionA0 = await CommisionModel.findOne({
            transaction: sellerTradeRequestInfo.transaction,
            accountId: systemAccountId,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE,
            status: TradeConstant.COMMISION_STATUS.CANCELLED,
            adsId: sellerTradeRequestInfo.adsId,
            tradeId: sellerTradeRequestInfo.id
          });
          if (commissionA0) {
            await CommisionModel.updateOne(
              { id: commissionA0.id },
              { status: TradeConstant.COMMISION_STATUS.PENDING }
            );
          }
        }
      }
    }

    let buyRate = await SettingModel.findOne({ key: 'RATE_BUY' }).lean();
    buyRate = _.get(buyRate, 'value', null) !== null ? buyRate.value : 1;
    const actuallyReceivedV = _.toNumber(new Decimal(payload.amount).mul(buyRate));
    if (accountInfo.accountType === 3) {
      // user cấp 3 xác nhận đã nhận tiền cho GD SELL chính mình tạo
      // user cấp 3 không thể xác nhận GD BUY của người khác tạo - là bản thân SELL, do user cấp 3 ko có quảng cáo BUY
      if (sellerTradeRequestInfo.type !== TradeConstant.TRADE_TYPE.SELL) {
        response.message = 'Giao dịch không hợp lệ!';
        return response;
      }
      const buyerTradeRequestInfo = await TradeRequestModel.findOne({
        transaction: payload.transaction,
        type: TradeConstant.TRADE_TYPE.BUY,
        status: sellerTradeRequestInfo.status
      }).sort({ createdAt: -1 }).lean();
      if (!buyerTradeRequestInfo) {
        response.message = 'Không tìm thấy giao dịch mua';
        return response;
      }

      let sellRate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
      sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;
      const actuallySellV = _.toNumber(new Decimal(payload.amount).mul(sellRate));

      if (sellerTradeRequestInfo.amount !== actuallySellV) {
        const update2TradeRequest = await TradeRequestModel.updateMany(
          {
            id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
          },
          {
            $set: {
              status: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
              amountConfirmReceived: actuallySellV,
              valueConfirmReceived: payload.amount
            },
            $push: {
              changedStatus: {
                from: sellerTradeRequestInfo.status,
                to: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
                reason: 'Seller xác nhận sai số tiền GD',
                accountAction: accountInfo.id,
                updatedAt: new Date()
              }
            }
          },
          { multi: true }
        );
        if (!update2TradeRequest || update2TradeRequest.nModified !== 2) {
          response.message = 'Không thể cập nhật trạng thái giao dịch, vui lòng thử lại sau';
          return response;
        }
        if (sellerTradeRequestInfo.ipnUrl) {
          sellerTradeRequestInfo = await TradeRequestModel.findOne({
            id: sellerTradeRequestInfo.id
          }).lean();
          const body = {
            transaction: sellerTradeRequestInfo.transaction,
            partnerTransaction: sellerTradeRequestInfo.partnerTransaction,
            status: sellerTradeRequestInfo.status
          };

          const logRequest = await RequestService.requestPost(sellerTradeRequestInfo.ipnUrl, null, body, {});

          console.log('11----/v1/trade-request/xác nhận đã thanh toán khác amount: sellerTradeRequestInfo.ipnUrl response from ', sellerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
        }
        response.message = 'Giao dịch tạm khóa do số tiền không trùng khớp. Vui lòng chờ kiểm tra.';
        return response;
      }
      else {
        const update2TradeRequest = await TradeRequestModel.updateMany(
          {
            id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
          },
          {
            $set: {
              status: TradeConstant.TRADE_STATUS.SUCCEEDED,
              filledValue: sellerTradeRequestInfo.value,
              filledAmount: sellerTradeRequestInfo.amount
            },
            $push: {
              changedStatus: {
                from: sellerTradeRequestInfo.status,
                to: TradeConstant.TRADE_STATUS.SUCCEEDED,
                reason: 'Người bán xác nhận đã nhận tiền',
                accountAction: accountInfo.id,
                updatedAt: new Date()
              }
            }
          },
          { multi: true }
        );
        if (!update2TradeRequest || update2TradeRequest.nModified !== 2) {
          response.message = 'Không thể cập nhật trạng thái giao dịch, vui lòng thử lại sau';
          return response;
        }
        // +filledAmount trong ads
        await AdsModel.updateOne(
          { id: sellerTradeRequestInfo.adsId },
          {
            $inc: {
              filledAmount: sellerTradeRequestInfo.amount,
              filledValue: sellerTradeRequestInfo.value
            }
          });
        // update GD commision của A0 thành công
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        const commissionA0 = await CommisionModel.findOne({
          accountId: systemAccountId,
          transaction: sellerTradeRequestInfo.transaction,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE
        }).lean();
        if (!commissionA0) {
          console.log('Không tìm thấy giao dịch commision =======>>>> FIND BY', JSON.stringify({
            accountId: systemAccountId,
            transaction: sellerTradeRequestInfo.transaction,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE
          }));
          response.message = 'Không tìm thấy giao dịch commision';
          return response;
        }
        await CommisionModel.updateOne(
          { id: commissionA0.id },
          { status: TradeConstant.COMMISION_STATUS.SUCCEEDED }
        );
        // +V  cho người mua
        const userBalanceCreate = await UserBalanceService.addBalance(
          buyerTradeRequestInfo.accountId,
          buyerTradeRequestInfo.amount,
          `Mua V #${buyerTradeRequestInfo.transaction}`,
          buyerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (userBalanceCreate.code !== 1) {
          //TODO
          response.message = 'Không thể cộng V cho người mua! Vui lòng thử lại';
          return response;
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

          response.message = 'Không thể cộng V cho user cấp 0!';
          return response;
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
            amount: buyerTradeRequestInfo.amount,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.COMMISION,
          `Nhận commision từ giao dịch mua #${buyerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('Level 3 Xác nhận đã nhận tiền--------->chia commision cho user C1 và C2 Errorrrrrr!', JSON.stringify(commisionData));
        }
        console.log('sellerTradeRequestInfo Xác nhận đã nhận tiền =>>>>', JSON.stringify(sellerTradeRequestInfo));
      }
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
      response.code = 1;
      response.message = 'Xác nhận thành công';
      return response;
    } else {
      if (sellerTradeRequestInfo.type === TradeConstant.TRADE_TYPE.BUY) {
        let buyerTradeRequestInfo = _.clone(sellerTradeRequestInfo);
        console.log(' lệnh mua của mình');
        //  lệnh mua  do mình tạo
        // tim GD nguoi bán
        sellerTradeRequestInfo = await TradeRequestModel.findOne({
          transaction: payload.transaction,
          type: TradeConstant.TRADE_TYPE.SELL,
          status: buyerTradeRequestInfo.status
        }).sort({ createdAt: -1 }).lean();
        if (!sellerTradeRequestInfo) {
          response.message = 'Không tìm thấy giao dịch bán';
          return response;
        }
        const buyerInfo = await AccountModel.findOne({ id: buyerTradeRequestInfo.accountId }).lean();

        let sellRate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
        sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;
        const actuallySellV = _.toNumber(new Decimal(payload.amount).mul(sellRate));
        // kiểm tra amountVND đã gửi có = với amount của GD hay ko
        if (sellerTradeRequestInfo.amount !== actuallySellV) {
          const update2TradeRequest = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
                amountConfirmReceived: actuallySellV,
                valueConfirmReceived: payload.amount
              },
              $push: {
                changedStatus: {
                  from: sellerTradeRequestInfo.status,
                  to: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
                  reason: 'Seller xác nhận sai số tiền GD',
                  accountAction: accountInfo.id,
                  updatedAt: new Date()
                }
              }
            },
            { multi: true });
          if (!update2TradeRequest || update2TradeRequest.nModified !== 2) {
            response.message = 'Không thể cập nhật trạng thái giao dịch, vui lòng thử lại sau';
            return response;
          }

          // IPN nếu có
          if (buyerTradeRequestInfo.ipnUrl) {
            const body = {
              transaction: buyerTradeRequestInfo.transaction,
              partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
              status: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED
            };
            const logRequest = await RequestService.requestPost(buyerTradeRequestInfo.ipnUrl, null, body, {});
            console.log('1----/v1/trade-request/confirm_received_vnd xác nhận khác số tiền buyerTradeRequestInfo.ipnUrl response from ', buyerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
          }
          response.message = 'Giao dịch tạm khóa do số tiền không trùng khớp. Vui lòng chờ kiểm tra';
          return response;

        } else {
          // cap nhật trạng thái thanh công cho GD của người bán và cả người mua
          const updated = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: sellerTradeRequestInfo.amount,
                filledValue: sellerTradeRequestInfo.value
              },
              $push: {
                changedStatus: {
                  from: sellerTradeRequestInfo.status,
                  to: TradeConstant.TRADE_STATUS.SUCCEEDED,
                  reason: 'Người bán xác nhận đã nhận tiền',
                  accountAction: accountInfo.id,
                  updatedAt: new Date()
                }
              }
            },
            { multi: true });
          if (!updated || updated.nModified !== 2) {
            response.message = 'Có lỗi update giao dịch, vui lòng kiểm tra lại';
            return response;
          }
          // +filledAmount trong ads
          await AdsModel.updateOne(
            { id: sellerTradeRequestInfo.adsId },
            {
              $inc: {
                filledAmount: sellerTradeRequestInfo.amount,
                filledValue: sellerTradeRequestInfo.value
              }
            });
          // +V cho người mua
          const buyerBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            buyerTradeRequestInfo.amount,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (buyerBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }
          // IPN nếu có
          if (buyerTradeRequestInfo.ipnUrl) {
            const body = {
              transaction: buyerTradeRequestInfo.transaction,
              partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
              status: TradeConstant.TRADE_STATUS.SUCCEEDED
            };
            const logRequest = await RequestService.requestPost(buyerTradeRequestInfo.ipnUrl, null, body, {});
            console.log('1----/v1/trade-request/confirm_received_vnd xác nhận thành công buyerTradeRequestInfo.ipnUrl response from ', buyerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
          }

          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch MUA <br>
          Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
          Lượng giao dịch: ${numeral(buyerTradeRequestInfo.amount).format('0,0')} </b> <br>
          Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
            'Quý khách đã được xác nhận giao dịch MUA',
            'send-notification');
          response.code = 1;
          response.message = 'Xác nhận thành công';
          return response;

        }
      } else {
        // lệnh sell do mình tạo => mình xác nhận đã nhân tiền => chuyển V cho người mua
        let buyerTradeRequestInfo = await TradeRequestModel.findOne({
          transaction: payload.transaction,
          type: TradeConstant.TRADE_TYPE.BUY,
          status: sellerTradeRequestInfo.status,
          account: { $ne: accountInfo.id }
        }).sort({ createdAt: -1 }).lean();
        if (!buyerTradeRequestInfo) {
          response.message = 'Không tìm thấy thông tin giao dịch của người mua';
          return response;
        }
        const buyerInfo = await AccountModel.findOne({ id: buyerTradeRequestInfo.accountId }).lean();
        console.log('buyerTradeRequestInfo.amount vs actuallyReceivedV', buyerTradeRequestInfo.amount, actuallyReceivedV);
        if (buyerTradeRequestInfo.amount !== actuallyReceivedV) {
          // cap nhật trạng thái thanh công cho GD của người bán và cả người mua
          const update2TradeRequest = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
                amountConfirmReceived: actuallyReceivedV,
                valueConfirmReceived: payload.amount
              },
              $push: {
                changedStatus: {
                  from: sellerTradeRequestInfo.status,
                  to: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
                  reason: 'Người bán xác nhận số tiền GD không trùng khớp',
                  accountAction: accountInfo.id,
                  updatedAt: new Date()
                }
              }
            },
            { multi: true });
          if (!update2TradeRequest || update2TradeRequest.nModified !== 2) {
            response.message = 'Không thể cập nhật trạng thái giao dịch, vui lòng thử lại sau';
            return response;
          }
          // IPN nếu có
          if (buyerTradeRequestInfo.ipnUrl) {
            const body = {
              transaction: buyerTradeRequestInfo.transaction,
              partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
              status: TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED
            };
            const logRequest = await RequestService.requestPost(buyerTradeRequestInfo.ipnUrl, null, body, {});
            console.log('1----/v1/trade-request/confirm_received_vnd xác nhận khác số tiền buyerTradeRequestInfo.ipnUrl response from ', buyerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
          }

          response.message = 'Giao dịch tạm khóa do số tiền không trùng khớp. Vui lòng chờ kiểm tra!';
          return response;

        } else {
          // cap nhật trạng thái thanh công cho GD của người bán và cả người mua
          const updated = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: buyerTradeRequestInfo.amount,
                filledValue: payload.amount
              },
              $push: {
                changedStatus: {
                  from: sellerTradeRequestInfo.status,
                  to: TradeConstant.TRADE_STATUS.SUCCEEDED,
                  reason: 'Người bán xác nhận đã nhận tiền',
                  accountAction: accountInfo.id,
                  updatedAt: new Date()
                }
              }
            },
            { multi: true });
          if (!updated || updated.nModified !== 2) {
            response.message = 'Có lỗi update giao dịch, vui lòng kiểm tra lại';
            return response;
          }
          await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $inc: {
                filledAmount: buyerTradeRequestInfo.amount,
                filledValue: payload.amount
              }
            }
          );
          // cong cho nguoi mua
          const userBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            buyerTradeRequestInfo.amount,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (userBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }
          //  kiem tra GD của user Partner mới +- commision
          if (buyerInfo.accountType === 3) {
            if (buyerTradeRequestInfo.partnerTransaction) {
              // trừ V của A0
              const minusCommisionData = await ExternalService.minusCommissionSystemUser(
                {
                  amount: buyerTradeRequestInfo.amount,
                  transaction: payload.transaction
                },
                buyerTradeRequestInfo,
                `Chia bonus cho user từ GD mua #${buyerTradeRequestInfo.transaction}`
              );
              if (minusCommisionData.code !== 1) {
                console.log('--------->Trừ commision A0 Error!', JSON.stringify(minusCommisionData));
                // throw Error(minusCommisionData.message);
              }
              //chia commision cho user C1 và C2 (tính userBalance cho A1 và A2 + add Commision model)
              const commisionData = await ExternalService.addCommissionUser(
                {
                  amount: sellerTradeRequestInfo.amount,
                  transaction: sellerTradeRequestInfo.transaction
                },
                sellerTradeRequestInfo,
                GeneralConstant.COMMISION_TYPE.BONUS,
                `Nhận bonus từ giao dịch mua #${sellerTradeRequestInfo.transaction}`
              );
              if (commisionData.code !== 1) {
                console.log('--------->chia commision cho user C1 và C2 Error!', JSON.stringify(commisionData));
                throw Error(commisionData.message);
              }
            }
          }

          // IPN nếu có
          if (buyerTradeRequestInfo.ipnUrl) {
            buyerTradeRequestInfo = await TradeRequestModel.findOne({
              transaction: payload.transaction,
              type: TradeConstant.TRADE_TYPE.BUY,
              status: TradeConstant.TRADE_STATUS.SUCCEEDED,
              account: { $ne: accountInfo.id }
            }).sort({ createdAt: -1 }).lean();
            const body = {
              transaction: buyerTradeRequestInfo.transaction,
              partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
              amountInfo: {
                amount: buyerTradeRequestInfo.amount,
                fee: buyerTradeRequestInfo.feeAmount,
                total: buyerTradeRequestInfo.totalAmount
              },
              valueInfo: {
                value: buyerTradeRequestInfo.value,
                fee: buyerTradeRequestInfo.fee,
                total: buyerTradeRequestInfo.totalValue
              },
              status: TradeConstant.TRADE_STATUS.SUCCEEDED
            };
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $inc: {
                  'sentIpn.count': 1 // tăng số lần gọi
                }
              });

            const logRequest = await RequestService.requestPost(buyerTradeRequestInfo.ipnUrl, null, body, {});
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $set: {
                  'sentIpn.isSentIPN': true // ipn thành công
                }
              });
            console.log('1----/v1/trade-request/confirm_received_vnd login buyerTradeRequestInfo.ipnUrl response from ', buyerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
          }
          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch MUA <br>
        Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
        Lượng giao diịch: ${numeral(buyerTradeRequestInfo.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a> `,
            'Quý khách đã được xác nhận giao dịch MUA',
            'send-notification');
          response.code = 1;
          response.message = 'Xác nhận thành công';
          return response;

        }
      }
    }
  },

  /**
   * Cập nhật thành công cho các GD khác số tiền
   * @param {*} payload  {transaction, amount (VNĐ)}
   * @param {*} sellerAccountInfo {id} // account của seller
   * @param {*} acctionAccountId accountID thực hiện
   * @param {*} note
   */
  async updateTradeRequestDiffAmountToSuccess(payload, sellerAccountInfo, acctionAccountId, note) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    // tìm thông tin GD bán
    let sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: payload.transaction,
      accountId: sellerAccountInfo.id
    }).lean();
    console.log('Thong tin GD bán--------->', JSON.stringify({
      payload,
      sellerTradeRequestInfo
    }));
    if (!sellerTradeRequestInfo) {
      response.message = 'Không tìm thấy thông tin giao dịch';
      return response;
    }
    if (!_.includes([TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED], sellerTradeRequestInfo.status)) {
      response.message = 'Trạng thái giao dịch không hợp lệ';
      return response;
    }
    if (!payload.amount) payload.amount = sellerTradeRequestInfo.amount;

    if (_.get(sellerAccountInfo, 'accountType', false) === false) {
      sellerAccountInfo = await AccountModel.findOne({ id: sellerAccountInfo.id }).lean();
    }
    let buyRate = await SettingModel.findOne({ key: 'RATE_BUY' }).lean();
    buyRate = _.get(buyRate, 'value', null) !== null ? buyRate.value : 1;
    const actuallyReceivedV = _.toNumber(new Decimal(payload.amount).mul(buyRate));
    const changedStatus = {
      from: sellerTradeRequestInfo.status,
      to: TradeConstant.TRADE_STATUS.SUCCEEDED,
      reason: note,
      accountAction: acctionAccountId,
      updatedAt: new Date()
    };
    if (sellerAccountInfo.accountType === 3) {
      // user cấp 3 xác nhận đã nhận tiền cho GD SELL chính mình tạo
      // user cấp 3 không thể xác nhận GD BUY của người khác tạo - là bản thân SELL, do user cấp 3 ko có quảng cáo BUY
      if (sellerTradeRequestInfo.type !== TradeConstant.TRADE_TYPE.SELL) {
        response.message = 'Giao dịch không hợp lệ!';
        return response;
      }
      const buyerTradeRequestInfo = await TradeRequestModel.findOne({
        transaction: payload.transaction,
        type: TradeConstant.TRADE_TYPE.BUY,
        status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
      }).lean();
      if (!buyerTradeRequestInfo) {
        response.message = 'Không tìm thấy giao dịch mua';
        return response;
      }

      let sellRate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
      sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;
      const actuallySellV = _.toNumber(new Decimal(payload.amount).mul(sellRate));

      if (sellerTradeRequestInfo.amount === actuallySellV) {
        const update2TradeRequest = await TradeRequestModel.updateMany(
          { id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] } },
          {
            $set: {
              status: TradeConstant.TRADE_STATUS.SUCCEEDED,
              filledValue: sellerTradeRequestInfo.value,
              filledAmount: sellerTradeRequestInfo.amount
            },
            $push: { changedStatus: changedStatus }
          },
          { multi: true }
        );
        if (!update2TradeRequest || update2TradeRequest.nModified !== 2) {
          response.message = 'Không thể cập nhật trạng thái giao dịch, vui lòng thử lại sau';
          return response;
        }
        // +filledAmount trong ads
        await AdsModel.updateOne(
          { id: sellerTradeRequestInfo.adsId },
          {
            $inc: {
              filledAmount: sellerTradeRequestInfo.amount
            }
          });
        // update GD commision của A0 thành công
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        const commissionA0 = await CommisionModel.findOne({
          accountId: systemAccountId,
          transaction: sellerTradeRequestInfo.transaction,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE
        }).lean();
        if (!commissionA0) {
          console.log('Không tìm thấy giao dịch commision =======>>>> FIND BY', JSON.stringify({
            accountId: systemAccountId,
            transaction: sellerTradeRequestInfo.transaction,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE
          }));
          response.message = 'Không tìm thấy giao dịch commision';
          return response;
        }
        await CommisionModel.updateOne(
          { id: commissionA0.id },
          { status: TradeConstant.COMMISION_STATUS.SUCCEEDED }
        );
        // +V  cho người mua
        const userBalanceCreate = await UserBalanceService.addBalance(
          buyerTradeRequestInfo.accountId,
          buyerTradeRequestInfo.amount,
          `Mua V #${buyerTradeRequestInfo.transaction}`,
          buyerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (userBalanceCreate.code !== 1) {
          //TODO
          response.message = 'Không thể cộng V cho người mua! Vui lòng thử lại';
          return response;
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
          response.message = 'Không thể cộng V cho user cấp 0!';
          return response;
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
            amount: buyerTradeRequestInfo.amount,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.COMMISION,
          `Nhận commision từ giao dịch mua #${buyerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('Level 3 Xác nhận đã nhận tiền--------->chia commision cho user C1 và C2 Errorrrrrr!', JSON.stringify(commisionData));
          throw Error(commisionData.message);

        }
        console.log('sellerTradeRequestInfo Xác nhận đã nhận tiền =>>>>', JSON.stringify(sellerTradeRequestInfo));
      } else if (sellerTradeRequestInfo.amount < actuallySellV) { // số tiền nhận lớn hơn số tiền muốn bán
        // - V chênh lệch trong quảng cáo BUY
        const adsBuy = await AdsModel.findOne({
          id: sellerTradeRequestInfo.adsId,
          type: TradeConstant.TRADE_TYPE.BUY
        }).lean();
        if (!adsBuy) {
          response.message = 'Không tìm thấy giao dịch quảng cáo đang hoạt động';
          return response;
        }
        const availableV = _.toNumber(new Decimal(buyerTradeRequestInfo.amount).add(adsBuy.amount));
        // tổng V trong ads ko đủ
        if (availableV < actuallyReceivedV) {
          console.log('Số lượng giao dịch không cho phép', JSON.stringify(buyerTradeRequestInfo.amount, adsBuy.amount, actuallyReceivedV));
          response.message = 'Số lượng giao dịch không cho phép';
          return response;
        }

        const minusV = _.toNumber(new Decimal(actuallySellV).minus(sellerTradeRequestInfo.amount));
        let commissionPercent = await SettingModel.findOne({ key: 'COMMISION_PERCENT' }).lean();
        commissionPercent = _.get(commissionPercent, 'value', null) !== null ? commissionPercent.value : GeneralConstant.COMMISION_PERCENT;
        let minuscommissionV = _.toNumber(new Decimal(minusV).mul(commissionPercent).div(100));
        minuscommissionV = Math.ceil(minuscommissionV);

        // -V thêm của seller
        const userBalanceCreate = await UserBalanceService.minusBalance(
          sellerAccountInfo.id,
          minusV,
          `Tạo giao dịch bán #${sellerTradeRequestInfo.transaction} do chênh lệch vnđ đã nhận`,
          sellerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (userBalanceCreate.code !== 1) {
          response.message = 'Có lỗi trừ balance của seller, vui lòng kiểm tra lại';
          return response;
        }
        // trừ thêm fee GD lệch
        // -3V cua seller
        const userBalanceCommisionCreate = await UserBalanceService.minusBalance(
          sellerAccountInfo.id,
          minuscommissionV,
          `Phí thanh toán cho giao dịch #${sellerTradeRequestInfo.transaction} do chênh lệch vnđ đã nhận`,
          sellerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE_FEE
        );
        if (userBalanceCommisionCreate.code !== 1) {
          response.message = 'Có lỗi trừ fee giao dịch của seller, vui lòng kiểm tra lại';
          return response;
        }

        // -V chênh lệch trong Ads BUY
        const subtractV = _.toNumber(new Decimal(availableV).minus(actuallyReceivedV));
        const updateAds = await AdsModel.updateOne(
          { id: adsBuy.id },
          {
            $set: {
              amount: subtractV
            },
            $inc: {
              filledAmount: actuallySellV
            }
          }
        );
        // // update amount lại cho người bán và người mua
        const updatedTradeAmount = await TradeRequestModel.updateMany(
          {
            id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
          },
          {
            $set: {
              status: TradeConstant.TRADE_STATUS.SUCCEEDED,
              filledAmount: actuallySellV,
              filledValue: payload.amount
            },
            $push: { changedStatus: changedStatus }
          },
          { multi: true });
        if (!updatedTradeAmount || updatedTradeAmount.nModified !== 2) {
          response.message = 'Có lỗi update khối lượng giao dịch, vui lòng kiểm tra lại';
          return response;
        }
        await AdsModel.updateOne(
          { id: sellerTradeRequestInfo.adsId },
          {
            $inc: {
              filledAmount: actuallySellV,
              filledValue: payload.amount
            }
          });
        // tính lại giá trị commision cho A0
        const commissionV = _.toNumber(new Decimal(actuallySellV).mul(commissionPercent).div(100));

        // update GD commision của A0 thành công
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        let commissionA0 = await CommisionModel.findOne({
          accountId: systemAccountId,
          transaction: sellerTradeRequestInfo.transaction,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE
        }).lean();
        if (!commissionA0) {
          console.log('Không tìm thấy giao dịch commision =======>>>> FIND BY', JSON.stringify({
            accountId: systemAccountId,
            transaction: sellerTradeRequestInfo.transaction,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE
          }));
          response.message = 'Không tìm thấy giao dịch commision';
          return response;
        }
        commissionA0 = await CommisionModel.findOneAndUpdate(
          { id: commissionA0.id },
          {
            status: TradeConstant.COMMISION_STATUS.SUCCEEDED,
            amount: commissionV
          },
          { new: true }
        );
        // +V  cho người mua
        const buyerBalanceCreate = await UserBalanceService.addBalance(
          buyerTradeRequestInfo.accountId,
          actuallySellV,
          `Mua V #${buyerTradeRequestInfo.transaction}`,
          buyerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (buyerBalanceCreate.code !== 1) {
          //TODO
          response.message = 'Không thể cộng V cho người mua! Vui lòng thử lại';
          return response;
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
          response.message = 'Không thể cộng V cho user cấp 0!';
          return response;
        }

        // -V của A0 để chia cho A1 và A2
        const minusCommisionA0Data = await ExternalService.minusCommissionSystemUser(
          {
            amount: actuallySellV,
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
            amount: actuallySellV,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.COMMISION,
          `Nhận commision từ giao dịch mua #${buyerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('Level 3 Xác nhận đã nhận tiền--------->chia commision cho user C1 và C2 Errorrrrrr!', JSON.stringify(commisionData));
          throw Error(commisionData.message);
        }
        console.log('sellerTradeRequestInfo Xác nhận đã nhận tiền ===> amount bán < actuallySellV  =>>>>', JSON.stringify(sellerTradeRequestInfo));
      } else { // số tiền nhận nhỏ hơn số tiền muốn bán
        const adsBuy = await AdsModel.findOne({
          id: sellerTradeRequestInfo.adsId,
          type: TradeConstant.TRADE_TYPE.BUY
        }).lean();
        if (!adsBuy) {
          response.message = 'Không tìm thấy giao dịch quảng cáo đang hoạt động';
          return response;
        }

        // // update amount,lại cho người bán và người mua
        const updatedTradeAmount = await TradeRequestModel.updateMany(
          {
            id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
          },
          {
            $set: {
              status: TradeConstant.TRADE_STATUS.SUCCEEDED,
              filledAmount: actuallySellV,
              filledValue: payload.amount
            },
            $push: { changedStatus: changedStatus }
          },
          { multi: true });
        if (!updatedTradeAmount || updatedTradeAmount.nModified !== 2) {
          response.message = 'Có lỗi update khối lượng giao dịch, vui lòng kiểm tra lại';
          return response;
        }
        await AdsModel.updateOne(
          { id: sellerTradeRequestInfo.adsId },
          {
            $inc: {
              filledAmount: actuallySellV,
              filledValue: payload.amount
            }
          });
        // update lại fee của seller
        // tính lại giá trị commision
        let commissionPercent = await SettingModel.findOne({ key: 'COMMISION_PERCENT' }).lean();
        commissionPercent = _.get(commissionPercent, 'value', null) !== null ? commissionPercent.value : GeneralConstant.COMMISION_PERCENT;
        let commissionV = _.toNumber(new Decimal(actuallySellV).mul(commissionPercent).div(100));
        commissionV = Math.ceil(commissionV);

        // let sellRate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
        // sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;
        // const valueVND = _.toNumber((actuallySellV * sellRate));

        // let feePercent = await SettingModel.findOne({ key: 'FEE_PERCENT' }).lean();
        // feePercent = _.get(feePercent, 'value', null) !== null ? feePercent.value : 1;
        // const feeV = commissionV;
        // const feeVND = _.toNumber((feeV * feePercent));
        // const totalAmount = _.toNumber(new Decimal(payload.amount).add(feeV));
        // const totalVND = _.toNumber(new Decimal(valueVND).add(feeVND));

        // const updatedTradeSell = await TradeRequestModel.updateOne(
        //   {
        //     id: sellerTradeRequestInfo.id
        //   },
        //   {
        //     $set: {
        //       feeAmount: feeV,
        //       fee: feeVND
        //     }
        //   },
        //   { multi: true });
        // if (!updatedTradeAmount || updatedTradeAmount.nModified !== 2) {
        //   throw { message: 'Có lỗi update khối lượng giao dịch, vui lòng kiểm tra lại' };
        // }

        // update GD commision của A0 thành công
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        let commissionA0 = await CommisionModel.findOne({
          accountId: systemAccountId,
          transaction: sellerTradeRequestInfo.transaction,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE
        }).lean();
        if (!commissionA0) {
          console.log('Không tìm thấy giao dịch commision =======>>>> FIND BY', JSON.stringify({
            accountId: systemAccountId,
            transaction: sellerTradeRequestInfo.transaction,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE
          }));
          response.message = 'Không tìm thấy giao dịch commision';
          return response;
        }
        commissionA0 = await CommisionModel.findOneAndUpdate(
          { id: commissionA0.id },
          {
            status: TradeConstant.COMMISION_STATUS.SUCCEEDED,
            amount: commissionV
          },
          { new: true }
        );
        // +V cho người mua
        const userBalanceCreate = await UserBalanceService.addBalance(
          buyerTradeRequestInfo.accountId,
          actuallySellV,
          `Mua V #${buyerTradeRequestInfo.transaction}`,
          buyerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (userBalanceCreate.code !== 1) {
          //TODO
          response.message = 'Không thể cộng V cho người mua! Vui lòng thử lại';
          return response;
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

          response.message = 'Không thể cộng V cho user cấp 0!';
          return response;
        }
        // trả V lại cho seller
        // trả V chenh lech lại cho seller A3
        // tìm accountId seller
        const cashbackV = _.toNumber(new Decimal(sellerTradeRequestInfo.amount).minus(actuallySellV));

        const userBalanceAfterCashBack = await UserBalanceService.addBalance(
          sellerTradeRequestInfo.accountId,
          cashbackV,
          `Nhận V từ chênh lệch GD bán #${sellerTradeRequestInfo.transaction}`,
          sellerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.REFUND_DIFF_TRADE
        );
        if (userBalanceAfterCashBack.code !== 1) {
          // TODO
          // await TradeRequestModel.updateOne(
          //   { id: buyerTradeRequestInfo.id },
          //   {
          //     status: TradeConstant.TRADE_STATUS.FAILED
          //   }
          // );
          response.message = 'Tạo giao dịch commision thất bại!!';
          return response;
        }
        // trả V Fee chênh lệch
        const minusV = _.toNumber(new Decimal(sellerTradeRequestInfo.amount).minus(actuallySellV));
        const cashbackCommissionV = _.toNumber(new Decimal(minusV).mul(commissionPercent).div(100));
        const userBalanceAfterCashBackCommission = await UserBalanceService.addBalance(
          sellerTradeRequestInfo.accountId,
          cashbackCommissionV,
          `Nhận fee V từ chênh lệch GD bán #${sellerTradeRequestInfo.transaction}`,
          sellerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.REFUND_DIFF_TRADE
        );
        if (userBalanceAfterCashBackCommission.code !== 1) {
          // TODO
          // await TradeRequestModel.updateOne(
          //   { id: buyerTradeRequestInfo.id },
          //   {
          //     status: TradeConstant.TRADE_STATUS.FAILED
          //   }
          // );
          response.message = 'Tạo giao dịch commision thất bại!!';
          return response;
        }

        // trả V chênh lệch lại cho Ads của Buyer
        const updateAds = await AdsModel.updateOne(
          { id: buyerTradeRequestInfo.adsId },
          {
            $inc: {
              amount: cashbackV,
              filledAmount: actuallySellV
            }
          }
        );
        // -V của A0 để chia cho A1 và A2
        const minusCommisionA0Data = await ExternalService.minusCommissionSystemUser(
          {
            amount: actuallySellV,
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
            amount: actuallySellV,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.COMMISION,
          `Nhận commision từ giao dịch mua #${buyerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('Level 3 Xác nhận đã nhận tiền--------->chia commision cho user C1 và C2 Errorrrrrr!', JSON.stringify(commisionData));
          throw Error(commisionData.message);

        }
        console.log('sellerTradeRequestInfo Xác nhận đã nhận tiền ===> amount bán < actuallySellV  =>>>>', JSON.stringify(sellerTradeRequestInfo));
      }
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
      response.code = 1;
      response.message = 'Xác nhận thành công';
      return response;

    }
    else {
      if (sellerTradeRequestInfo.type === TradeConstant.TRADE_TYPE.BUY) {
        console.log(' lệnh mua của mình');
        //  lệnh mua  do mình tạo
        // tim GD nguoi bán
        const buyerTradeRequestInfo = await TradeRequestModel.findOne({
          transaction: payload.transaction,
          type: TradeConstant.TRADE_TYPE.BUY,
          status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
        }).lean();
        if (!buyerTradeRequestInfo) {
          response.message = 'Không tìm thấy giao dịch mua';
          return response;
        }
        const buyerInfo = await AccountModel.findOne({ id: buyerTradeRequestInfo.accountId }).lean();

        let sellRate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
        sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;
        const actuallySellV = _.toNumber(new Decimal(payload.amount).mul(sellRate));
        // kiểm tra amountVND đã gửi có = với amount của GD hay ko
        if (sellerTradeRequestInfo.amount === actuallySellV) {
          // cap nhật trạng thái thanh công cho GD của người bán và cả người mua
          const updated = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: sellerTradeRequestInfo.amount,
                filledValue: sellerTradeRequestInfo.value
              },
              $push: { changedStatus: changedStatus }
            },
            { multi: true });
          if (!updated || updated.nModified !== 2) {
            response.message = 'Có lỗi update giao dịch, vui lòng kiểm tra lại';
            return response;
          }
          // +filledAmount trong ads
          await AdsModel.updateOne(
            { id: sellerTradeRequestInfo.adsId },
            {
              $inc: {
                filledAmount: sellerTradeRequestInfo.amount,
                filledValue: sellerTradeRequestInfo.value
              }
            });
          // +V cho người mua
          const buyerBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            buyerTradeRequestInfo.amount,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (buyerBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }

          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch MUA <br>
        Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(buyerTradeRequestInfo.amount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
            'Quý khách đã được xác nhận giao dịch MUA',
            'send-notification');
          response.code = 1;
          response.message = 'Xác nhận thành công';
          return response;

        } else if (sellerTradeRequestInfo.amount < actuallySellV) {
          // số muốn mua lớn hơn số thực chuyển
          // // update amount lại cho người bán và người mua
          const updatedTradeAmount = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: actuallySellV,
                filledValue: actuallySellV
              },
              $push: { changedStatus: changedStatus }
            },
            { multi: true });
          if (!updatedTradeAmount || updatedTradeAmount.nModified !== 2) {
            response.message = 'Có lỗi update khối lượng giao dịch, vui lòng kiểm tra lại';
            return response;
          }

          // +V cho người mua
          const buyerBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            actuallySellV,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (buyerBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }

          // trả V chenh lech lại cho seller A3
          // tìm accountId seller
          const cashbackV = _.toNumber(new Decimal(sellerTradeRequestInfo.amount).minus(actuallySellV));

          const userBalanceAfterCashBack = await UserBalanceService.addBalance(
            sellerTradeRequestInfo.accountId,
            cashbackV,
            `Nhận V từ chênh lệch GD bán #${sellerTradeRequestInfo.transaction}`,
            sellerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.REFUND_DIFF_TRADE
          );
          if (userBalanceAfterCashBack.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Tạo giao dịch commision thất bại!!';
            return response;
          }
          // trả V chênh lệch lại cho Ads của Buyer
          const updateAds = await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $inc: {
                amount: cashbackV,
                filledAmount: actuallySellV,
                filledValue: payload.amount
              }
            }
          );

          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch MUA <br>
        Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(actuallySellV).format('0,0')} </b> <br>
       Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
            'Quý khách đã được xác nhận giao dịch MUA',
            'send-notification');
          response.code = 1;
          response.message = 'Thành công';
          return response;

        } else {
          // số muốn mua nhỏ hơn số thực chuyển
          const adsInfo = await AdsModel.findOne({
            id: buyerTradeRequestInfo.adsId,
            status: TradeConstant.ADS_STATUS.ACTIVE
          }).lean();
          if (!adsInfo) {
            response.message = 'Không tìm thấy giao dịch quảng cáo đang hoạt động';
            return response;
          }
          const availableV = _.toNumber(new Decimal(buyerTradeRequestInfo.amount).add(adsInfo.amount));
          // tổng V trong ads ko đủ
          if (availableV < actuallyReceivedV) {
            console.log('Khối lượng giao dịch không cho phép', JSON.stringify(buyerTradeRequestInfo.amount, adsInfo.amount, actuallyReceivedV));
            response.message = 'Khối lượng giao dịch không cho phép';
            return response;
          }
          // -V chênh lệch trong Ads của Buyer
          const subtractV = _.toNumber(new Decimal(availableV).minus(actuallyReceivedV));
          const updateAds = await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $set: {
                amount: subtractV
              },
              $inc: {
                filledAmount: actuallySellV,
                filledValue: payload.amount
              }
            }
          );
          // // update amount lại cho người bán và người mua
          const updatedTradeAmount = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: actuallySellV,
                filledValue: payload.amount
              },
              $push: { changedStatus: changedStatus }
            },
            { multi: true });
          if (!updatedTradeAmount || updatedTradeAmount.nModified !== 2) {
            response.message = 'Có lỗi update khối lượng giao dịch, vui lòng kiểm tra lại';
            return response;
          }

          // +V cho người mua
          const buyerBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            actuallySellV,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (buyerBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }

          // trả V chenh lech lại cho seller A3
          // tìm accountId seller
          const cashbackV = _.toNumber(new Decimal(sellerTradeRequestInfo.amount).minus(actuallySellV));

          const userBalanceAfterCashBack = await UserBalanceService.addBalance(
            sellerTradeRequestInfo.accountId,
            cashbackV,
            `Nhận V từ chênh lệch GD bán #${sellerTradeRequestInfo.transaction}`,
            sellerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.REFUND_DIFF_TRADE
          );
          if (userBalanceAfterCashBack.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Tạo giao dịch commision thất bại!!';
            return response;
          }


          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch BÁN <br>
        Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(actuallySellV).format('0,0')} </b> <br>
       Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
            'Quý khách đã được xác nhận giao dịch BUY',
            'send-notification');
          response.code = 1;
          response.message = 'Xác nhận thành công';
          return response;
        }
      } else {
        // lệnh sell do mình tạo => mình xác nhận đã nhân tiền => chuyển V cho người mua
        let buyerTradeRequestInfo = await TradeRequestModel.findOne({
          transaction: payload.transaction,
          type: TradeConstant.TRADE_TYPE.BUY,
          status: { $ne: TradeConstant.TRADE_STATUS.REFUSED },
          account: { $ne: sellerAccountInfo.id }
        }).lean();
        if (!buyerTradeRequestInfo) {
          response.message = 'Không tìm thấy thông tin giao dịch của người mua';
          return response;
        }
        const buyerInfo = await AccountModel.findOne({ id: buyerTradeRequestInfo.accountId }).lean();

        console.log('buyerTradeRequestInfo.amount vs actuallyReceivedV', buyerTradeRequestInfo.amount, actuallyReceivedV);
        if (buyerTradeRequestInfo.amount === actuallyReceivedV) {
          // cap nhật trạng thái thanh công cho GD của người bán và cả người mua
          const updated = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: buyerTradeRequestInfo.amount,
                filledValue: payload.amount
              },
              $push: { changedStatus: changedStatus }
            },
            { multi: true });
          if (!updated || updated.nModified !== 2) {
            response.message = 'Có lỗi update giao dịch, vui lòng kiểm tra lại';
            return response;
          }
          await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $inc: {
                filledAmount: buyerTradeRequestInfo.amount,
                filledValue: payload.amount
              }
            });
          // cong cho nguoi mua
          const userBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            buyerTradeRequestInfo.amount,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (userBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }
          //  kiem tra GD của user Partner mới bị +- commision
          if (buyerTradeRequestInfo.partnerTransaction) {
            // trừ V của A0
            const minusCommisionData = await ExternalService.minusCommissionSystemUser(
              {
                amount: buyerTradeRequestInfo.amount,
                transaction: payload.transaction
              },
              buyerTradeRequestInfo,
              `Chia bonus cho user từ GD mua #${buyerTradeRequestInfo.transaction}`
            );
            if (minusCommisionData.code !== 1) {
              console.log('--------->Trừ commision A0 Error!', JSON.stringify(minusCommisionData));
              // throw Error(minusCommisionData.message);
            }
            //chia commision cho user C1 và C2 (tính userBalance cho A1 và A2 + add Commision model)
            const commisionData = await ExternalService.addCommissionUser(
              {
                amount: sellerTradeRequestInfo.amount,
                transaction: sellerTradeRequestInfo.transaction
              },
              sellerTradeRequestInfo,
              GeneralConstant.COMMISION_TYPE.BONUS,
              `Nhận bonus từ giao dịch mua #${sellerTradeRequestInfo.transaction}`
            );
            if (commisionData.code !== 1) {
              console.log('--------->chia commision cho user C1 và C2 Error!', JSON.stringify(commisionData));
              throw Error(commisionData.message);

            }
          }
          // IPN nếu có
          if (buyerTradeRequestInfo.ipnUrl) {
            buyerTradeRequestInfo = await TradeRequestModel.findOne({
              transaction: payload.transaction,
              type: TradeConstant.TRADE_TYPE.BUY,
              status: { $ne: TradeConstant.TRADE_STATUS.REFUSED },
              account: { $ne: sellerAccountInfo.id }
            }).lean();
            const body = {
              transaction: buyerTradeRequestInfo.transaction,
              partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
              amountInfo: {
                amount: buyerTradeRequestInfo.amount,
                fee: buyerTradeRequestInfo.feeAmount,
                total: buyerTradeRequestInfo.totalAmount
              },
              valueInfo: {
                value: buyerTradeRequestInfo.value,
                fee: buyerTradeRequestInfo.fee,
                total: buyerTradeRequestInfo.totalValue
              },
              status: TradeConstant.TRADE_STATUS.SUCCEEDED
            };
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $inc: {
                  'sentIpn.count': 1 // tăng số lần gọi
                }
              });

            const logRequest = await RequestService.requestPost(buyerTradeRequestInfo.ipnUrl, null, body, {});
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $set: {
                  'sentIpn.isSentIPN': true // ipn thành công
                }
              });
            console.log('1----/v1/trade-request/confirm_received_vnd login buyerTradeRequestInfo.ipnUrl response from ', buyerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
          }

          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch MUA <br>
        Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
        Lượng giao diịch: ${numeral(buyerTradeRequestInfo.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a> `,
            'Quý khách đã được xác nhận giao dịch MUA',
            'send-notification');
          response.code = 1;
          response.message = 'Xác nhận thành công';
          return response;

        }
        else if (buyerTradeRequestInfo.amount > actuallyReceivedV) {
          console.log('buyerTradeRequestInfo.amount > actuallyReceivedV', buyerTradeRequestInfo.amount, actuallyReceivedV);
          // số V mua lớn hơn thực nhận => trả lại cho ADS
          // số tiền chuyển nhỏ hơn V yêu cầu => tinh lại sô V
          // tính lại V trade cho user bán và mua
          // update cho người bán và người mua
          const updatedTradeAmount = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: actuallyReceivedV,
                filledValue: payload.amount
              },
              $push: { changedStatus: changedStatus }
            },
            { multi: true });
          if (!updatedTradeAmount || updatedTradeAmount.nModified !== 2) {
            response.message = 'Có lỗi update khối lượng giao dịch, vui lòng kiểm tra lại';
            return response;
          }
          await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $inc: {
                filledAmount: actuallyReceivedV,
                filledValue: payload.amount
              }
            });
          // chỉ có GD của partner mới có commision
          if (buyerTradeRequestInfo.partnerTransaction) {
            // trừ V của A0
            const minusCommisionData = await ExternalService.minusCommissionSystemUser(
              {
                amount: actuallyReceivedV,
                transaction: buyerTradeRequestInfo.transaction
              },
              buyerTradeRequestInfo,
              `Chia bonus cho user từ GD mua #${buyerTradeRequestInfo.transaction}`);
            if (minusCommisionData.code !== 1) {
              response.message = minusCommisionData.message;
              return response;
            }
            //chia commision cho user C1 và C2 (tính userBalance cho A1 và A2 + add Commision model)
            const commisionData = await ExternalService.addCommissionUser(
              {
                amount: actuallyReceivedV,
                transaction: sellerTradeRequestInfo.transaction
              },
              sellerTradeRequestInfo,
              GeneralConstant.COMMISION_TYPE.BONUS,
              `Nhận bonus từ giao dịch mua #${sellerTradeRequestInfo.transaction}`
            );
            if (commisionData.code !== 1) {

              throw Error(commisionData.message);
            }
          }
          const cashbackV = _.toNumber(new Decimal(buyerTradeRequestInfo.amount).minus(actuallyReceivedV));
          // chuyên chenh lẹch lại cho seller  trừ lúc tạo
          await UserBalanceService.addBalance(
            sellerTradeRequestInfo.accountId,
            cashbackV,
            `Nhận lại V chênh lệch từ GD bán #${sellerTradeRequestInfo.transaction}`,
            sellerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          // chuyển V cho buyer
          const userBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            actuallyReceivedV,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (userBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }
          // cộng thêm V chênh lệch vào Ads bán
          const updateAds = await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $inc: {
                amount: cashbackV
              }
            }
          );
          if (buyerTradeRequestInfo.ipnUrl) {
            buyerTradeRequestInfo = await TradeRequestModel.findOne({
              transaction: payload.transaction,
              type: TradeConstant.TRADE_TYPE.BUY,
              status: { $ne: TradeConstant.TRADE_STATUS.REFUSED },
              account: { $ne: sellerAccountInfo.id }
            }).lean();
            const body = {
              transaction: buyerTradeRequestInfo.transaction,
              partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
              amountInfo: {
                amount: buyerTradeRequestInfo.amount,
                fee: buyerTradeRequestInfo.feeAmount,
                total: buyerTradeRequestInfo.totalAmount
              },
              valueInfo: {
                value: buyerTradeRequestInfo.value,
                fee: buyerTradeRequestInfo.fee,
                total: buyerTradeRequestInfo.totalValue
              },
              status: TradeConstant.TRADE_STATUS.SUCCEEDED
            };
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $inc: {
                  'sentIpn.count': 1 // tăng số lần gọi
                }
              });

            const logRequest = await RequestService.requestPost(buyerTradeRequestInfo.ipnUrl, null, body, {});
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $set: {
                  'sentIpn.isSentIPN': true // ipn thành công
                }
              });
            console.log('2----/v1/trade-request/confirm_received_vnd login buyerTradeRequestInfo.ipnUrl response from ', buyerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
          }

          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch MUA <br>
        Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(actuallyReceivedV).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
            'Quý khách đã được xác nhận giao dịch MUA',
            'send-notification');
          response.code = 1;
          response.message = 'Xác nhận thành công';
          return response;

        } else {
          // số V mua nhỏ hơn thực nhận => thêm V vào lệnh mua nếu Ads còn đủ V
          const adsInfo = await AdsModel.findOne({
            id: buyerTradeRequestInfo.adsId,
            status: TradeConstant.ADS_STATUS.ACTIVE
          }).lean();
          if (!adsInfo) {
            response.message = 'Không tìm thấy giao dịch quảng cáo đang hoạt động!';
            return response;
          }
          const availableV = _.toNumber(new Decimal(buyerTradeRequestInfo.amount).add(adsInfo.amount));
          // tổng V trong ads bán ko đủ
          console.log('Số V giao dịch không cho phép', JSON.stringify({ 'buyerTradeRequestInfo': buyerTradeRequestInfo.amount, 'adsInfo.amount': adsInfo.amount, actuallyReceivedV }));
          if (availableV < actuallyReceivedV) {
            response.message = 'Số V giao dịch không cho phép';
            return response;
          }
          // -V chênh lệch trong Ads bán
          const subtractV = _.toNumber(new Decimal(availableV).minus(actuallyReceivedV));
          const updateAds = await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $set: {
                amount: subtractV
              }
            }
          );
          const updatedTradeAmount = await TradeRequestModel.updateMany(
            {
              id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
            },
            {
              $set: {
                status: TradeConstant.TRADE_STATUS.SUCCEEDED,
                'paymentInfo.content': payload.content,
                filledAmount: actuallyReceivedV,
                filledValue: payload.amount
              },
              $push: { changedStatus: changedStatus }
            },
            { multi: true });
          if (!updatedTradeAmount || updatedTradeAmount.nModified !== 2) {
            response.message = 'Có lỗi update khối lượng giao dịch, vui lòng kiểm tra lại';
            return response;
          }
          await AdsModel.updateOne(
            { id: buyerTradeRequestInfo.adsId },
            {
              $inc: {
                filledAmount: actuallyReceivedV,
                filledValue: payload.amount
              }
            });

          // chỉ có GD của partner mới có commision
          if (buyerTradeRequestInfo.partnerTransaction) {
            // trừ V của A0
            const minusCommisionData = await ExternalService.minusCommissionSystemUser(
              {
                amount: actuallyReceivedV,
                transaction: buyerTradeRequestInfo.transaction
              },
              buyerTradeRequestInfo,
              `Chia bonus cho user từ GD mua #${buyerTradeRequestInfo.transaction}`
            );
            if (minusCommisionData.code !== 1) {
              response.message = minusCommisionData.message;
              return response;
            }
            //chia commision cho user C1 và C2 (tính userBalance cho A1 và A2 + add Commision model)
            const commisionData = await ExternalService.addCommissionUser(
              {
                amount: actuallyReceivedV,
                transaction: sellerTradeRequestInfo.transaction
              },
              sellerTradeRequestInfo,
              GeneralConstant.COMMISION_TYPE.BONUS,
              `Nhận bonus từ giao dịch mua #${sellerTradeRequestInfo.transaction}`
            );
            if (commisionData.code !== 1) {
              throw Error(commisionData.message);
            }
          }
          // chuyển V cho buyer
          const userBalanceCreate = await UserBalanceService.addBalance(
            buyerTradeRequestInfo.accountId,
            actuallyReceivedV,
            `Mua V #${buyerTradeRequestInfo.transaction}`,
            buyerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE
          );
          if (userBalanceCreate.code !== 1) {
            // TODO
            // await TradeRequestModel.updateOne(
            //   { id: buyerTradeRequestInfo.id },
            //   {
            //     status: TradeConstant.TRADE_STATUS.FAILED
            //   }
            // );
            response.message = 'Xác nhận thất bại';
            return response;
          }
          if (buyerTradeRequestInfo.ipnUrl) {
            buyerTradeRequestInfo = await TradeRequestModel.findOne({
              transaction: payload.transaction,
              type: TradeConstant.TRADE_TYPE.BUY,
              status: { $ne: TradeConstant.TRADE_STATUS.REFUSED },
              account: { $ne: sellerAccountInfo.id }
            }).lean();
            const body = {
              transaction: buyerTradeRequestInfo.transaction,
              partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
              amountInfo: {
                amount: buyerTradeRequestInfo.amount,
                fee: buyerTradeRequestInfo.feeAmount,
                total: buyerTradeRequestInfo.totalAmount
              },
              valueInfo: {
                value: buyerTradeRequestInfo.value,
                fee: buyerTradeRequestInfo.fee,
                total: buyerTradeRequestInfo.totalValue
              },
              status: TradeConstant.TRADE_STATUS.SUCCEEDED
            };
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $inc: {
                  'sentIpn.count': 1 // tăng số lần gọi
                }
              });

            const logRequest = await RequestService.requestPost(buyerTradeRequestInfo.ipnUrl, null, body, {});
            await TradeRequestModel.updateOne(
              { id: buyerTradeRequestInfo.id },
              {
                $set: {
                  'sentIpn.isSentIPN': true // ipn thành công
                }
              });
            console.log('3----/v1/trade-request/confirm_received_vnd login buyerTradeRequestInfo.ipnUrl response from ', buyerTradeRequestInfo.ipnUrl, JSON.stringify({ body, logRequest }));
          }

          SendEmailWorker.pushSendEmail(
            buyerInfo.email,
            `Đã xác nhận giao dịch MUA <br>
        Mã giao dịch: <b>#${buyerTradeRequestInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(actuallyReceivedV).format('0,0')} </b> <br>
        Xem chi tiết <a href="${SocialConfig.environment.web}/home/trade/${buyerTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
            'Quý khách đã được xác nhận giao dịch MUA',
            'send-notification');
          response.code = 1;
          response.message = 'Xác nhận thành công';
          return response;
        }
      }
    }
  },

  /**
   * Cập nhật thành công cho các GD PENDING, PAID, WARNING
   * @param {*} tradeRequestInfo thông tin GD trade
   * @param {*} acctionAccountId accountID thực hiện
   * @param {*} note
   */
  async updateTradeRequestToSuccess(tradeRequestInfo, acctionAccountId, note) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    if (!_.includes([TradeConstant.TRADE_STATUS.PENDING, TradeConstant.TRADE_STATUS.PAID, TradeConstant.TRADE_STATUS.WARNING], tradeRequestInfo.status)) {
      response.message = 'Trạng thái giao dịch không hợp lệ';
      return response;
    }
    // tìm buyer
    const buyerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: tradeRequestInfo.transaction,
      type: TradeConstant.TRADE_TYPE.BUY,
      status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
    });

    const sellerTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: tradeRequestInfo.transaction,
      type: TradeConstant.TRADE_TYPE.SELL
    });
    // thành công sẽ +V cho buyer
    const updated = await TradeRequestModel.updateMany(
      {
        id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
      },
      {
        $set: {
          status: TradeConstant.TRADE_STATUS.SUCCEEDED,
          filledAmount: tradeRequestInfo.amount,
          filledValue: tradeRequestInfo.value
        },
        $push: {
          changedStatus: {
            from: tradeRequestInfo.status,
            to: TradeConstant.TRADE_STATUS.SUCCEEDED,
            reason: note,
            accountAction: acctionAccountId,
            updatedAt: new Date()
          }
        }
      },
      { multi: true });
    if (!updated || updated.nModified !== 2) {
      response.message = 'Có lỗi update giao dịch, vui lòng kiểm tra lại!!!';
      return response;
    }
    // +filledAmount trong ads
    await AdsModel.updateOne(
      { id: tradeRequestInfo.adsId },
      {
        $inc: {
          filledAmount: tradeRequestInfo.amount,
          filledValue: tradeRequestInfo.value
        }
      });
    // +V cho người mua

    const buyerBalanceCreate = await UserBalanceService.addBalance(
      buyerTradeRequestInfo.accountId,
      buyerTradeRequestInfo.amount,
      `Mua V #${buyerTradeRequestInfo.transaction}`,
      buyerTradeRequestInfo,
      GeneralConstant.SOURCE_NAME.TRADE
    );
    // ads SELL => trade BUY =>  chia commision của C0 cho user C1 và C2
    const adsInfo = await AdsModel.findOne({ id: tradeRequestInfo.adsId }).lean();
    if (adsInfo.type === TradeConstant.ADS_TYPE.SELL) {
      // tính commision nếu có
      if (buyerTradeRequestInfo.partnerTransaction) {
        // trừ V của A0
        const minusCommisionData = await ExternalService.minusCommissionSystemUser(
          {
            amount: buyerTradeRequestInfo.amount,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          `Chia bonus cho user từ GD mua #${buyerTradeRequestInfo.transaction}`
        );
        if (minusCommisionData.code !== 1) {
          console.log('--------->Trừ commision A0 Error!', JSON.stringify(minusCommisionData));
          response.message = minusCommisionData.message;
          return response;
        }

        //chia commision cho user C1 và C2 (tính userBalance cho A1 và A2 + add Commision model)
        const commisionData = await ExternalService.addCommissionUser(
          {
            amount: sellerTradeRequestInfo.amount,
            transaction: sellerTradeRequestInfo.transaction
          },
          sellerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.BONUS,
          `Nhận bonus từ giao dịch mua #${sellerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('--------->chia commision cho user C1 và C2 Error!', JSON.stringify(commisionData));
          throw Error(commisionData.message);

        }
        if (buyerTradeRequestInfo.ipnUrl) {
          const urlRequest = buyerTradeRequestInfo.ipnUrl;
          const body = {
            transaction: buyerTradeRequestInfo.transaction,
            partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
            amountInfo: {
              amount: buyerTradeRequestInfo.amount,
              fee: buyerTradeRequestInfo.feeAmount,
              total: buyerTradeRequestInfo.totalAmount
            },
            valueInfo: {
              value: buyerTradeRequestInfo.value,
              fee: buyerTradeRequestInfo.fee,
              total: buyerTradeRequestInfo.totalValue
            },
            status: TradeConstant.TRADE_STATUS.SUCCEEDED
          };
          await TradeRequestModel.updateOne(
            { id: buyerTradeRequestInfo.id },
            {
              $inc: {
                'sentIpn.count': 1 // tăng số lần gọi
              }
            });

          const logRequest = await RequestService.requestPost(urlRequest, null, body, {});
          await TradeRequestModel.updateOne(
            { id: buyerTradeRequestInfo.id },
            {
              $set: {
                'sentIpn.isSentIPN': true // ipn thành công
              }
            });
          console.log('1----/v1/trade-request/ admin xác nhận GD thành công, response from ', urlRequest, JSON.stringify({ body, logRequest }));
        }
      }
      response.code = 1;
      response.message = 'Cập nhật thành công';
      return response;
    } else {
      // ads BUY => trade SELL => chia commision từ fee của lệnh SELL cho C1 và C2
      if (sellerTradeRequestInfo.partnerTransaction) {
        //// update commision A3 đã chuyển cho A0 nếu có}
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        const commissionA0 = await CommisionModel.findOne({
          accountId: systemAccountId,
          transaction: sellerTradeRequestInfo.transaction,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE
        }).lean();
        if (!commissionA0) {
          console.log('Không tìm thấy giao dịch commision =>>>> FIND BY', JSON.stringify({
            accountId: systemAccountId,
            transaction: sellerTradeRequestInfo.transaction,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE
          }));
          response.message = 'Không tìm thấy giao dịch commision';
          return response;
        }
        await CommisionModel.updateOne(
          { id: commissionA0.id },
          { status: TradeConstant.COMMISION_STATUS.SUCCEEDED }
        );
        // +V cho A0
        const addCommisionA0Data = await UserBalanceService.addBalance(
          commissionA0.accountId,
          commissionA0.amount,
          `Cộng commision từ fee của GD bán V #${sellerTradeRequestInfo.transaction}`,
          commissionA0,
          GeneralConstant.SOURCE_NAME.COMMISION
        );
        if (addCommisionA0Data.code !== 1) {
          response.message = 'Không thể cộng V cho user cấp 0!';
          return response;
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
            amount: buyerTradeRequestInfo.amount,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.COMMISION,
          `Nhận commision từ giao dịch mua #${buyerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('Admin update GD thành công----->chia commision cho user C1 và C2 Errorrrrrr!', JSON.stringify(commisionData));
          throw Error(commisionData.message);
        }
        if (sellerTradeRequestInfo.ipnUrl) {
          const urlRequest = sellerTradeRequestInfo.ipnUrl;
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
          await TradeRequestModel.updateOne(
            { id: sellerTradeRequestInfo.id },
            {
              $inc: {
                'sentIpn.count': 1 // tăng số lần gọi
              }
            });

          const logRequest = await RequestService.requestPost(urlRequest, null, body, {});
          await TradeRequestModel.updateOne(
            { id: sellerTradeRequestInfo.id },
            {
              $set: {
                'sentIpn.isSentIPN': true // ipn thành công
              }
            });
          console.log('1----/v1/trade-request/ admin xác nhận GD thành công, response from ', urlRequest, JSON.stringify({ body, logRequest }));
        }
        response.code = 1;
        response.message = 'Cập nhật thành công';
        return response;
      }
      response.code = 1;
      response.message = 'Cập nhật thành công';
      return response;
    }

  },
  /**
   * Cập nhật thành công cho các GD đã Hết hạn
   * @param {*} tradeRequestInfo
   * @param {*} acctionAccountId
   * @param {*} note
   */
  async updateTradeRequestExpiredToSuccess(tradeRequestInfo, acctionAccountId, note) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    if (!_.includes([TradeConstant.TRADE_STATUS.EXPIRED, TradeConstant.TRADE_STATUS.CANCELLED], tradeRequestInfo.status)) {
      response.message = 'Trạng thái giao dịch không hợp lệ';
      return response;
    }
    const adsInfo = await AdsModel.findOne({ id: tradeRequestInfo.adsId }).lean();

    if (adsInfo.type === TradeConstant.ADS_TYPE.BUY) {
      //quảng cáo mua => tìm GD SELL
      let sellerTradeRequestInfo = await TradeRequestModel.findOne({
        transaction: tradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.SELL
      });
      // tìm GD đã hoàn tiền nếu có
      const userBalanceRefunded = await UserBalanceModel.findOne({
        refTransaction: sellerTradeRequestInfo.transaction,
        refId: sellerTradeRequestInfo.id,
        accountId: sellerTradeRequestInfo.accountId,
        sourceName: GeneralConstant.SOURCE_NAME.TRADE_EXPIRED
      }).lean();
      console.log('GD đã hoàn tiền======>', JSON.stringify(userBalanceRefunded), 'Find BY=====>', JSON.stringify({
        refTransaction: sellerTradeRequestInfo.transaction,
        refId: sellerTradeRequestInfo.id,
        accountId: sellerTradeRequestInfo.accountId,
        sourceName: GeneralConstant.SOURCE_NAME.TRADE_EXPIRED
      }));
      if (userBalanceRefunded) { // GD đã hủy và đã hoàn
        // trừ lại tiền GD SELL
        const minusBalanceSeller = await UserBalanceService.minusBalance(
          sellerTradeRequestInfo.accountId,
          sellerTradeRequestInfo.amount,
          `Trừ balance giao dịch bán #${sellerTradeRequestInfo.transaction} đã hết hạn`,
          sellerTradeRequestInfo,
          GeneralConstant.SOURCE_NAME.TRADE
        );
        if (minusBalanceSeller.code !== 1) {

          response.message = 'Trừ balance của người bán không thành công';
          return response;
        }
        // trừ lại fee GD (nếu có)
        const feeTrade = await UserBalanceModel.findOne({
          refTransaction: sellerTradeRequestInfo.transaction,
          refId: sellerTradeRequestInfo.id,
          accountId: sellerTradeRequestInfo.accountId,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE_FEE
        }).lean();
        if (feeTrade) {
          const minusFeeSeller = await UserBalanceService.minusBalance(
            feeTrade.accountId,
            -feeTrade.amount, // fee của GD cũ là số âm
            `Phí thanh toán cho giao dịch #${sellerTradeRequestInfo.transaction} đã hủy`,
            sellerTradeRequestInfo,
            GeneralConstant.SOURCE_NAME.TRADE_FEE
          );
          if (minusFeeSeller.code !== 1) {

            response.message = 'Trừ fee giao dịch của người bán không thành công';
            return response;
          }
          // có trừ fee thanh toán => có commision cho A0
          // => updaye status thành pending
          let systemAccountId = null;
          const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
          if (systemAccount) systemAccountId = systemAccount.id;
          await CommisionModel.updateOne(
            {
              transaction: tradeRequestInfo.transaction,
              accountId: systemAccountId,
              sourceName: GeneralConstant.SOURCE_NAME.TRADE,
              status: TradeConstant.COMMISION_STATUS.CANCELLED,
              adsId: sellerTradeRequestInfo.adsId,
              tradeId: sellerTradeRequestInfo.id
            },
            {
              $set: {
                status: TradeConstant.COMMISION_STATUS.PENDING
              }
            });
        }
      }
      // update trade request thành công
      const updated = await TradeRequestModel.updateMany(
        {
          id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
        },
        {
          $set: {
            status: TradeConstant.TRADE_STATUS.SUCCEEDED,
            filledAmount: tradeRequestInfo.amount,
            filledValue: tradeRequestInfo.value
          },
          $push: {
            changedStatus: {
              from: tradeRequestInfo.status,
              to: TradeConstant.TRADE_STATUS.SUCCEEDED,
              reason: note,
              accountAction: acctionAccountId,
              updatedAt: new Date()
            }
          }
        },
        { multi: true });
      if (!updated || updated.nModified !== 2) {
        response.message = 'Có lỗi update giao dịch, vui lòng kiểm tra lại!';
        return response;
      }
      // +filledAmount trong ads
      await AdsModel.updateOne(
        { id: tradeRequestInfo.adsId },
        {
          $inc: {
            filledAmount: tradeRequestInfo.amount,
            filledValue: tradeRequestInfo.value
          }
        });
      // +V cho người mua
      // tìm buyer
      const buyerTradeRequestInfo = await TradeRequestModel.findOne({
        transaction: tradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.BUY,
        status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
      });
      const buyerBalanceCreate = await UserBalanceService.addBalance(
        buyerTradeRequestInfo.accountId,
        buyerTradeRequestInfo.amount,
        `Mua V #${buyerTradeRequestInfo.transaction}`,
        buyerTradeRequestInfo,
        GeneralConstant.SOURCE_NAME.TRADE
      );
      if (sellerTradeRequestInfo.partnerTransaction) {
        //// update commision A3 đã chuyển cho A0 nếu có}
        let systemAccountId = null;
        const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
        if (systemAccount) systemAccountId = systemAccount.id;
        const commissionA0 = await CommisionModel.findOne({
          accountId: systemAccountId,
          transaction: sellerTradeRequestInfo.transaction,
          sourceName: GeneralConstant.SOURCE_NAME.TRADE
        }).lean();
        if (!commissionA0) {
          console.log('Không tìm thấy giao dịch commision =>>>> FIND BY', JSON.stringify({
            accountId: systemAccountId,
            transaction: sellerTradeRequestInfo.transaction,
            sourceName: GeneralConstant.SOURCE_NAME.TRADE
          }));
          response.message = 'Không tìm thấy giao dịch commision';
          return response;
        }
        await CommisionModel.updateOne(
          { id: commissionA0.id },
          { status: TradeConstant.COMMISION_STATUS.SUCCEEDED }
        );
        // +V cho A0
        const addCommisionA0Data = await UserBalanceService.addBalance(
          commissionA0.accountId,
          commissionA0.amount,
          `Cộng commision từ fee của GD bán V #${sellerTradeRequestInfo.transaction}`,
          commissionA0,
          GeneralConstant.SOURCE_NAME.COMMISION
        );
        if (addCommisionA0Data.code !== 1) {

          response.message = 'Không thể cộng V cho user cấp 0!';
          return response;
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
            amount: buyerTradeRequestInfo.amount,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.COMMISION,
          `Nhận commision từ giao dịch mua #${buyerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('Admin update GD thành công----->chia commision cho user C1 và C2 Errorrrrrr!', JSON.stringify(commisionData));
          throw Error(commisionData.message);

        }
        if (sellerTradeRequestInfo.ipnUrl) {
          const urlRequest = sellerTradeRequestInfo.ipnUrl;
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
          await TradeRequestModel.updateOne(
            { id: sellerTradeRequestInfo.id },
            {
              $inc: {
                'sentIpn.count': 1 // tăng số lần gọi
              }
            });
          const logRequest = await RequestService.requestPost(urlRequest, null, body, {});
          await TradeRequestModel.updateOne(
            { id: sellerTradeRequestInfo.id },
            {
              $set: {
                'sentIpn.isSentIPN': true // ipn thành công
              }
            });
          console.log('1----/v1/trade-request/ admin xác nhận GD khác AMOUNT thành công, response from ', urlRequest, JSON.stringify({ body, logRequest }));
        }
      }
      response.code = 1;
      response.message = 'Cập nhật thành công';
      return response;
    } else { //quảng cáo SELL =>  GD BUY
      // tìm buyer
      const buyerTradeRequestInfo = await TradeRequestModel.findOne({
        transaction: tradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.BUY,
        status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
      });
      // lấy V trong Ads vì EXPIRED đã trả V lại cho Ads
      const subtractV = await AdsModel.updateOne(
        { id: adsInfo.id },
        {
          $inc: {
            amount: -buyerTradeRequestInfo.amount,
            filledAmount: buyerTradeRequestInfo.amount
          }
        });
      if (!subtractV || subtractV.nModified !== 1) {

        response.message = 'Trừ V quảng cáo BÁN ko thành công';
        return response;
      }
      // cập nhật thành công cho GD Trade
      const updated = await TradeRequestModel.updateMany(
        {
          id: { $in: [sellerTradeRequestInfo.id, buyerTradeRequestInfo.id] }
        },
        {
          $set: {
            status: TradeConstant.TRADE_STATUS.SUCCEEDED,
            filledAmount: tradeRequestInfo.amount,
            filledValue: tradeRequestInfo.value
          },
          $push: {
            changedStatus: {
              from: tradeRequestInfo.status,
              to: TradeConstant.TRADE_STATUS.SUCCEEDED,
              reason: note,
              accountAction: acctionAccountId,
              updatedAt: new Date()
            }
          }
        },
        { multi: true });
      if (!updated || updated.nModified !== 2) {
        response.message = 'Có lỗi update giao dịch, vui lòng kiểm tra lại!!';
        return response;
      }
      // +filledAmount trong ads
      await AdsModel.updateOne(
        { id: tradeRequestInfo.adsId },
        {
          $inc: {
            filledAmount: tradeRequestInfo.amount,
            filledValue: tradeRequestInfo.value
          }
        });
      // +V cho người mua

      const buyerBalanceCreate = await UserBalanceService.addBalance(
        buyerTradeRequestInfo.accountId,
        buyerTradeRequestInfo.amount,
        `Mua V #${buyerTradeRequestInfo.transaction}`,
        buyerTradeRequestInfo,
        GeneralConstant.SOURCE_NAME.TRADE
      );
      const sellerTradeRequestInfo = await TradeRequestModel.findOne({
        transaction: tradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.SELL
      });
      // ads SELL => trade BUY =>  chia commision của C0 cho user C1 và C2
      // tính commision nếu có
      if (buyerTradeRequestInfo.partnerTransaction) {
        // trừ V của A0
        const minusCommisionData = await ExternalService.minusCommissionSystemUser(
          {
            amount: buyerTradeRequestInfo.amount,
            transaction: buyerTradeRequestInfo.transaction
          },
          buyerTradeRequestInfo,
          `Chia bonus cho user từ GD mua #${buyerTradeRequestInfo.transaction}`
        );
        if (minusCommisionData.code !== 1) {
          console.log('--------->Trừ commision A0 Error!', JSON.stringify(minusCommisionData));
          response.message = minusCommisionData.message;
          return response;
        }

        //chia commision cho user C1 và C2 (tính userBalance cho A1 và A2 + add Commision model)
        const commisionData = await ExternalService.addCommissionUser(
          {
            amount: sellerTradeRequestInfo.amount,
            transaction: sellerTradeRequestInfo.transaction
          },
          sellerTradeRequestInfo,
          GeneralConstant.COMMISION_TYPE.BONUS,
          `Nhận bonus từ giao dịch mua #${sellerTradeRequestInfo.transaction}`
        );
        if (commisionData.code !== 1) {
          console.log('--------->chia commision cho user C1 và C2 Error!', JSON.stringify(commisionData));
          throw Error(commisionData.message);

        }
        if (buyerTradeRequestInfo.ipnUrl) {
          const urlRequest = buyerTradeRequestInfo.ipnUrl;
          const body = {
            transaction: buyerTradeRequestInfo.transaction,
            partnerTransaction: buyerTradeRequestInfo.partnerTransaction,
            amountInfo: {
              amount: buyerTradeRequestInfo.amount,
              fee: buyerTradeRequestInfo.feeAmount,
              total: buyerTradeRequestInfo.totalAmount
            },
            valueInfo: {
              value: buyerTradeRequestInfo.value,
              fee: buyerTradeRequestInfo.fee,
              total: buyerTradeRequestInfo.totalValue
            },
            status: TradeConstant.TRADE_STATUS.SUCCEEDED
          };
          await TradeRequestModel.updateOne(
            { id: buyerTradeRequestInfo.id },
            {
              $inc: {
                'sentIpn.count': 1 // tăng số lần gọi
              }
            });
          const logRequest = await RequestService.requestPost(urlRequest, null, body, {});
          await TradeRequestModel.updateOne(
            { id: buyerTradeRequestInfo.id },
            {
              $set: {
                'sentIpn.isSentIPN': true // ipn thành công
              }
            });
          console.log('1----/v1/trade-request/ admin xác nhận GD khác AMOUNT thành công, response from ', urlRequest, JSON.stringify({ body, logRequest }));
        }
        response.code = 1;
        response.message = 'Cập nhật thành công';
        return response;
      }
    }

  },
  /**
   * chuyển EXPIRED hoặc CANCELLED hoặc FAILED cho các GD PENDING, PAID, WARNING
   * @param {*} tradeRequestInfo
   * @param {*} statusToUpdate trạng thái sẽ thay đổi
   * @param {*} acctionAccountId
   * @param {*} note
   */
  async updateTradeRequestStatus(tradeRequestInfo, statusToUpdate, acctionAccountId, note) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };

    // chuyển EXPIRED hoặc CANCELLED hoặc FAILED cho các GD PENDING, PAID, WARNING
    if (!_.includes([TradeConstant.TRADE_STATUS.PENDING, TradeConstant.TRADE_STATUS.PAID, TradeConstant.TRADE_STATUS.WARNING], tradeRequestInfo.status)) {
      response.message = 'Trạng thái giao dịch không hỗ trợ!';
      return response;
    }
    if (!_.includes([TradeConstant.TRADE_STATUS.EXPIRED, TradeConstant.TRADE_STATUS.FAILED, TradeConstant.TRADE_STATUS.CANCELLED], statusToUpdate)) {
      response.message = 'Trạng thái giao dịch không hỗ trợ';
      return response;
    }

    const adsInfo = await AdsModel.findOne({ id: tradeRequestInfo.adsId }).lean();
    // kiểm tra GD BUY or SELL
    // ADS SELL =>  GD BUY => hủy => trả V cho Ads Sell
    // Ads BUY => GD SELL => hủy => trả V cho Ads Buy, trả V cho seller
    const updated = await TradeRequestModel.updateMany(
      {
        transaction: tradeRequestInfo.transaction,
        status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
      },
      {
        $set: {
          status: statusToUpdate
        },
        $push: {
          changedStatus: {
            from: tradeRequestInfo.status,
            to: statusToUpdate,
            reason: note,
            accountAction: acctionAccountId,
            updatedAt: new Date()
          }
        }
      },
      { multi: true });
    if (!updated || updated.nModified !== 2) {
      response.message = 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại';
      return response;
    }
    // trả V lại cho ADS
    await AdsModel.updateOne(
      { id: tradeRequestInfo.adsId },
      {
        $inc: {
          amount: tradeRequestInfo.amount
        }
      });
    if (adsInfo.filledAmount > 0) {
      await AdsModel.updateOne(
        { id: tradeRequestInfo.adsId },
        {
          $inc: {
            filledAmount: -tradeRequestInfo.amount,
            filledValue: -tradeRequestInfo.value
          }
        });
    }
    if (adsInfo.type === TradeConstant.ADS_TYPE.BUY) {
      // Ads BUY => GD SELL => trả V cho seller
      // tìm seller
      const tradeSell = await TradeRequestModel.findOne({
        transaction: tradeRequestInfo.transaction,
        type: TradeConstant.TRADE_TYPE.SELL
      });
      // console.log(JSON.stringify(tradeSell));
      if (!tradeSell) {

        response.message = 'Không tìm thấy thông tin lệnh bán V';
        return response;
      }
      const addBalanceSeller = await UserBalanceService.addBalance(
        tradeSell.accountId,
        tradeSell.totalAmount, // trả V và cả phí V
        `Hoàn trả V do lệnh SELL #${tradeSell.transaction} bị hủy`,
        tradeSell,
        GeneralConstant.SOURCE_NAME.TRADE_EXPIRED
      );
      console.log('addBalanceSelleraddBalanceSeller', JSON.stringify(addBalanceSeller));
      if (addBalanceSeller.code !== 1) {

        response.message = 'Hoàn V cho người bán không thành công!';
        return response;
      }
      // hủy commision đã tạo cho A0(nếu có)
      let systemAccountId = null;
      const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
      if (systemAccount) systemAccountId = systemAccount.id;
      const commissionA0 = await CommisionModel.findOne({
        transaction: tradeRequestInfo.transaction,
        accountId: systemAccountId,
        sourceName: GeneralConstant.SOURCE_NAME.TRADE,
        status: TradeConstant.COMMISION_STATUS.PENDING,
        adsId: tradeSell.adsId,
        tradeId: tradeSell.id
      });
      if (commissionA0) {
        await CommisionModel.updateOne(
          { id: commissionA0.id },
          { status: TradeConstant.COMMISION_STATUS.CANCELLED }
        );
      }
    }
    if (!tradeRequestInfo.ipnUrl) {
      const tradeRequest = await TradeRequestModel.findOne({
        transaction: tradeRequestInfo.transaction,
        type: tradeRequestInfo.type === TradeConstant.TRADE_TYPE.BUY ? TradeConstant.TRADE_TYPE.SELL : TradeConstant.TRADE_TYPE.BUY,
        status: statusToUpdate
      }).lean();
      const ipnUrl = tradeRequest.ipnUrl ? tradeRequest.ipnUrl : tradeRequestInfo.ipnUrl;
      if (ipnUrl) {
        const partnerTransaction = tradeRequest.partnerTransaction || tradeRequestInfo.partnerTransaction || tradeRequestInfo.paymentInfo.content;
        const body = {
          transaction: tradeRequestInfo.transaction,
          partnerTransaction,
          status: statusToUpdate
        };
        const logRequest = await RequestService.requestPost(ipnUrl, null, body, {});
        console.log('1----/v1/trade-request/ admin update trạng thái GD response from ', ipnUrl, JSON.stringify({ body, logRequest }));
      }
    }

    response.code = 1;
    response.message = 'Cập nhật thành công';
    return response;
  },
  /**
   * người mua gửi khiếu nại cho GD đã chuyển khoản nhưng chưa nhận được V
   * @param {*} sellTradeRequestInfo
   * @param {*} buyTradeRequestInfo
   * @param {*} payload
   * @param {*} claimAccountId
   */
  async sellerClaimTradeRequest(transaction, reason, claimAccountId) {
    const response = {
      code: -1,
      message: '',
      data: {}
    };
    // tìm thông tin GD bán
    const sellTradeRequestInfo = await TradeRequestModel.findOne({
      transaction,
      type: TradeConstant.TRADE_TYPE.SELL,
      accountId: claimAccountId
    }).lean();

    if (!sellTradeRequestInfo) {
      response.message = 'Không tìm thấy thông tin giao dịch';
      return response;
    }
    // kiem tra thoi gian khiếu nại với createdAt
    const now = moment(new Date());
    const createdAt = moment(new Date(sellTradeRequestInfo.createdAt));
    if (now.diff(createdAt, 'minutes') < 15) throw { message: 'Vui lòng đợi 15 phút sau khi tạo giao dịch' };
    const buyTradeRequestInfo = await TradeRequestModel.findOne({
      transaction: sellTradeRequestInfo.transaction,
      type: TradeConstant.TRADE_TYPE.BUY,
      status: { $ne: TradeConstant.TRADE_STATUS.REFUSED }
    }).lean();
    if (!buyTradeRequestInfo) {
      response.message = 'Không tìm thấy thông tin giao dịch mua';
      return response;
    }
    // cap nhật trạng thái  cho GD của người bán và lý do khiếu nại
    const updated = await TradeRequestModel.updateMany(
      {
        id: { $in: [buyTradeRequestInfo.id, sellTradeRequestInfo.id] }
      },
      {
        $set: {
          claim: {
            status: TradeConstant.CLAIM_STATUS.SELLER_CLAIM,
            sentAt: moment(new Date()).toISOString(),
            reason,
            accountId: claimAccountId
          }
        }
      },
      { multi: true }
    );
    if (!updated || updated.nModified !== 2) {
      response.message = 'Có lỗi cập nhật giao dịch, vui lòng kiểm tra lại';
      return response;
    }
    const ipnUrl = sellTradeRequestInfo.ipnUrl ? sellTradeRequestInfo.ipnUrl : buyTradeRequestInfo.ipnUrl;
    if (ipnUrl) {
      const partnerTransaction = sellTradeRequestInfo.partnerTransaction || buyTradeRequestInfo.partnerTransaction || buyTradeRequestInfo.paymentInfo.content;
      const logRequest = await RequestService.requestPost(ipnUrl, null, {
        transaction: sellTradeRequestInfo.transaction,
        partnerTransaction,
        status: TradeConstant.TRADE_STATUS.WARNING
      }, {});
      console.log('User hủy GD response from ', ipnUrl, JSON.stringify({ logRequest }));
    }

    // GD commision của A3->A0 chưa thay đổi trạng thái
    const buyerInfo = await AccountModel.findOne({ id: buyTradeRequestInfo.accountId }).lean();

    SendEmailWorker.pushSendEmail(
      buyerInfo.email,
      `Người bán gửi khiếu nại giao dịch<br>
        Mã giao dịch: <b>#${buyerInfo.transaction}</b> <br>
        Lượng giao dịch: ${numeral(buyTradeRequestInfo.totalAmount).format('0,0')} </b> <br>
        Xem chi tiết: <a href="${SocialConfig.environment.web}/home/trade/${buyTradeRequestInfo.transaction}" target="_blank">TẠI ĐÂY</a>`,
      `WMV thông báo giao dịch KHIẾU NẠI #${buyTradeRequestInfo.transaction}`,
      'send-notification');
    response.code = 1;
    response.data = sellTradeRequestInfo;
    response.message = 'Gửi khiếu nại thành công';
    return response;
  }
};
