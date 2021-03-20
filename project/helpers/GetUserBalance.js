// const UserBalanceModel = require('project/models/UserBalanceModel');
const AdsModel = require('project/models/AdsModel');
// const TradeRequestModel = require('project/models/TradeRequestModel');
// const _ = require('lodash');
const TradeConstant = require('project/constants/TradeConstant');
const BalanceModel = require('project/models/BalanceModel');
const _ = require('lodash');
const Decimal = require('decimal.js');
const UserBalanceService = require('project/services/UserBalanceService');

module.exports = async (userInfo = { id: '' }) => {

  // const userBalanceRecords = await UserBalanceModel.find({ accountId: userInfo.id }, {_id: 0, id: 0}).lean();
  // const availableBalance = !userBalanceRecords.length ? 0 : _.reduce(userBalanceRecords, (a, b) => a + b.amount, 0);
  // const sumSellAdsAmount = await AdsModel.find({ accountId: userInfo.id, type: TradeConstant.TRADE_TYPE.SELL }).lean();
  // // Chênh lệch giữa số V tổng và số V khả dụng
  // let difference = 0;
  // if (sumSellAdsAmount.length) {
  //   const adsIds = _.map(sumSellAdsAmount, 'id');
  // const sumSellTradeFinishAmount = await TradeRequestModel.find({ adsId: { $in: adsIds }, status: TradeConstant.TRADE_STATUS.SUCCEEDED }).lean();
  //   difference += _.reduce(sumSellAdsAmount, (a, b) => a + b.amount, 0);
  //   difference -= !sumSellTradeFinishAmount.length ? 0 : _.reduce(sumSellTradeFinishAmount, (a, b) => a + b.amount, 0);
  // }
  if (!userInfo.id) {
    throw { message: 'VUi lòng nhập thông tin user' };
  }
  // const userBalance = await BalanceModel.findOne({ accountId: userInfo.id }).lean();
  let userBalance = await UserBalanceService.information(userInfo.id);
  if (userBalance.code !== 1) {
    throw { message: userBalance.data ? userBalance.data.message : 'Lỗi lấy thông tin ví' };
  }
  const balance = {
    availableBalance: 0,
    currentBalance: 0
  };
  balance.availableBalance = userBalance.data.balance;
  // tìm các quảng cáo SELL chưa hoàn tất để tính lock balance
  const lockedBalance = await AdsModel.aggregate(
    [
      {
        $match: {
          amount: { $gte: 0 },
          status: { $in: [TradeConstant.ADS_STATUS.ACTIVE, TradeConstant.ADS_STATUS.INACTIVE] },
          type: TradeConstant.TRADE_TYPE.SELL,
          accountId: userInfo.id
        }
      },
      {
        $project: {
          _id: '$accountId',
          accountId: '$accountId',
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: {
            accountId: '$accountId'
          },
          total: { $sum: '$total' }
        }
      },
      {
        $project: {
          _id: 0,
          accountId: '$_id.accountId',
          total: '$total'

        }
      }
    ]);
  if (!lockedBalance || lockedBalance.length === 0) {
    balance.currentBalance = balance.availableBalance; // chưa có GD thì 2 balance như nhau
    return balance;
  }
  const totalLock = new Decimal(lockedBalance[0].total);
  balance.currentBalance = _.toNumber(new Decimal(balance.availableBalance).add(totalLock));
  return balance;

  // const rs = await UserBalanceModel.aggregate([
  //   {
  //     $match: {
  //       accountId: userInfo.id,
  //     },
  //   },
  //   {
  //     $group: {
  //       _id: '$accountId',
  //       amount: { $sum: '$amount' },
  //     },
  //   },
  //   {
  //     $lookup: {
  //       from: 'Ads_Temp',
  //       localField: '_id',
  //       foreignField: 'accountId',
  //       as: 'ads',
  //     },
  //   },
  //   {
  //     $project: {
  //       accountId: '$_id',
  //       amount: '$amount',
  //       ads: {
  //         $filter: {
  //           input: '$ads',
  //           as: 'adsInfo',
  //           cond:
  //           {
  //             $eq: ['$$adsInfo.type', 'SELL'],
  //           },

  //         },
  //       },
  //     },
  //   },
  //   {
  //     $unwind:
  //     {
  //       path: '$ads',
  //       preserveNullAndEmptyArrays: true
  //     }
  //   },
  //   {
  //     $addFields: {
  //       adsId: '$ads.id',
  //     },
  //   },
  //   {
  //     $lookup: {
  //       from: 'TradeRequest',
  //       localField: 'adsId',
  //       foreignField: 'adsId',
  //       as: 'trades',
  //     },
  //   },
  //   {
  //     $project: {
  //       accountId: '$_id',
  //       amount: '$amount',
  //       ads: '$ads',
  //       trades: {
  //         $filter: {
  //           input: '$trades',
  //           as: 'tradeInfo',
  //           cond: {
  //             $eq: ['$$tradeInfo.status', 'FINISH'],
  //           },
  //         },
  //       }
  //     },
  //   },
  //   {
  //     $addFields: {
  //       adsTradeFinishAmount: {
  //         $sum: '$trades.amount',
  //       },
  //     },
  //   },
  //   {
  //     $group: {
  //       _id: '$accountId',
  //       amount: { $first: '$amount' },
  //       ads: { $addToSet: '$ads' },
  //       totalSellTradeFinishAmount: { $sum: '$adsTradeFinishAmount' },
  //     },
  //   },
  //   {
  //     $project: {
  //       amount: '$amount',
  //       ads: {
  //         $filter: {
  //           input: '$ads',
  //           as: 'adsInfo',
  //           cond:
  //           {
  //             $ne: ['$$adsInfo.status', 'CANCELLED'],
  //           },

  //         },
  //       },
  //       totalSellTradeFinishAmount: { $sum: '$adsTradeFinishAmount' },
  //     },
  //   },
  //   {
  //     $addFields: {
  //       totalAdsSellAmount: { $sum: '$ads.amount' },
  //     },
  //   },
  //   {
  //     $addFields: {
  //       currentBalance: {
  //         $add: [
  //           '$amount',
  //           {
  //             $subtract: ['$totalAdsSellAmount', '$totalSellTradeFinishAmount'],
  //           },
  //         ],
  //       },
  //     },
  //   },
  //   {
  //     $project: {
  //       availableBalance: '$amount',
  //       currentBalance: '$currentBalance',
  //     },
  //   }
  // ])

  // if (rs.length) {
  //   const { availableBalance, currentBalance } = rs[0];
  //   return {
  //     availableBalance,
  //     currentBalance
  //   };
  // }

  // else
  //   return {
  //     availableBalance: 0,
  //     currentBalance: 0,
  //   };
};
