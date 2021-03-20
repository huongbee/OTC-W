const MeCore = require('mecore');
require('tls').DEFAULT_MIN_VERSION = 'TLSv1';

const instanceName = 'w_otc';
const meCore = new MeCore(instanceName, __dirname);

meCore.Start();

module.exports.getInstance = () => {
  return MeCore.getInstance(instanceName);
};