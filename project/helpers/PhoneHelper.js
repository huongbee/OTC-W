const _ = require('lodash');
const PhoneConstant = require('../constants/PhoneConstant');

class PhoneHelper {
  format(input, country = '84') {
    return String(input)
      .replace(/[^+0-9]/g, '')
      .replace(/^00/, '+')
      .replace(/^0/, country);
  }

  /**
   *
   * @param {*} phone  : 090*,093*...;
   */
  validatePhone(phone) {
    const result = {
      phone: this.format(phone),
      telco: null,
      isValid: false
    };
    if ((result.phone).length !== 11 || isNaN(result.phone) === true) {
      return result;
    }
    const telco = _.findKey(PhoneConstant, (v) => { return _.includes(v, (_.replace(result.phone, '84', '0')).substring(0, 3)) || null; });
    if (!telco) {
      return result;
    }
    result.telco = telco.toLowerCase();
    result.isValid = true;
    return result;
  }
}
module.exports = PhoneHelper;
