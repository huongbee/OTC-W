const Mongoose = require('mongoose');

const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Location',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    id: {
      type: Number,
      autoIncrement: true
    },
    identifyCode: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    parentIdentifyCode: {
      type: String,
      default: null
    },
    parentPath: [
      {
        _id: false,
        identifyCode: {
          type: String,
          required: true
        },
        path: {
          type: String,
          required: true
        },
        title: {
          type: String,
          required: true
        }
      }
    ]
  }, {
    timestamps: true
  })
};

module.exports = Model;
