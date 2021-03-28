/* eslint-disable no-undef */
const mongoose = require('mongoose');
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const RequestService = require('project/services/RequestService');
const host = 'http://0.0.0.0:3001';
const sha256 = require('sha256');

// -	Khi KH tạo giao dịch BÁN, yêu cầu số dư Q tối thiểu phải lớn hơn hoặc bằng số Q cần bán và số Q trả cho phí giao dịch.
describe('Trade', () => {
  test('Balance must be greater than or equal amount trade >> SUCCEEDED', async (done) => {

    // lấy thông tin số dư
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    const resultBalance = await RequestService.requestGet(host, '/v1/user/balance', {}, { authorization: resultLogin.data.accessToken });
    expect(resultBalance.code).toBe(1000);

    const availableBalance = resultBalance.data.data.availableBalance;
    const amountTrade = 1000000;
    const fee = amountTrade * (0.3 / 100); // fee = 3% amount
    if (availableBalance >= (amountTrade + fee)) { // nếu lớn hơn thì được phép tạo GD
      const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
        amount: amountTrade
      }, { authorization: resultLogin.data.accessToken });
      expect(resultEndpoint.code).toBe(1000);
      // huy Trade
      const resultCancelTrade = await RequestService.requestDelete(host, `/test/v1/trade-request/${resultEndpoint.data.transaction}/SELL`, {}, {
        authorization: resultLogin.data.accessToken
      });
      expect(resultCancelTrade.code).toBe(1000);
    } else { /// nếu ko đủ balance nhưng vẫn tạo GD => throw error
      const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
        amount: amountTrade
      }, { authorization: resultLogin.data.accessToken });
      expect(resultEndpoint.code).toBe(1001);
      expect(resultEndpoint.data.message).toBe('Không đủ số V trong tài khoản');
    }
    done();
  });

  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});