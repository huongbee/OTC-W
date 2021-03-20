const AccountModel = require('project/models/AccountModel');
const ResponseCode = require('project/constants/ResponseCode');
const AsyncForEach = require('await-async-foreach');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');
const ScopeGroupModel = require('project/models/ScopeGroupModel');
const AuthorizedScope = require('project/helpers/AuthorizedScope');

module.exports = async (request, reply) => {
  try {
    const accountInfo = request.auth.accountInfo;
    if (!AuthorizedScope(accountInfo.scope, [GeneralConstant.ACCOUNT_SCOPE.USERS])) {
      return reply.api({
        message: 'Bạn không có quyền thực hiện'
      }).code(ResponseCode.REQUEST_FAIL);
    }
    const { filter: { accountType = null, searchQuery, isActive },
      paging: { start, limit },
      sort } = request.payload;

    const where = {};

    if (accountType !== null) {
      if (_.isArray(accountType)) {
        where.accountType = { $in: accountType };
      } else {
        where.accountType = accountType;
      }
    }
    if (searchQuery) {
      where.$or = [
        { email: _.trim(searchQuery).toLowerCase() },
        { phone: _.trim(searchQuery).toLowerCase() }
      ];
    }
    if (_.isBoolean(isActive)) where.isActive = isActive;
    if (_.isEmpty(sort)) sort.id = -1;
    // console.log('search account....', JSON.stringify(where));

    const accounts = await AccountModel.aggregate([
      {
        $match: where
      },
      {
        $lookup: {
          from: 'Balance',
          pipeline: [
          ],
          as: 'balances'
        }
      },
      {
        $unwind: '$balances'
      },
      {
        $addFields: {
          balance: {
            $cond:
              [
                { $eq: ['$balances.accountId', '$id'] },
                '$balances.balance',
                0
              ]
          }
        }
      },
      {
        $unset: ['_id', 'balances']
      },
      {
        $group: {
          _id: '$id',
          balance: { $sum: '$balance' },
          'doc': { '$first': '$$ROOT' }
        }
      },
      {
        $replaceRoot:
        {
          'newRoot':
          {
            $mergeObjects: ['$doc', { balance: '$balance' }]
          }
        }
      },
      {
        $project: {
          id: 1,
          avatar: 1,
          fullname: 1,
          email: 1,
          phone: 1,
          accountType: 1,
          isActive: 1,
          createdAt: 1,
          balance: 1,
          parentId: 1,
          scope: 1
        }
      }
    ]).skip(start)
      .limit(limit)
      .sort(sort);
    // console.log(JSON.stringify(accounts));
    const allScopeGroup = [];
    accounts.map(account => {
      if (_.isArray(account.scope)) allScopeGroup.push(...account.scope);
    });
    const scopesGroup = await ScopeGroupModel.find({
      id: { $in: _.uniq(allScopeGroup) }
    }).select('-_id id name description scopes').lean();

    const result = [];
    await AsyncForEach(accounts, async (account) => {
      if (!account.parentId) account.parentEmail = '';
      else {
        const accountParent = await AccountModel.findOne({ id: account.parentId }).lean();
        account.parentEmail = _.get(accountParent, 'email', '');
      }
      account.scope = scopesGroup.filter(scope => _.includes(account.scope, scope.id));
      result.push(account);
    }, 'parallel', 1);
    const total = await AccountModel.countDocuments(where);

    return reply.api({
      total: total,
      items: result
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};