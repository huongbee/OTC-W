const InteractionHistoryModel = require('project/models/InteractionHistoryModel');

/**
 * Tạo mới 1 record thông tin lịch sử tương tác
 * @param { Date } interactedAt
 * @param { String } username
 * @param { String } email
 * @param { String } ip
 * @param { String } action
 * @param { String } result
 * @param { String } userAgent
 * @param { Object } referData
 */

const Service = async ({ accountId, interactedAt, username, email, ip, action, result, userAgent, referData, objectTransaction, objectName, flatform }) => {
  const createdRecord = await InteractionHistoryModel.create({
    accountId,
    interactedAt,
    username,
    email,
    ip,
    action,
    result,
    userAgent,
    object: {
      transaction: objectTransaction,
      name: objectName
    },
    flatform,
    referData
  });

  if (!createdRecord) {
    return false;
  }

  return true;
};

module.exports = Service;