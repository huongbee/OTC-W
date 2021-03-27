const UuidPrefixConfigModel = require('project/models/UUIDPrefixConfigModel');
const UuidModel = require('project/models/UUIDModel');
const GeneralConstant = require('project/constants/GeneralConstant');
const redisService = require('project/services/RedisService');

class UuidService {
  /**
   * prefix UUID
   * @param {string} prefix
   */
  constructor(prefix = 'OTC_ACCOUNT_ID') {
    this.prefix = prefix;
  }

  /**
   * get UUID of prefix
   * @param {string} quantity
   * @param {object} extraData
   */
  async getUUID(quantity = 1, extraData = {}) {
    try {
      const response = {
        code: -1,
        data: {},
        original: null,
        message: null
      };
      if (!this.prefix) {
        response.message = 'Vui lòng thêm prefix';
        return response;
      }
      const prefixConfig = await UuidPrefixConfigModel.findOne({ prefix: this.prefix }).lean();
      if (!prefixConfig) {
        response.message = 'Prefix chưa được hỗ trợ, vui lòng thử lại';
        return response;
      }
      const arrayUUID = await redisService.lpop(this.prefix);
      // console.log({ arrayUUID });
      // if (!arrayUUID) {
      //   response.message = 'Lấy uuid thất bại, vui lòng thử lại';
      //   return response;
      // }
      const uuidData = await UuidModel.findOne({
        prefix: this.prefix,
        state: GeneralConstant.UUID_STATE.NEW
      }).lean();
      if (!uuidData) {
        response.message = 'Lấy uuid thất bại, vui lòng thử lại';
        return response;
      }
      const updateInfo = await UuidModel.updateMany(
        { uuid: uuidData.uuid },
        {
          info: extraData,
          state: GeneralConstant.UUID_STATE.USED
        }
      );
      if (!updateInfo || updateInfo.nModified === 0) {
        response.message = 'Lấy uuid thất bại, vui lòng thử lại!';
        return response;
      }
      response.code = 1;
      response.data = {
        uuid: [uuidData.uuid],
        length: 1
      };
      return response;
    } catch (error) {
      throw (error);
    }
  }

  async getInfoUUID(uuid = '') {
    try {
      const response = {
        code: -1,
        data: {},
        original: null,
        message: null
      };
      const uuidInfo = await UuidModel.findOne({ uuid }).lean();

      if (!uuidInfo) {
        response.message = 'UUID không tồn tại';
        return response;
      }
      response.code = 1;
      response.data = {
        info: uuidInfo.info,
        state: uuidInfo.state
      };
      return response;
    } catch (error) {
      throw (error);
    }
  }
}

module.exports = UuidService;
