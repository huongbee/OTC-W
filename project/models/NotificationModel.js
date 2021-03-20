const Mongoose = require('mongoose');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Notifications',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    type: {
      type: String,
      enum: ['telegram', 'socket']
    },
    receiver: [String],
    sender: {
      type: String,
      default: 'BOT'
    },
    messageType: {
      type: String,
      enum: _.values(GeneralConstant.NOTIFICATION_TYPE.TELEGRAM),
      default: GeneralConstant.NOTIFICATION_TYPE.TELEGRAM.SEND
    },
    message: {
      accountId: Number,
      transaction: String,
      message_id: Number,
      type: {
        type: String,
        enum: ['photo', 'text', 'document']
      },
      content: {
        type: String
      },
      buttons: [],
      url: {
        type: String
      },
      edited: {
        type: Boolean,
        default: false
      }
    },
    sendTime: {
      type: Date
    },
    remind: {
      type: String,
      default: null
    },
    extraData: Schema.Types.Mixed
  }, {
    timestamps: true
  })
};
module.exports = Model;
