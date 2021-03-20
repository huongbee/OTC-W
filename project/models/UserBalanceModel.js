const GeneralConstant = require('project/constants/GeneralConstant');
const _ = require('lodash');
const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'BalanceHistory',
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
    amount: {
      type: Number,
      required: true
    },
    description: String,
    balance: {
      before: { type: Number, default: 0 },
      after: { type: Number, default: 0 }
    },
    refId: {
      type: Number,
      default: null
    },
    refTransaction: {
      type: String,
      default: null
    },
    sourceName: {
      type: String,
      enum: _.values(GeneralConstant.SOURCE_NAME)
    },
    referData: Object
  }, {
    timestamps: true
  })
};
Model.attributes.index({ id: 1, accountId: 1, refId: 1, refTransaction: 1, sourceName: 1 }, { index: true });
Model.attributes.index({ accountId: 1, refTransaction: 1, sourceName: 1, amount: 1 }, { unique: true });

module.exports = Model;
