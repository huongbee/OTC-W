const AdsModel = require('project/models/AdsModel');
const AccountModel = require('project/models/AccountModel');
const CommisionModel = require('project/models/CommisionModel');
const UserBalanceModel = require('project/models/UserBalanceModel');
const _ = require('lodash');
const Decimal = require('decimal.js');
const GetUserBalance = require('project/helpers/GetUserBalance');
const GeneralConstant = require('project/constants/GeneralConstant');
const TradeConstant = require('project/constants/TradeConstant');
const UserBalanceService = require('project/services/UserBalanceService');
const TradeRequestModel = require('project/models/TradeRequestModel');
const moment = require('moment');
const MomentTimezone = require('moment-timezone');
class ExternalService {
  // verifyToken(params = [], token) {
  //   const createdToken = md5(params.join() + localConfig.externalApi.secretKey);
  //   return createdToken === token;
  // }
  /**
   *
   * @param {Number} childAccountId
   * @return {Object} parentInfo { id, email }
   */
  async getParentAccountInfo(childAccountId) {
    if (!childAccountId) return null;
    const accountChildInfo = await AccountModel.findOne({ id: childAccountId }).lean();
    if (accountChildInfo.parentId) {
      //tìm email parent
      const parentInfo = await AccountModel.findOne({ id: accountChildInfo.parentId }).lean();
      return { id: accountChildInfo.parentId, email: _.get(parentInfo, 'email', null) };
    }
    // nếu ko có parentId
    // => kiểm tra level tk
    // => tk level 2 => level 1 default // SYSTEM_ACCOUNT_LEVEL1
    // => tk level 1 => level 0 default // SYSTEM_ACCOUNT_LEVEL0
    let emailParent = null;
    if (accountChildInfo.accountType === 1) {
      emailParent = GeneralConstant.SYSTEM_ACCOUNT_LEVEL0;
    }
    if (accountChildInfo.accountType === 2) {
      emailParent = GeneralConstant.SYSTEM_ACCOUNT_LEVEL1;
    }
    const accountParent = await AccountModel.findOne({ email: emailParent }).lean();
    if (!accountParent) {
      return null;
    }
    return { id: accountParent.id, email: emailParent };
  }
  /**
   *
   * @param {*} amount
   * @param {*} accountId Seller tạo lệnh SELL
   * @param {*} levelMatch
   * @param {Array} exceptedAccountId ngoại trừ account
   */
  async assignBuyRequest(amount, accountId, levelMatch, exceptedAccountId = []) {
    const response = {
      code: -1,
      message: '',
      data: null
    };
    try {
      let where = {
        status: TradeConstant.ADS_STATUS.ACTIVE,
        type: TradeConstant.ADS_TYPE.BUY,
        $and: [
          { amount: { $gte: amount } },
          { amount: { $ne: 0 } }
        ]
      };
      if (levelMatch) {
        where.levelAllowed = { $elemMatch: { $eq: levelMatch } };
      }
      // con chỉ có thể khớp các lệnh của cha
      // => tìm accountID của cha => khớp lệnh của cha
      // => tk level 3 => khơp tất cả các lệnh của level 2
      // => tk level 2 => khớp lệnh level 1 default // SYSTEM_ACCOUNT_LEVEL1
      // => tk level 1 => khớp lệnh level 0 default // SYSTEM_ACCOUNT_LEVEL0

      //  LV2 của hệ thống nhận lệnh sau cùng và nếu tất cả ĐL từ chối nhận lệnh thì đều chuyển tới LV2 của hệ thống
      const systemAccountLevel2 = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_LEVEL2 }).lean();
      if (!systemAccountLevel2) {
        response.message = '[ERR] Không tìm thấy quảng cáo phù hợp';
        return response;
      }
      const accountChildInfo = await AccountModel.findOne({ id: accountId }).lean();
      const cond = {
        accountId: {
          $nin: [
            accountId
          ]
        },
        type: TradeConstant.TRADE_TYPE.SELL,
        status: {
          $in: [
            TradeConstant.TRADE_STATUS.PENDING,
            TradeConstant.TRADE_STATUS.PAID,
            TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
            TradeConstant.TRADE_STATUS.WARNING,
            TradeConstant.TRADE_STATUS.LOCKED
          ]
        }
      };
      if (accountChildInfo.accountType === 3) {
        // where.$and.push({ accountId: { $ne: accountId } });// không khớp lệnh cho chính mình tạo ra
        const waitingTrades = await TradeRequestModel.find(cond).lean(); // không khớp cho account đang có lệnh chờ
        const arrayAccountId = _.map(waitingTrades, 'accountId');
        if (exceptedAccountId) {
          arrayAccountId.push(...exceptedAccountId); // các account đã từ chối
        }
        // ngoại trừ account lv2 của  hệ thống
        arrayAccountId.push(systemAccountLevel2.id);
        where.$and.push({ accountId: { $nin: _.uniq(arrayAccountId) } });
      }
      else {
        // khớp lệnh của cấp cha
        const accountParentInfo = await this.getParentAccountInfo(accountChildInfo.parentId);
        if (!accountParentInfo) return null;
        where.$and.push({ accountId: accountParentInfo.id });
      }

