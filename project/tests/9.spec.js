/* eslint-disable no-undef */
const mongoose = require('mongoose');
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const RequestService = require('project/services/RequestService');
const host = 'http://0.0.0.0:3001';
const sha256 = require('sha256');

//-	Giao dịch được phép hủy sau 60p sau khi tạo giao dịch nếu GD vẫn còn pending
describe('Trade', () => {
  test('Trade new >> Can not cancel trade in 60p', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1000);

    const resultCancelTrade = await RequestService.requestDelete(host, `/v1/trade-request/${resultEndpoint.data.transaction}/SELL`, {}, {
      authorization: resultLogin.data.accessToken
    });
    expect(resultCancelTrade.code).toBe(1001);
    expect(resultCancelTrade.data.message).toBe('Chỉ được hủy giao dịch sau 60 phút từ khi tạo giao dịch');

    // huy Trade test
    const resultCancelTradeTest = await RequestService.requestDelete(host, `/test/v1/trade-request/${resultEndpoint.data.transaction}/SELL`, {}, {
      authorization: resultLogin.data.accessToken
    });
    expect(resultCancelTradeTest.code).toBe(1000);

    done();
  });

  test('Trade was created greater than 60min - PENDING >> Can cancel', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    const transaction = '2971656541';
    const resultCancelTrade = await RequestService.requestDelete(host, `/v1/trade-request/${transaction}/SELL`, {}, {
      authorization: resultLogin.data.accessToken
    });
    expect(resultCancelTrade.code).toBe(1000);
    expect(resultCancelTrade.data.message).toBe('Hủy giao dịch thành công');

    done();
  });

  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});