const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const Model = {
  connection: 'w_otc',
  tableName: 'Scope',
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
    }
  }, {
    timestamps: true
  })
};
Model.attributes.index({ id: 1, name: 1 });
module.exports = Model;
