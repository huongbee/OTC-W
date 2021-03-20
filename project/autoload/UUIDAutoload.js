
module.exports = {
  isActive: true,
  onLoad: async () => {
    const app = require('..').getInstance();
    const logger = app.log4js.getLogger('default');
    require('project/worker/UUIDGenerate').Init(
      'OTC_ACCOUNT_ID',
      'OTC_ADS_TRANSACTION',
      'TRADE_TRANSACTION_PROD',
      'SYSTEM_CHANGE_BALANCE_PROD' // system withdraw or deposit balance user
    );
    logger.debug('UUID is running....');
  }
};
