const Mongoose = require('mongoose');
const _ = require('lodash');
const GeneralConstant = require('project/constants/GeneralConstant');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Account',
  attributes: new Schema({
    id: {
      type: Number,
      required: true,
      unique: true
    },
    parentId: {
      type: Number,
      default: null
    },
    username: {
      type: String,
      required: true,
      unique: true
    },
    phone: {
      type: String,
      default: null
    },
    contactPhone: {
      type: String,
      default: null
    },
    email: {
      type: String,
      default: null
    },
    password: {
      type: String,
      default: null
    },
    fullname: {
      type: String,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    gender: {
      type: String,
      enum: _.values(GeneralConstant.ACCOUNT_GENDER)
    },
    birthday: {
      type: Date,
      default: null
    },
    address: {
      type: String,
      default: null
    },
    facebook: {
      type: String,
      default: null
    },
    telegram: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastedLoginAt: {
      type: Date,
      default: null
    },
    lastedLogoutAt: {
      type: Date,
      default: null
    },
    countLoginFail: {
      type: Number,
      default: 0
    },
    accountType: {
      type: Number,
      default: GeneralConstant.ACCOUNT_TYPE.LEVEL_2,
      enum: _.values(GeneralConstant.ACCOUNT_TYPE)
    },
    scope: {
      type: Array,
      default: []
    }
  }, {
    collection: 'Account',
    timestamps: true
  })
};
Model.attributes.index({ phone: 1 }, { sparse: true });
Model.attributes.index({ email: 1 }, { sparse: true });
Model.attributes.index({ username: 1 }, { unique: true });
Model.attributes.index({ id: 1, accountType: 1, parentId: 1 });
module.exports = Model;
