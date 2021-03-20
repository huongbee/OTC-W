const Mongoose = require('mongoose');
const _ = require('lodash');

const FrontendConstant = require('project/constants/GeneralConstant');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Setting',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    key: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: _.values(FrontendConstant.SETTING_TYPE),
      default: FrontendConstant.SETTING_TYPE.STRING
    },
    value: {
      type: Schema.Types.Mixed,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      default: 'Mô tả'
    }
  }, {
    timestamps: true
  })
};
Model.attributes.index({ key: 1 }, { unique: true });

module.exports = Model;
