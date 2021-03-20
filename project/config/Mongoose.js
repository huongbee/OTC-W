module.exports = {
  w_otc: {
    uri: 'mongodb://localhost:27017/otc_w_prod',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true
    }
  }
};
