/* eslint-disable no-undef */
const mongoose = require('mongoose');
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const RequestService = require('project/services/RequestService');
const host = 'http://0.0.0.0:3001';
const sha256 = require('sha256');
const TradeRequestSchema = require('project/models/TradeRequestModel').attributes;
const TradeRequestModel = mongoose.model('TradeRequest', TradeRequestSchema);

//-	-	Giao dịch chỉ được phép thành công khi người bán xác nhận đã nhận tiền VNĐ (10)
describe('Trade', () => {

  test('Trade success if seller confirm received money', async (done) => {
    const resultLogin = await RequestService.requestPost(host, '/v1/account/login', {
      account: 'user.level3@gmail.com',
      password: sha256('111111')
    });
    expect(resultLogin.code).toBe(1000);
    expect(resultLogin.data.accessToken).toBeTruthy();
    // tạo GD
    const resultEndpoint = await RequestService.requestPost(host, '/v1/trade-request/sell', {
      amount: 10000
    }, { authorization: resultLogin.data.accessToken });
    expect(resultEndpoint.code).toBe(1000);

    // xác nhận đã nhận tiền
    const resultTrade = await RequestService.requestPost(host, '/v1/trade-request/confirm_received_vnd', {
      content: 'Đã nhận tiền của người mua',
      transaction: resultEndpoint.data.transaction,
      amount: resultEndpoint.data.amount
    }, {
      authorization: resultLogin.data.accessToken
    });
    expect(resultTrade.code).toBe(1000);

    // kiểm tra trạng thái GD
    const tradeInfo = await TradeRequestModel.findOne({ transaction: resultEndpoint.data.transaction, type: 'SELL' });
    expect(tradeInfo).toBeTruthy();
    expect(tradeInfo.status).toBe('SUCCEEDED');

    done();
  });

  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});