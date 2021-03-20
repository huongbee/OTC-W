module.exports = {
  appenders: { 
    console: { type: 'console' }
  }, 
  categories: {
    task: { appenders: ['console'], level: 'all' },
    system: { appenders: ['console'], level: 'all' },
    default: { appenders: ['console'], level: 'all' }
  }
};
