const AccountModel = require('project/models/AccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const AdsModel = require('project/models/AdsModel');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const ExternalService = require('project/services/ExternalService');

// chỉ lấy DS quảng cáo của level cha và con của user khóp lệnh
module.exports = async (request, reply) => {
  try {
    const authInfo = request.auth.credentials;
    const userInfo = await AccountModel.findOne({ id: authInfo.accountId }).lean();

    if (_.get(userInfo, 'id', false) === false) {
      return reply.api({
        message: request.__('Không tìm thấy thông tin tài khoản')
      }).code(ResponseCode.REQUEST_FAIL);
    }

    const { filter: { type }, paging: { start, limit }, sort } = request.payload;
    const where = {};

    // where.accountId = { $ne: userInfo.id };
    // - LV1 tạo lệnh mua —> LV0 khớp lệnh
    // - LV1 tạo lệnh bán —> LV2 (con nó) khớp lệnh —> chỉ các LV2 con nó mới có thể nhìn thấy các lệnh của LV1 cha
    // - LV2 tạo lệnh mua-bán —> chỉ khớp với LV3 hoặc LV1 cha nó nhìn thấy và khớp. Các LV2 đồng môn cũng không thấy
    // - LV2 khác địa bàn —> không thấy lệnh của nhau
    const accountId = [];
    if (userInfo.accountType !== 0) {
      // lay account cha
      const parentInfo = await ExternalService.getParentAccountInfo(userInfo.id);
      if (parentInfo) {
        console.log('account cha: ', JSON.stringify(parentInfo));
        accountId.push(parentInfo.id);
      }
      // lay ds account con
      let childAccounts = await AccountModel.find({ parentId: userInfo.id });
      if (childAccounts) {
        childAccounts = childAccounts.map(account => account.id);
        console.log('account connnnn: ', JSON.stringify(childAccounts));
        accountId.push(...childAccounts);
      }
    }
    if (accountId.length > 0) {
      where.accountId = { $in: accountId };
    }

    where.amount = { $gt: 0 };
    where.type = type;
    where.status = TradeConstant.ADS_STATUS.ACTIVE;
    where.levelAllowed = { $elemMatch: { $eq: userInfo.accountType } };
    console.log('get ads hiện có thể khớp trên sàn: where ====>>>', JSON.stringify(where));
    if (_.isEmpty(sort)) sort.id = -1;

    const adsList = await AdsModel.aggregate([
      {
        $match: where
      },
      {
        $lookup: {
          from: 'Account',
          localField: 'accountId',
          foreignField: 'id',
          as: 'owner'
        }
      },
      {
        $unwind: '$owner'
      },
      {
        $project: {
          _id: 0,
          id: 1,
          amount: 1,
          transaction: 1,
          filledAmount: 1,
          filledValue: 1,
          updatedAt: 1,
          createdAt: 1,
          owner: '$owner.fullname',
          paymentType: 1,
          status: 1
        }
      }
    ]).skip(start).limit(limit).sort(sort);

    const total = await AdsModel.countDocuments(where);

    return reply.api({
      total: total,
      data: adsList
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};