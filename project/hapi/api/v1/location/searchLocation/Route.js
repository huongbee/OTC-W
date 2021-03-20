const Joi = require('mecore').Joi;
const ResponseCode = require('project/constants/ResponseCode');
const Module = require('./Module');

module.exports = [
  {
    method: 'POST',
    path: '/v1/location/list',
    handler: Module,
    options: {
      description: 'Lấy thông tin địa điểm',
      auth: false,
      validate: {
        payload: Joi.object({
          filter: Joi.object({
            locationId: Joi.number().example(32).description('Id của địa chỉ'),
            identifyCode: Joi.string().example('52').description('Mã định danh của địa chỉ'),
            parentIdentifyCode: Joi.string().example('root').description('Mã định danh của địa chỉ cấp trên'),
            selectParentPath: Joi.boolean().example(false).description('Có trả về mảng đường dẫn đến địa chỉ hay không, mặc định là không')
          }),
          paging: {
            start: Joi.number().example(0).default(0)
              .description('Số bắt đầu'),
            limit: Joi.number().example(10).max(1000)
              .default(100)
              .description('Số dòng trên 1 trang')
          },
          sort: Joi.object().example({ id: -1 }).default({ id: -1 }).description('Sort column')
        })
      },
      tags: ['api', 'v1', 'location'],
      response: {
        status: {
          [ResponseCode.REQUEST_SUCCESS]: Joi.array().items(Joi.object({
            id: Joi.number().example(32).description('Id của địa chỉ'),
            identifyCode: Joi.string().example('52').description('Mã định danh của địa chỉ'),
            parentIdentifyCode: Joi.string().example('root').description('Mã định danh của địa chỉ cấp trên'),
            title: Joi.string().example('Tỉnh Bình Định').description('Tên của địa chỉ'),
            path: Joi.string().example('root>52').description('Chuỗi đường dẫn gồm các mã định danh'),
            parentPath: Joi.array().items(Joi.object({
              identifyCode: Joi.string(),
              title: Joi.string(),
              path: Joi.string()
            })).example([
              {
                identifyCode: '0',
                path: 'root',
                title: 'root'
              },
              {
                identifyCode: '52',
                path: 'root>52',
                title: 'Tỉnh Bình Định'
              }
            ]).description('Mảng đường dẫn từ root đến địa chỉ')
          })).description('Thành công'),

          [ResponseCode.REQUEST_FAIL]: Joi.object({
            message: Joi.string().example('Không thể lấy địa chỉ').description('Lý do thất bại')
          }).description('Thất bại')
        }
      }
    }
  }
];
