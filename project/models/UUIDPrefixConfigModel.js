const Mongoose = require('mongoose');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');

const Schema = Mongoose.Schema;
const Model = {
  connection: 'w_otc',
  tableName: 'UuidPrefixConfig',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    prefix: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: null
    },
    length: {
      type: Number,
      default: null
    },
    type: {
      type: String,
      enum: _.values(GeneralConstant.PREFIX_CONFIG_TYPE)
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }, {
    timestamps: true
  })
};

Model.attributes.index({ prefix: 1, type: 1 }, { index: true });
module.exports = Model;
