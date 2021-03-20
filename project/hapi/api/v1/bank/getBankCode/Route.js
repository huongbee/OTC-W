const Joi = require('mecore').Joi;
const Code = require('project/constants/ResponseCode');

module.exports = [
  {
    method: 'POST',
    path: '/v1/bank/bank_code',
    handler: require('./Module'),
    options: {
      auth: false,
      description: 'Lấy full DS ngân hàng',
      validate: {
        payload: Joi.object({
        })
      },
      tags: ['api', 'v1', 'bank code'],
      response: {
        status: {
          [Code.REQUEST_SUCCESS]: Joi.object({
            items: Joi.array().items(Joi.object({
              id: Joi.string().allow(null, '').example('0').description('Id'),
              en: Joi.string().allow(null, '').example('Vietnam Public Joint Stock Commercial Bank (PVcomBank)').description('Tên tiếng anh'),
              vi: Joi.string().allow(null, '').example('TMCP Đại Chúng Việt Nam (PVcomBank)').description('Tên tiếng việt'),
              shortName: Joi.string().allow(null, '').example('PVcomBank').description('shortName'),
              swiftCode: Joi.string().allow(null, '').example('WBVNVNVX').description('swiftCode')
            }))
          }).description('Thành công'),
          [Code.REQUEST_FAIL]: Joi.object({
            message: Joi.string()
              .example('Thất bại!')
              .description('Lý do thất bại')
          }).description('Thất bại')

        }
      }
    }
  }
];
