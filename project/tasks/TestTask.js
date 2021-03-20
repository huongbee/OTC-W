// # expression
// # ┌────────────── second (optional)
// # │ ┌──────────── minute
// # │ │ ┌────────── hour
// # │ │ │ ┌──────── day of month
// # │ │ │ │ ┌────── month
// # │ │ │ │ │ ┌──── day of week
// # │ │ │ │ │ │
// # │ │ │ │ │ │
// # * * * * * *
const momentTimezone = require('moment-timezone');

module.exports = {
  isActive: false,
  expression: '0 6 * * *',
  options: {
    timeZone: 'Asia/Ho_Chi_Minh',
    runOnInit: true
  },
  onTick: () => {
    const app = require('..').getInstance();
    const logger = app.log4js.getLogger('default');
    logger.debug('Task is running....');
  }
};
