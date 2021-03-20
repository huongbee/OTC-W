const AccountModel = require('project/models/AccountModel');
const AdsModel = require('project/models/AdsModel');
const TradeRequestModel = require('project/models/TradeRequestModel');
const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const UserBalanceService = require('project/services/UserBalanceService');
const GeneralConstant = require('project/constants/GeneralConstant');

module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    if (_.get(userInfo, 'id', false) !== false) {
      const { id } = request.params;
      const ads = await AdsModel.findOne({
        id,
        accountId: authInfo.accountId,
        status: { $ne: TradeConstant.ADS_STATUS.CANCELLED }
      }).lean();
      if (!ads) throw { message: 'Không tìm thấy thông tin quảng cáo' };

      /* Kiểm tra các giao dịch chưa hoàn thành của quảng cáo */
      const unfinishedTrades = await TradeRequestModel.find({
        adsId: ads.id,
        status: {
          $nin: [
            TradeConstant.TRADE_STATUS.SUCCEEDED,
            TradeConstant.TRADE_STATUS.EXPIRED,
            TradeConstant.TRADE_STATUS.FAILED,
            TradeConstant.TRADE_STATUS.CANCELLED,
            TradeConstant.TRADE_STATUS.REFUSED
          ]
        }
      });
      if (unfinishedTrades.length) {
        // Nếu còn giao dịch chưa hoàn thành, đổi status thành inactive và thông báo
        // await AdsModel.updateOne({ id: ads.id }, { $set: { status: TradeConstant.ADS_STATUS.INACTIVE } });
        throw { message: 'Hoàn thành tất cả giao dịch hiện có để hủy quảng cáo' };
      }
      /* */

      if (ads.type === TradeConstant.ADS_TYPE.SELL) {
        /* Trả về số V chưa giao dịch trong quảng cáo */
        // const finishedTrades = await TradeRequestModel.find({ adsId: ads.id, status: TradeConstant.TRADE_STATUS.SUCCEEDED });
        // const sumTradeFinish = !finishedTrades.length ? 0 : _.reduce(finishedTrades, (a, b) => a + b.amount, 0);
        // const returnedBalance = ads.amount - sumTradeFinish;

        // await UserBalanceModel.create({ accountId: userInfo.id, amount: returnedBalance, description: `Số dư V chưa hoàn thành của quảng cáo #${ads.id}` })
        const userBalanceCreate = await UserBalanceService.addBalance(
          ads.accountId,
          ads.amount,
          `Hủy quảng cáo bán #${ads.transaction}`,
          ads,
          GeneralConstant.SOURCE_NAME.ADS
        );
        if (userBalanceCreate.code !== 1) {
          // TODO rollback trade request
          // rollback commission
          // await TradeRequestModel.updateOne(
          //   { id: ads.id },
          //   {
          //     status: TradeConstant.TRADE_STATUS.FAILED
          //   }
          // );
          throw { message: 'Hủy quảng cáo thất bại' };
        }

        /* */
      }

      // Đổi status giao dịch thành CANCELLED
      const updated = await AdsModel.updateOne({ id: ads.id }, { $set: { status: TradeConstant.ADS_STATUS.CANCELLED } });
      if (!updated.nModified) {
        throw { message: 'Hủy quảng cáo thất bại' };
      }
      return reply.api({
        message: 'Hủy quảng cáo thành công'
      }).code(ResponseCode.REQUEST_SUCCESS);
    }
    throw { message: 'Không tìm thấy tài khoản' };
  } catch (err) {
    return reply.api({
      message: request.__(err.message)
    }).code(ResponseCode.REQUEST_FAIL);
  }
};