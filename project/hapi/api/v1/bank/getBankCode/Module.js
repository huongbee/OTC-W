const _ = require('lodash');
const ResponseCode = require('project/constants/ResponseCode');
const BankCode = require('project/constants/BankConstant');

module.exports = async (request, reply) => {
  try {
    let banks = _.clone(BankCode);
    banks = banks.map((element) => {
      if (element.isActive === true) {
        return {
          id: element.id,
          en: element.en,
          vi: element.vi,
          shortName: element.shortName,
          swiftCode: element.swiftCode
        };
      }
      return null;
    }).filter(v => v !== null);
    return reply.api({ items: banks }).code(ResponseCode.REQUEST_SUCCESS);
  } catch (error) {
    throw error;
  }
};
