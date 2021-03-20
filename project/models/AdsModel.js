const Mongoose = require('mongoose');
const _ = require('lodash');
const TradeConstant = require('project/constants/TradeConstant');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Ads_Temp',
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
    transaction: {
      type: String,
      required: true,
      unique: true
    },
    amount: {
      type: Number,
      required: true
    },
    value: { type: Number, default: 0 },
    minAmount: {
      type: Number,
      default: 0
    },
    filledAmount: {
      type: Number,
      default: 0
    },
    filledValue: { type: Number, default: 0 },
    type: {
      type: String,
      enum: _.values(TradeConstant.ADS_TYPE)
    },
    status: {
      type: String,
      enum: _.values(TradeConstant.ADS_STATUS),
      default: TradeConstant.ADS_STATUS.ACTIVE
    },
    paymentType: {
      type: String,
      enum: _.values(TradeConstant.PAYMENT_TYPE)
    },
    paymentInfo: {
      content: {
        type: String
      },
      swiftCode: {
        type: String
      },
      bankName: {
        type: String
      },
      accountNumber: {
        type: String
      },
      holder: {
        type: String,
        default: null
      },
      branch: String
    },
    levelAllowed: [Number]
  }, {
    timestamps: true
  }
  )
};
Model.attributes.index({ transaction: 1, accountId: 1, type: 1, id: 1 });

module.exports = Model;
