const SettingModel = require('project/models/SettingModel');
const ResponseCode = require('project/constants/ResponseCode');

const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    let buyRate = await SettingModel.findOne({ key: 'RATE_BUY' }).lean();
    buyRate = _.get(buyRate, 'value', null) !== null ? buyRate.value : 1;

    return reply({
      rate: buyRate
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};