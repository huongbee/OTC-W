/* eslint-disable no-undef */
const host = 'http://0.0.0.0:3001';
const RequestService = require('project/services/RequestService');
const sha256 = require('sha256');
const mongoose = require('mongoose');
const TradeRequestSchema = require('project/models/TradeRequestModel').attributes;
const TradeRequestModel = mongoose.model('TradeRequest', TradeRequestSchema);
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });

// -	User phải đăng nhập hệ thống để thực hiện các giao dịch.
describe('Trade', () => {
  test('Authorization before trade > None login', async (done) => {
    const result = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    });
    expect(result.code).toBe(401);
    expect(result.data.message).toBe('Vui lòng đăng nhập');
    await TradeRequestModel.deleteMany({ transaction: result.data.transaction });
    done();
  });

  test('Authorization before trade > Logged in', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);

    const result = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    }, { authorization: resultLogin.data.accessToken });
    expect(result.code).toBe(1000);
    expect(result.data.transaction).toBeTruthy();

    // -	Khi có giao dịch xảy ra, hệ thống phải tạo một mã giao dịch duy nhất và không được trùng với mã giao dịch đã tồn tại.
    const checkUniq = await TradeRequestModel.countDocuments({ transaction: result.data.transaction, type: 'SELL' });
    expect(checkUniq).toBe(1);

    // reset
    const resultCancelTrade = await RequestService.requestDelete(host, `/test/v1/trade-request/${result.data.transaction}/SELL`, {}, {
      authorization: resultLogin.data.accessToken
    });
    expect(resultCancelTrade.code).toBe(1000);
    done();
  });
  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});