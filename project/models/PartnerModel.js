const Mongoose = require('mongoose');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Partner',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    title: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: null
    },
    accountId: {
      type: Number,
      required: true
    },
    // token: {
    //   type: String,
    //   default: null
    // },
    isActive: {
      type: Boolean,
      default: true
    }
  }, {
    timestamps: true
  })
};
Model.attributes.index({ id: 1 });
module.exports = Model;
