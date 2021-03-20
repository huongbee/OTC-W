const ScopeGroupModel = require('project/models/ScopeGroupModel');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');

module.exports = async (accountScopeGroupIds, scopesAllowed = []) => {
  scopesAllowed.push(GeneralConstant.ACCOUNT_SCOPE.ROOT);
  const userScopes = await ScopeGroupModel.find({ id: { $in: accountScopeGroupIds } }).select('-_id scopes').lean();
  if (!userScopes || userScopes.length <= 0) {
    return false;
  }
  if (_.intersection(userScopes.scopes, _.uniq(scopesAllowed)).length <= 0) {
    return false;
  }
  return true;
};