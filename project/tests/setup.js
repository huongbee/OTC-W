/* eslint-disable no-undef */
const mongoose = require('mongoose');

module.exports = {
  setupDB(databaseName) {
    // Connect to Mongoose
    beforeAll(async () => {
      const url = `mongodb://127.0.0.1/${databaseName}`;
      await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    });

    // Disconnect Mongoose
    afterAll(async () => {
      await mongoose.connection.close();
    });
  }
};
