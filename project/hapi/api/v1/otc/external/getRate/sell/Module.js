const SettingModel = require('project/models/SettingModel');
const ResponseCode = require('project/constants/ResponseCode');

const _ = require('lodash');

module.exports = async (request, reply) => {
  try {
    let sellRate = await SettingModel.findOne({ key: 'RATE_SELL' }).lean();
    sellRate = _.get(sellRate, 'value', null) !== null ? sellRate.value : 1;

    return reply({
      rate: sellRate
    }).code(ResponseCode.REQUEST_SUCCESS);
  }
  catch (err) {
    throw err;
  }
};