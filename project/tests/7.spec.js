/* eslint-disable no-undef */
const mongoose = require('mongoose');
const TradeRequestSchema = require('project/models/TradeRequestModel').attributes;
const TradeRequestModel = mongoose.model('TradeRequest', TradeRequestSchema);
const AdsSchema = require('project/models/AdsModel').attributes;
const AdsModel = mongoose.model('Ads_Temp', AdsSchema);
const url = 'mongodb://127.0.0.1/otc_w_prod';
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const _ = require('lodash');

// -Số Q trong quảng cáo MUA khi đang có lệnh chờ phải bị khóa một lượng bằng khối lượng của giao dịch đang chờ.
describe('Trade', () => {
  test('Amount Lock equal Amount Pending', async (done) => {

    // lấy thông tin quảng cáo BUY só 2
    const adsId = 2;
    const adsInfo = await AdsModel.findOne({ id: adsId }).lean();
    expect(adsInfo).toBeTruthy();

    // lấy DS các trade của adsId số 2 chưa thành công
    const totalPending = await TradeRequestModel.aggregate([
      {
        $match: { adsId, type: 'BUY', status: { $in: ['PENDING', 'PAID'] } }
      },
      {
        $group: {
          _id: '$adsId',
          total: { $sum: '$amount' }
        }
      },
      {
        $project: {
          _id: 0,
          adsId: '$_id',
          total: '$total'
        }
      }
    ]);

    const valuePublish = adsInfo.value; // số Q phát hành
    const amount = adsInfo.amount;// Số Q còn lại
    const amountLocked = valuePublish - amount;
    const amountPendingInTrade = _.get(totalPending[0], 'total', 0);
    expect(amountPendingInTrade).toEqual(amountLocked);
    done();
  });

  afterAll(async (done) => {
    await mongoose.connection.close();
    done();
  });
});