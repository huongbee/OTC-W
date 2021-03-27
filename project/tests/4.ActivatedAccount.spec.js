/* eslint-disable no-undef */
const host = 'http://0.0.0.0:3001';
const RequestService = require('project/services/RequestService');
const sha256 = require('sha256');
const mongoose = require('mongoose');
const TradeRequestSchema = require('project/models/TradeRequestModel').attributes;
const TradeRequestModel = mongoose.model('TradeRequest', TradeRequestSchema);
const AccountSchema = require('project/models/AccountModel');
const AccountModel = mongoose.model('Account', AccountSchema.attributes);
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const randomString = require('uniqid');
const moment = require('moment');

//-	Email của user phải được admin xác nhận trước khi thực hiện giao dịch.
describe('Account', () => {
  const email = randomString() + '@gmail.com';
  test('Account must be activated > Throw Error', async (done) => {
    // register new account
    const resultRegister = await RequestService.requestPost(host, '/v1/account/register', {
      username: email,
      email,
      phone: '0332967751',
      password: sha256('111111'),
      fullname: 'Huong Ngoc',
      gender: 'OTHER',
      birthday: moment(new Date())
    });
    expect(resultRegister.code).toBe(1000);
    // login without active
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: resultRegister.data.email,
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1001);
    expect(resultLogin.data.message).toBe('Tài khoản hiện đã bị khoá!');
    done();
  });
  test('Account must be activated > Login success and can trade after Activated Account', async (done) => {
    // register new account
    const resultRegister = await RequestService.requestPost(host, '/v1/account/register', {
      username: email,
      email,
      phone: '0332967751',
      password: sha256('111111'),
      fullname: 'Huong Ngoc',
      gender: 'OTHER',
      birthday: moment(new Date())
    });
    expect(resultRegister.code).toBe(1000);
    expect(resultRegister.data.id).toBeTruthy();

    // admin login
    const resultAdminLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'huongntn@payme.vn',
      password: sha256('111111')
    });
    expect(resultAdminLogin.code).toBe(1000);

    // admin active user account
    const resultActiveAccount = await RequestService.requestPut(host, `/v1/admin/account/${resultRegister.data.id}`, {
      isActive: true,
      accountType: 3
    }, { authorization: resultAdminLogin.data.accessToken });
    expect(resultActiveAccount.code).toBe(1000);
    // user login after active
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: resultRegister.data.email,
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    // -	Mỗi khách hàng giao dịch BÁN phải có cài đặt thông tin ngân hàng để nhận chuyển khoản VNĐ.
    const result = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    }, { authorization: resultLogin.data.accessToken });
    expect(result.code).toBe(1001);
    expect(result.data.message).toBe('Vui lòng thêm thông tin ngân hàng mặc định');

    // cập nhật thông tin bank default
    const resultUpdateBank = await RequestService.requestPost(host, '/v1/bank', {
      accountNumber: '1234567809123',
      swiftCode: 'WBVNVNVX',
      holder: 'Ngọc Hương',
      branch: 'Tân Bình',
      area: 'Hồ chí Minh'
    }, { authorization: resultLogin.data.accessToken });
    expect(resultUpdateBank.code).toBe(1000);
    /// tạo lại GD sau khi đã thêm thông tin ngân hàng mặc định
    // -	Khi user thực hiện lệnh mua, yêu cầu số dư V trong tài khoản phải lớn hơn hoặc bằng lượng giao dịch và phí giao dịch BÁN
    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1001);
    expect(resultEndpoint.data.message).toBe('Không đủ số V trong tài khoản');

    await TradeRequestModel.deleteMany({ transaction: resultEndpoint.data.transaction });
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