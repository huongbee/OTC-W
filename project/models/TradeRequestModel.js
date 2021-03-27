const Mongoose = require('mongoose');
const _ = require('lodash');
const Moment = require('moment');
const TradeConstant = require('../constants/TradeConstant');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'TradeRequest',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    adsId: {
      type: Number,
      required: true
    },
    transaction: {
      type: String,
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
    description: { // mô tả đon hàng của đối tác gửi qua
      type: String,
      default: null
    },
    accountId: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: _.values(TradeConstant.TRADE_TYPE)
    },
    status: {
      type: String,
      enum: _.values(TradeConstant.TRADE_STATUS)
    },
    amount: { //  số V muốn mua/bán
      type: Number,
      required: true,
      default: 0
    },
    feeAmount: { // fee GD mua/bán tính bằng V
      type: Number,
      default: 0
    },
    totalAmount: { // số V có fee (tính bằng V)
      type: Number,
      default: 0
    },
    filledAmount: { //  số V thực đã bán/mua
      type: Number,
      required: true,
      default: 0
    },
    amountConfirmReceived: {
      type: Number,
      default: null
    },
    value: { // số VND tương ứng với amount V theo tỉ lệ
      type: Number,
      required: true,
      default: 0
    },
    fee: { // fee GD tính bằng VND
      type: Number,
      default: 0
    },
    totalValue: { // số VND + fee
      type: Number,
      required: true,
      default: 0
    },
    filledValue: { // số VND tương ứng với filledAmount V theo tỉ lệ
      type: Number,
      required: true,
      default: 0
    },
    valueConfirmReceived: {
      type: Number,
      default: null
    },
    paymentType: {
      type: String,
      enum: _.values(TradeConstant.PAYMENT_TYPE)
    },
    extraData: {},
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
    expiredAt: {
      type: Date,
      default: Moment(new Date()).add(15, 'minutes')
    },
    claim: {
      status: {
        type: String,
        enum: _.values(TradeConstant.CLAIM_STATUS)
      },
      sentAt: Date,
      reason: String,
      accountId: Number,
      proofImage: String
    },
    ipnUrl: String,
    sentIpn: {
      isSentIPN: {
        type: Boolean,
        default: false
      },
      count: {
        type: Number,
        default: 0
      }
    },
    proof: {
      filePath: {
        type: String,
        default: null
      },
      sentAt: Date,
      isWaiting: {
        type: Boolean,
        default: null
      },
      expiredAt: Date
    },
    changedStatus: [{
      from: {
        type: String,
        enum: _.values(TradeConstant.TRADE_STATUS)
      },
      to: {
        type: String,
        enum: _.values(TradeConstant.TRADE_STATUS)
      },
      reason: String,
      accountAction: Number,
      updatedAt: {
        type: Date,
        default: null
      }
    }],
    sentNotification: {
      after5mins: {
        type: Boolean,
        default: false
      },
      after10mins: {
        type: Boolean,
        default: false
      },
      after15mins: {
        type: Boolean,
        default: false
      },
      after20mins: {
        type: Boolean,
        default: false
      },
      after25mins: {
        type: Boolean,
        default: false
      },
      after60mins: {
        type: Boolean,
        default: false
      },
      after24hours: {
        type: Boolean,
        default: false
      }
    },
    exceptedAccount: {
      type: Array,
      default: []
    },
    acceptedAccountId: { // account id xác nhận nhận lệnh
      type: Number,
      default: null
    },
    proactiveRequest: {
      type: Boolean,
      default: false
    }
  }, {
    collection: 'TradeRequest',
    timestamps: true
  })
};
Model.attributes.index({ transaction: 1, type: 1, id: 1, adsId: 1, accountId: 1 }, { index: true });

module.exports = Model;
