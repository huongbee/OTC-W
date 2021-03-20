const Mongoose = require('mongoose');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');

const Schema = Mongoose.Schema;
const Model = {
  connection: 'w_otc',
  tableName: 'Uuid',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    uuid: {
      type: String,
      required: true
    },
    prefix: {
      type: String,
      required: true
    },
    info: {
      type: Object,
      default: null
    },
    state: {
      type: String,
      enum: _.values(GeneralConstant.UUID_STATE),
      default: GeneralConstant.UUID_STATE.NEW
    }
  }, {
    timestamps: true
  })
};

Model.attributes.index({ uuid: 1, prefix: 1, state: 1 }, { index: true });
module.exports = Model;