      const allAds = await AdsModel.find(where).select('id').sort({ _id: 'asc' }).lean();
      if (allAds.length > 0 && _.get(allAds[0], 'id', null) !== null) {
        console.log('Filter Select Buy ADS random adsId ngoại trừ lv2 =================>', JSON.stringify({ where, accountId }));
        const adsId = allAds.map(ad => ad.id);
        const randId = adsId[_.random(adsId.length - 1)];
        const availableAds = await AdsModel.findOne({ id: randId }).sort({ _id: 'asc' }).lean();
        response.code = 1;
        response.message = 'Thành công';
        response.data = availableAds;
        return response;
      }
      //#region user có Lệnh chờ ít nhất
      /*
      // user có Lệnh chờ ít nhất
      // lấy các quảng cáo ACTIVE để chọn accountId
      where = {
        status: TradeConstant.ADS_STATUS.ACTIVE,
        type: TradeConstant.ADS_TYPE.BUY,
        $and: [
          { amount: { $gte: amount } }
        ]
      };
      if (levelMatch) {
        where.levelAllowed = { $elemMatch: { $eq: levelMatch } };
      }
      if (exceptedAccountId.length > 0) {
        // Lệnh chờ ít nhất, ngoại trừ các account đã từ chối
        where.accountId = { $nin: exceptedAccountId };
      }
      const adsInfos = await AdsModel.find(where).sort({ _id: 'asc' }).lean();
      const listAccountAllow = _.map(adsInfos, 'accountId');

      delete cond.accountId;
      cond.$and = [
        { accountId: { $in: listAccountAllow } },
        { accountId: { $ne: systemAccountLevel2.id } } // ngoại trừ lv2 system
      ];
      const totalPending = await TradeRequestModel.aggregate([
        {
          $match: cond
        },
        {
          $group: {
            _id: '$accountId',
            count: {
              $sum: 1
            }
          }
        },
        {
          $project: {
            _id: 0,
            accountId: '$_id',
            count: '$count'
          }
        },
        {
          $sort: {
            count: 1 // asc
          }
        }
      ]);
      where.$and = [
        { amount: { $gte: amount } }
      ];
      console.log('assignBuyRequest totalPending', JSON.stringify(totalPending));
      if (totalPending.length > 0) { // có các lệnh pending có thể phù hợp
        if (exceptedAccountId.length > 0) {
          const accountIdsPending = _.map(totalPending, 'accountId');
          const allAccountId = _.uniq([...exceptedAccountId, ...accountIdsPending]);
          // const exceptedAccountId = [1, 2, 5, 6, 7];
          // const              arrr = [1, 2, 5, 6, 7, 13, 4, 12, 14]; => 13
          // const accountId = newArr[exceptedAccountId.length];
          const accountIdSelected = allAccountId[exceptedAccountId.length];
          console.log('assignBuyRequest filter accountIdSelected ====>', JSON.stringify({ exceptedAccountId, accountIdsPending, allAccountId }));
          if (accountIdSelected) {
            where.accountId = accountIdSelected;
          }
          else { // loại trừ các account nhưng pending chỉ gồm các account đã loại trừ
            response.message = 'Không tìm thấy quảng cáo phù hợp';
            return response;
          }
        } else {
          where.accountId = totalPending[0].accountId;
        }

        console.log('Lệnh chờ ít nhất===> Filter  Select Buy ADS =================> ', JSON.stringify({ where, accountId }));
        const availableAds = await AdsModel.findOne(where).sort({ _id: 'asc' }).lean();
        if (!availableAds) {
          response.message = 'Không tìm thấy quảng cáo phù hợp';
          return response;
        }
        response.code = 1;
        response.message = 'Thành công';
        response.data = availableAds;
        return response;
      } else { //lấy lệnh của level2 system
      }
      */
      //#endregion

