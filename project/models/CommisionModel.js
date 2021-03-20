const Mongoose = require('mongoose');
const _ = require('lodash');
const TradeConstant = require('../constants/TradeConstant');
const GeneralConstant = require('../constants/GeneralConstant');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Commission',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    transaction: {
      type: String,
      required: true
    },
    accountId: {
      type: Number,
      required: true
    },
    partnerId: {
      type: Number,
      default: null
    },
    partnerTransaction: {
      type: String,
      default: null
    },
    type: {
      type: String,
      enum: _.values(GeneralConstant.COMMISION_TYPE)
    },
    sourceName: {
      type: String,
      enum: _.values(GeneralConstant.SOURCE_NAME)
    },
    status: {
      type: String,
      enum: _.values(TradeConstant.COMMISION_STATUS),
      default: TradeConstant.COMMISION_STATUS.PENDING
    },
    amount: { //  số V
      type: Number,
      required: true,
      default: 0
    },
    tradeId: {
      type: Number
    },
    adsId: {
      type: Number
    },
    extraData: Object,
    description: String
  }, {
    timestamps: true
  })
};
module.exports = Model;
