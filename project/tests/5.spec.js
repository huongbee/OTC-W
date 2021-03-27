/* eslint-disable no-undef */
const host = 'http://0.0.0.0:3001';
const RequestService = require('project/services/RequestService');
const sha256 = require('sha256');
const mongoose = require('mongoose');
const TradeRequestSchema = require('project/models/TradeRequestModel').attributes;
const TradeRequestModel = mongoose.model('TradeRequest', TradeRequestSchema);
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });

// TODO;
// -	Khi khách hàng tạo giao dịch BÁN, phải có ít nhất 1 quảng cáo MUA phù hợp của đại lý cấp 2 để khớp lệnh.
describe('Trade', () => {
  test('Without Ads > Throw Error', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3.2@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    // cập nhật các quảng cáo INACTIVE
    await TradeRequestModel.updateMany(
      { levelMatch: 3 },
      { $set: { status: 'INACTIVE' } }
    );

    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1001);
    expect(resultEndpoint.data.message).toBe('Không tìm thấy quảng cáo phù hợp');

    await TradeRequestModel.deleteMany({ transaction: resultEndpoint.data.transaction });
    await TradeRequestModel.updateMany(
      { levelMatch: 3 },
      { $set: { status: 'ACTIVE' } }
    );
    done();
  });
  test('Exists Ads >>Trade success', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3.2@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();

    //TODO kiem tra có quảng cáo phù hợp

    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1001);
    expect(resultEndpoint.data.message).toBe('Không tìm thấy quảng cáo phù hợp');

    await TradeRequestModel.deleteMany({ transaction: resultEndpoint.data.transaction });
    done();
  });
  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});