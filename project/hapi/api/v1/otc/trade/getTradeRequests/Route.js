const ResponseCode = require('project/constants/ResponseCode');
const TradeConstant = require('project/constants/TradeConstant');
const _ = require('lodash');
const Joi = require('mecore').Joi;

module.exports = [
  {
    method: 'POST',
    path: '/v1/trade-request/list',
    handler: require('./Module'),
    options: {
      description: 'Lấy danh sách giao dịch',
      validate: {
        payload: Joi.object({
          filter: Joi.object({}),
          paging: {
            start: Joi.number().required().example(0).default(0)
              .description('Số bắt đầu'),
            limit: Joi.number().required().example(10).max(1000)
              .default(100)
              .description('Số dòng trên 1 trang')
          },
          sort: Joi.object({}).default({ updatedAt: -1 }).description('Sort field')
        })
      },
      tags: ['api', 'v1'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.object({
            message: Joi.string().example('Thành công').description('Lấy danh sách giao dịch thành công'),
            data: Joi.array().items(Joi.object()),
            totalRecords: Joi.number().example('1000').description('Tổng records')
          }).description('Thành công'),
          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Thất bại').description('Lấy danh sách giao dịch thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];