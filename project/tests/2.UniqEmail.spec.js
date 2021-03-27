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

// -	Mỗi user có một email duy nhất, không được trùng với email đã tồn tại trong hệ thống
describe('Account', () => {
  const email = randomString() + '@gmail.com';
  test('Unique Email', async (done) => {
    await RequestService.requestPost(host, '/v1/account/register', {
      username: email,
      email,
      phone: '0332967751',
      password: sha256('111111'),
      fullname: 'Huong Ngoc',
      gender: 'OTHER',
      birthday: moment(new Date())
    });
    const checkUniq = await AccountModel.countDocuments({ email });
    expect(checkUniq).toBe(1);
    done();
  });
  test('Unique Email > throw Error existed email', async (done) => {
    const accountExist = await AccountModel.findOne({}).lean();
    const result = await RequestService.requestPost(host, '/v1/account/register', {
      username: accountExist.email,
      email: accountExist.email,
      phone: '0332967751',
      password: sha256('111111'),
      fullname: 'Huong Ngoc',
      gender: 'OTHER',
      birthday: moment(new Date())
    });
    expect(result.code).toBe(1001);
    expect(result.data.message).toBe('Email đã tồn tại');
    done();
  });
  afterEach(async () => {
    await AccountModel.deleteOne({ email });
  });
  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});