      // lấy lệnh của level2 system
      where = {
        status: TradeConstant.ADS_STATUS.ACTIVE,
        type: TradeConstant.ADS_TYPE.BUY,
        $and: [
          { amount: { $gte: amount } }
        ],
        accountId: systemAccountLevel2.id
      };
      if (levelMatch) {
        where.levelAllowed = { $elemMatch: { $eq: levelMatch } };
      }
      console.log('lấy lệnh của level2 system', JSON.stringify(where));
      const availableAds = await AdsModel.findOne(where).sort({ _id: 'asc' }).lean();
      if (!availableAds) {
        response.message = 'Không tìm thấy quảng cáo phù hợp';
        return response;
      }
      response.code = 1;
      response.message = 'Thành công';
      response.data = availableAds;
      return response;
    } catch (error) {
      console.log(
        'file: ExternalService.js ~ line 14 ~ ExternalService ~ assignBuyRequest ~ error',
        error
      );
      response.message = 'Tạo lệnh bán không thành công. Vui lòng thử lại sau';
      return response;
    }
  }

  /**
   *
   * @param {*} amount
   * @param {*} accountId Buyer tạo lênh BUY
   * @param {*} levelMatch
   */
  async assignSellRequest(amount, accountId, levelMatch, exceptedAccountId = []) {
    const response = {
      code: -1,
      message: '',
      data: null
    };
    try {
      let where = {
        status: TradeConstant.ADS_STATUS.ACTIVE,
        type: TradeConstant.ADS_TYPE.SELL,
        $and: [
          { amount: { $gte: amount } },
          { amount: { $ne: 0 } }
        ]
      };
      if (levelMatch) {
        where.levelAllowed = { $elemMatch: { $eq: levelMatch } };
      }
      // con chỉ có thể khớp các lệnh của cha
      // => tìm accountID của cha => khớp lệnh của cha
      // => tk level 3 => khơp tất cả các lệnh của level 2
      // => tk level 2 => khớp lệnh level 1 default // SYSTEM_ACCOUNT_LEVEL1
      // => tk level 1 => khớp lệnh level 0 default // SYSTEM_ACCOUNT_LEVEL0
      //  LV2 của hệ thống nhận lệnh sau cùng và nếu tất cả ĐL từ chối nhận lệnh thì đều chuyển tới LV2 của lv2
      const systemAccountLevel2 = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_LEVEL2 }).lean();
      if (!systemAccountLevel2) {
        response.message = '[!ERR]Không tìm thấy quảng cáo phù hợp';
        return response;
      }
      const accountChildInfo = await AccountModel.findOne({ id: accountId }).lean();

      const cond = {
        accountId: {
          $nin: [
            accountId
          ]
        },
        type: TradeConstant.TRADE_TYPE.BUY,
        status: {
          $in: [
            TradeConstant.TRADE_STATUS.PENDING,
            TradeConstant.TRADE_STATUS.PAID,
            TradeConstant.TRADE_STATUS.DIFF_AMOUNT_LOCKED,
            TradeConstant.TRADE_STATUS.WARNING,
            TradeConstant.TRADE_STATUS.LOCKED
          ]
        }
      };
      if (accountChildInfo.accountType === 3) {
        // where.accountId = { $ne: accountId };// không khớp lệnh cho chính mình tạo ra
        const waitingTrades = await TradeRequestModel.find(cond).lean(); // không khớp cho account đang có lệnh chờ
        const arrayAccountId = _.map(waitingTrades, 'accountId');
        if (exceptedAccountId) {
          arrayAccountId.push(...exceptedAccountId); // các account đã từ chối
        }
        arrayAccountId.push(systemAccountLevel2.id);
        where.accountId = { $nin: _.uniq(arrayAccountId) }; // lấy user ko có lệnh chờ
      }
      else {
        const accountParentInfo = await this.getParentAccountInfo(accountChildInfo.parentId);
        if (!accountParentInfo) return null;
        where.accountId = accountParentInfo.id;
      }
      const allAds = await AdsModel.find(where).select('id').sort({ _id: 'asc' }).lean();
      // console.log(JSON.stringify(where), { allAds });

      if (allAds.length > 0 && _.get(allAds[0], 'id', null) !== null) {
        console.log('assignSellRequest all ads except sys level2---->where 1-----', JSON.stringify({ where, accountId }));
        const adsId = allAds.map(ad => ad.id);
        const randId = adsId[_.random(adsId.length - 1)];
        const availableAds = await AdsModel.findOne({ id: randId }).sort({ _id: 'asc' }).lean();
        response.code = 1;
        response.message = 'Thành công';
        response.data = availableAds;
        return response;
      }
      //#region // nếu có lênh chờ => chọn Lệnh chờ ít nhất
      /*
        // lấy các quảng cáo ACTIVE để chọn accountId, loại trừ các account excepted
        where = {
          status: TradeConstant.ADS_STATUS.ACTIVE,
          type: TradeConstant.ADS_TYPE.SELL,
          $and: [
            { amount: { $gte: amount } }
          ]
        };
        if (levelMatch) {
          where.levelAllowed = { $elemMatch: { $eq: levelMatch } };
        }
        if (exceptedAccountId.length > 0) {
          where.accountId = { $nin: exceptedAccountId };
        }
        const adsInfos = await AdsModel.find(where).sort({ _id: 'asc' }).lean();
        const listAccountAllow = _.map(adsInfos, 'accountId');

        delete cond.accountId;
        cond.$and = [
          { accountId: { $in: listAccountAllow } },
          { accountId: { $ne: systemAccountLevel2.id } }
        ];
        const totalPending = await TradeRequestModel.aggregate([
          {
            $match: cond
          },
          {
            $group: {
              _id: '$accountId',
              count: {
                $sum: 1
              }
            }
          },
          {
            $project: {
              _id: 0,
              accountId: '$_id',
              count: '$count'
            }
          },
          {
            $sort: {
              count: 1 // asc
            }
          }
        ]);
        where.$and = [
          { amount: { $gte: amount } },
          { amount: { $ne: 0 } }
        ];
        if (exceptedAccountId.length > 0) {
          where.$and.push({ accountId: { $nin: exceptedAccountId } });
        }
        console.log({ cond, totalPending, listAccountAllow });

        if (totalPending.length > 0) {
          if (exceptedAccountId.length > 0) {
            const accountIdsPending = _.map(totalPending, 'accountId');
            const allAccountId = _.uniq([...exceptedAccountId, ...accountIdsPending]);
            // const exceptedAccountId = [1, 2, 13, 4, 5, 6, 7];
            // const              arrr = [1, 2, 13, 4, 5, 6, 7, 12, 14]; => 12
            // const accountId = newArr[exceptedAccountId.length];
            const accountIdSelected = allAccountId[exceptedAccountId.length];
            console.log('assignSellRequest filter accountIdSelected ====>', JSON.stringify({ exceptedAccountId, accountIdsPending, allAccountId }));
            if (accountIdSelected) {
              where.accountId = accountIdSelected;
            }
            else { // loại trừ các account nhưng pending chỉ gồm các account đã loại trừ
              response.message = 'Không tìm thấy quảng cáo phù hợp';
              return response;
            }
          } else {
            where.accountId = totalPending[0].accountId;
          }

          console.log('Lệnh chờ ít nhất assignSellRequest ---->where ', JSON.stringify({ where, accountId }));
          const availableAds = await AdsModel.findOne(where).sort({ _id: 'asc' }).lean();
          if (!availableAds) {
            response.message = 'Không tìm thấy quảng cáo phù hợp';
            return response;
          }
          response.code = 1;
          response.message = 'Thành công';
          response.data = availableAds;
          return response;

        } else { // lấy lệnh của level2 system
        }
        */
      //#endregion
      // lấy lệnh của level2 system
      where = {
        status: TradeConstant.ADS_STATUS.ACTIVE,
        type: TradeConstant.ADS_TYPE.SELL,
        $and: [
          { amount: { $gte: amount } }
        ],
        accountId: systemAccountLevel2.id
      };
      if (levelMatch) {
        where.levelAllowed = { $elemMatch: { $eq: levelMatch } };
      }
      console.log('lấy lệnh của level2 system', JSON.stringify(where));
      const availableAds = await AdsModel.findOne(where).sort({ _id: 'asc' }).lean();
      if (!availableAds) {
        response.message = 'Không tìm thấy quảng cáo phù hợp';
        return response;
      }
      response.code = 1;
      response.message = 'Thành công';
      response.data = availableAds;
      return response;
    } catch (error) {
      console.log(
        'file: ExternalService.js ~ line 14 ~ ExternalService ~ assignSellRequest ~ error',
        error
      );
      response.message = 'Tạo lệnh bán không thành công. Vui lòng thử lại sau';
      return response;
    }
  }
  /**
   *
   * @param { Object } payload {amount: V, transaction: String}
   * @param { Object } tradeRequestInfo
   */
  async minusCommissionSystemUser(payload = { amount: 0, transaction: '' }, tradeRequestInfo, description) {
    const response = {
      message: '',
      code: -1,
      data: null
    };
    console.log('minusCommissionSystemUser___', JSON.stringify({ payload, tradeRequestInfo }));
    try {
      if (payload.amount === 0) {
        // throw new Error('amount Commission không hợp lệ!');
        response.message = 'Amount Commission không hợp lệ!';
        return response;
      }
      if (!payload.transaction) {
        // throw new Error('transaction Commission không hợp lệ!');
        response.message = 'Transaction Commission không hợp lệ!';
        return response;
      }
      if (!tradeRequestInfo || !_.isObject(tradeRequestInfo)) {
        // throw new Error('tradeRequestInfo không hợp lệ!');
        response.message = 'TradeRequestInfo không hợp lệ!';
        return response;
      }
      // -3V bonus của A0 => tính userBalance cho A0

      let commisionA0 = _.toNumber(new Decimal(payload.amount).mul(GeneralConstant.COMMISION_PERCENT).div(100));
      commisionA0 = Math.ceil(commisionA0);
      // check balance A0

      let systemAccountId = null;
      const systemAccount = await AccountModel.findOne({ email: GeneralConstant.SYSTEM_ACCOUNT_EMAIL }).lean();
      if (systemAccount) systemAccountId = systemAccount.id;
      const systemUser = await GetUserBalance({ id: systemAccountId });
      console.log('minusCommissionSystemUser-----', { 'systemUser.availableBalance': systemUser.availableBalance, commisionA0 });
      if (systemUser.availableBalance < commisionA0) {
        // throw { message: 'Không thể cập nhật commision cho các cấp user' };
        response.message = 'Không thể trừ commision của A0';
        return response;
      }
      // -3V của A0
      const systemUserCreate = await UserBalanceService.minusBalance(
        systemAccountId,
        commisionA0,
        description,
        tradeRequestInfo,
        GeneralConstant.SOURCE_NAME.COMMISION
      );
      console.log('Trừ commision  => systemUserCreate', JSON.stringify(systemUserCreate));
      if (systemUserCreate.code !== 1) {
        response.message = `Trừ commision thất bại. ${systemUserCreate.data.message}`;
        return response;
        // systemUserCreate.code = -1;
        // throw { message: `Trừ commision thất bại. ${systemUserCreate.data.message}` };
      }
      // await CommisionModel.updateOne({ id: commissionA0.id }, { $set: { status: TradeConstant.COMMISION_STATUS.SUCCEEDED } });
      response.message = 'Thanh toán commision thành công';
      response.code = 1;
      return response;
    } catch (error) {
      response.message = error.message;
    }
    return response;
  }

  /**
   *
   * @param { Object } payload {amount: V, transaction: String}
   * @param { Object } tradeRequestInfo lệnh sell
   */
  async addCommissionUser(payload = { amount: 0, transaction: '' }, tradeRequestInfo, type, description) {
    const response = {
      message: '',
      code: -1,
      data: null
    };
    try {
      if (payload.amount === 0) { // tính bằng v
        response.message = 'Amount không hợp lệ';
        return response;
      }
      if (!payload.transaction) {
        response.message = 'Transaction không hợp lệ';
        return response;
      }
      if (!tradeRequestInfo || !_.isObject(tradeRequestInfo)) {
        response.message = 'TradeRequestInfo không hợp lệ';
        return response;
      }
      let commisionA0 = _.toNumber(new Decimal(payload.amount).mul(GeneralConstant.COMMISION_PERCENT).div(100));
      commisionA0 = Math.ceil(commisionA0);
      // cộng 0.2% Commision cho account bán V => là user A2
      let commisionA2 = _.toNumber(new Decimal(payload.amount).mul(GeneralConstant.COMMISION_PERCENT_LEVEL2).div(100));
      commisionA2 = Math.ceil(commisionA2);
      // check balance A2
      const userBalanceA2 = await GetUserBalance({ id: tradeRequestInfo.accountId });
      const commissionSeller = await CommisionModel.create({
        transaction: payload.transaction,
        accountId: tradeRequestInfo.accountId,
        sourceName: GeneralConstant.SOURCE_NAME.TRADE,
        status: TradeConstant.COMMISION_STATUS.SUCCEEDED,
        amount: commisionA2,
        adsId: tradeRequestInfo.adsId,
        tradeId: tradeRequestInfo.id,
        description,
        type,
        extraData: {
          tradeRequestInfo
        }
      });

      const userBalanceSellerCreate = await UserBalanceService.addBalance(
        commissionSeller.accountId,
        commisionA2,
        description,
        commissionSeller,
        GeneralConstant.SOURCE_NAME.COMMISION
      );
      if (userBalanceSellerCreate.code !== 1) {
        // TODO
        // await TradeRequestModel.updateOne(
        //   { id: buyerTradeRequestInfo.id },
        //   {
        //     status: TradeConstant.TRADE_STATUS.FAILED
        //   }
        // );
        response.message = 'Cộng commision cho seller thất bại';
        return response;
      }
      // cộng 0.1% Commision cho C1 của user Bán V
      /// tìm A1 của A2
      const accountA2 = await AccountModel.findOne({ id: tradeRequestInfo.accountId }).lean();
      if (!accountA2 || !accountA2.parentId) {
        // lấy account A1 default
        const userA1Info = await AccountModel.findOne({ email: _.trim(GeneralConstant.SYSTEM_ACCOUNT_LEVEL1) }).lean();
        console.log(`cấp 1 nhận commision: BuyerAccountId: ${tradeRequestInfo.accountId}, email default: ${GeneralConstant.SYSTEM_ACCOUNT_LEVEL1}`, JSON.stringify({ accountA2, userA1Info, tradeRequestInfo }));
        if (_.get(userA1Info, 'id', null) === null) {
          console.log(`Không tìm thấy account cấp 1 nhận commision: BuyerAccountId: ${tradeRequestInfo.accountId}, email default: ${GeneralConstant.SYSTEM_ACCOUNT_LEVEL1}`, JSON.stringify({ accountA2, userA1Info, tradeRequestInfo }));
          response.message = `Không tìm thấy account cấp 1 nhận commision: BuyerAccountId: ${tradeRequestInfo.accountId}`;
          return response;
        }
        accountA2.parentId = _.get(userA1Info, 'id', 0);
        // console.log(`cấp 1 nhận commision: BuyerAccountId: ${tradeRequestInfo.accountId}`, JSON.stringify({ accountA2, userA1Info, tradeRequestInfo }));
      }
      console.log(`cấp 1 nhận commision: A2 Account`, JSON.stringify({ accountA2, tradeRequestInfo }));

      // const commisionA1 = _.toNumber(new Decimal(payload.amount).mul(GeneralConstant.COMMISION_PERCENT_LEVEL1).div(100)).toFixed(2);
      const commisionA1 = _.toNumber(new Decimal(commisionA0).minus(commisionA2));
      // check balance A1
      // const userBalanceA1 = await GetUserBalance(userA1Info);
      const commissionA1 = await CommisionModel.create({
        transaction: payload.transaction,
        accountId: accountA2.parentId,
        sourceName: GeneralConstant.SOURCE_NAME.TRADE,
        status: TradeConstant.COMMISION_STATUS.SUCCEEDED,
        amount: commisionA1,
        adsId: tradeRequestInfo.adsId,
        tradeId: tradeRequestInfo.id,
        type,
        description,
        extraData: {
          tradeRequestInfo
        }
      });

      const userBalanceA1Create = await UserBalanceService.addBalance(
        commissionA1.accountId,
        commissionA1.amount,
        description,
        commissionA1,
        GeneralConstant.SOURCE_NAME.COMMISION
      );
      if (userBalanceSellerCreate.code !== 1) {
        // TODO
        // await TradeRequestModel.updateOne(
        //   { id: buyerTradeRequestInfo.id },
        //   {
        //     status: TradeConstant.TRADE_STATUS.FAILED
        //   }
        // );
        response.message = 'Cộng commision cho user level 1 thất bại';
        return response;
      }
      response.message = 'Cộng commision thành công';
      response.code = 1;
      return response;
    } catch (error) {
      response.message = error.message;
    }
    return response;
  }

  async checUserOverDailyLimit(accountId, changed = '+') {
    const createDate = moment(new Date()).tz('Asia/Ho_Chi_Minh');
    const startOfDay = MomentTimezone(createDate).startOf('day');
    const endOfDay = MomentTimezone(createDate).endOf('day');

    const condition = {
      accountId,
      state: TradeConstant.TRADE_STATUS.SUCCEEDED,
      amount: changed > 0 ? { $gte: 0 } : { $lte: 0 }
    };
    condition.createdAt.$gte = new Date(startOfDay);
    condition.createdAt.$lte = new Date(endOfDay);

    const report = await UserBalanceModel.aggregate([
      { $match: condition },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          total: '$total',
          count: '$count'
        }
      }
    ]);
    if (!_.isEmpty(report)) {
      const userHistoryData = report[0];
      if (userHistoryData.total > GeneralConstant.TRANSACTION_LIMIT.LEVEL1_DAY_LIMIT_AMOUNT.MAX) {
        // const monitorData = {
        //   rule: `DAILY_USER_TRANSACTION_OVER_LIMIT_${FrontendConstant.USER_TRANSACTION_MONEY_LIMIT.DAY_LIMIT}_DAY`,
        //   tags: [`#${accountId}`],
        //   source: 'API',
        //   type: 'WALLET',
        //   message: `Tài khoản ${accountId} có hơn 100 Triệu VND giao dịch trong ngày`
        // };
        // const monitorCreate = await MonitorModel.create(monitorData);
        // if (!monitorCreate) {
        //   console.log('Monitor', `Monitor Created Failed : ${JSON.stringify(monitorData)}`);
        // } else {
        //   const alertMsg = `❗Tài khoản ${accountId} có hơn 100 Triệu VND giao dịch trong ngày
        //     \nmonitorData Failed: ${JSON.stringify(monitorData)}`;
        //   console.log(alertMsg);
        //   NotifyService.SendAlertNotify(alertMsg, [], ['riskAlert']);
        // }
      }
    }
  }
}

module.exports = new ExternalService();
