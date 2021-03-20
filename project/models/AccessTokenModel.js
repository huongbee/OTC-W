const Mongoose = require('mongoose');
const Moment = require('moment');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'AccessToken',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    accountId: {
      type: Number,
      required: true
    },
    expiredAt: {
      type: Date,
      default: Moment(new Date()).add(30, 'days')
    },
    platform: {
      type: String,
      default: null
    }
  }, {
    timestamps: true
  })
};
Model.attributes.index({ accountId: 1, apiKey: 1, isExpired: 1 });
module.exports = Model;
