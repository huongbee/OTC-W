/* eslint-disable no-undef */
const host = 'http://0.0.0.0:3001';
const RequestService = require('project/services/RequestService');
const sha256 = require('sha256');
const mongoose = require('mongoose');
const AdsSchema = require('project/models/AdsModel').attributes;
const AdsModel = mongoose.model('Ads_Temp', AdsSchema);
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });

// -	-	Số Q cho một giao dịch BÁN tối thiểu là 10.000 và đối đa là 100.000.000
describe('Trade', () => {
  test('Amount < 10.000 > Throw Error', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 9999
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1001);
    expect(resultEndpoint.data.message).toBe('Số V giao dịch không phù hợp');

    done();
  });
  test('Amount > 100.000.000 >>  Throw Error', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 100000001
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1001);
    expect(resultEndpoint.data.message).toBe('Số V giao dịch không phù hợp');
    done();
  });
  test('10.000 <= Amount <=100.000.000 >> Success', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    // tạo quảng cáo để khhớp lệnh nếu ko có
    const countActive = await AdsModel.countDocuments({ levelAllowed: 3, status: 'ACTIVE' });
    let adsId = 0;
    let tokenLevel2Login = null;
    if (countActive <= 0) {
      // level 2 tạo QC cho level 3 khớp lệnh
      // level 2 login
      const resultLevel2Login = await RequestService.requestPost(host, '/v1/account/login', {
        account: 'huong.lv2@gmail.com',
        password: sha256('111111')
      });
      expect(resultLevel2Login.code).toEqual(1000);
      const createAds = await RequestService.requestPost(host, '/v1/announcement', {
        amount: 10000000,
        type: 'BUY',
        paymentType: 'BANKTRANSFER'
      }, { authorization: resultLevel2Login.data.accessToken });
      expect(createAds.code).toEqual(1000);
      adsId = createAds.data.adsId;
      tokenLevel2Login = resultLevel2Login.data.accessToken;
    }

    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10001
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1000);

    const resultCancelTrade = await RequestService.requestDelete(host, `/test/v1/trade-request/${resultEndpoint.data.transaction}/SELL`, {}, {
      authorization: resultLogin.data.accessToken
    });
    expect(resultCancelTrade.code).toBe(1000);

    if (countActive <= 0 && adsId !== 0) {
      //hủy ADS
      const cancelAds = await RequestService.requestDelete(host, `/v1/announcement/${adsId}`, {}, { authorization: tokenLevel2Login });
      expect(cancelAds.code).toEqual(1000);
    }

    done();
  });
  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});