const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'ScopeGroup',
  autoIncrement: {
    id: {
      startAt: 1,
      incrementBy: 1
    }
  },
  attributes: new Schema({
    name: {
      type: String,
      required: true,
      unique: true
    },
    description: {
      type: String,
      default: null
    },
    scopes: [
      {
        _id: false,
        id: Number,
        name: String,
        description: String
      }
    ]
  }, {
    timestamps: true
  })
};
Model.attributes.index({ id: 1, name: 1 });
module.exports = Model;
