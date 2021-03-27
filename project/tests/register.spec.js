/* eslint-disable no-undef */
const axios = require('axios');
const host = 'http://0.0.0.0:3001';
const randomString = require('uniqid');
const sha256 = require('sha256');
const mongoose = require('mongoose');
const moment = require('moment');
const AccountSchema = require('project/models/AccountModel');
const AccountModel = mongoose.model('Account', AccountSchema.attributes);
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const RequestService = require('project/services/RequestService');
const _ = require('lodash');

describe('Account', () => {
  const username = randomString();
  test('Unique AccountId', async () => {
    const result = await RequestService.requestPost(host, '/v1/account/register', {
      username,
      email: username + '@gmail.com',
      phone: '0332967751',
      password: sha256('111111'),
      fullname: username.toUpperCase(),
      gender: 'OTHER',
      birthday: moment(new Date())
    });
    const checkUniq = await AccountModel.countDocuments({ id: _.toNumber(result.data.id) });
    expect(checkUniq).toBe(1);
  });
  afterEach(async () => {
    await AccountModel.deleteOne({ username });
  });
});