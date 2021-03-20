const Mongoose = require('mongoose');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'BankAccount',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    isDefault: {
      type: Boolean,
      default: false
    },
    swiftCode: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    },
    holder: {
      type: String,
      required: true
    },
    branch: {
      type: String,
      required: true
    },
    area: {
      type: String,
      required: true
    },
    accountId: {
      type: Number,
      required: true
    }
  }, {
    timestamps: true
  })
};

Model.attributes.index({ accountId: 1 });

module.exports = Model;