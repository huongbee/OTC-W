const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Balance',
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
    balance: {
      type: Number,
      default: 0
    },
    lockBalance: {
      type: Number,
      default: 0
    },
    lock: {
      status: {
        type: Boolean,
        default: false
      },
      reason: {
        type: String,
        default: null
      },
      referData: {
        type: Object
      }
    }
  }, {
    timestamps: true
  })
};

Model.attributes.index({ id: 1, accountId: 1 }, { unique: true });

module.exports = Model;
