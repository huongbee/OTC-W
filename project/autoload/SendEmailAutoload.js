module.exports = {
  isActive: true,
  onLoad: async () => {
    const app = require('..').getInstance();
    const logger = app.log4js.getLogger('default');
    require('project/worker/SendEmail').Init();
    logger.debug('SendEmailWorker is running....');
  }
};
