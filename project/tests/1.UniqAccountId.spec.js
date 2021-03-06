/* eslint-disable no-undef */
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

// -	Mỗi user khi đăng kí sẽ được cấp một mã tài khoản duy nhất.
describe('Account', () => {
  const username = randomString();
  test('Unique AccountId', async (done) => {
    const result = await RequestService.requestPost(host, '/v1/account/register', {
      username,
      email: username + '@gmail.com',
      phone: '0332967751',
      password: sha256('111111'),
      fullname: username.toUpperCase(),
      gender: 'OTHER',
      birthday: moment(new Date())
    });
    expect(result.data.id).toBeTruthy();
    const checkUniq = await AccountModel.countDocuments({ id: _.toNumber(result.data.id) });
    expect(checkUniq).toBe(1);
    done();
  });
  afterEach(async () => {
    await AccountModel.deleteOne({ username });
  });
  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});