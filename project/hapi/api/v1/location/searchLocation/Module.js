const ResponseCode = require('project/constants/ResponseCode');
const LocationModel = require('project/models/LocationModel');
const _ = require('lodash');

module.exports = async (request, reply) => {

  try {
    const where = {};
    const { sort, filter, paging } = request.payload;
    const {
      locationId,
      identifyCode,
      parentIdentifyCode,
      selectParentPath
    } = filter;
    if (_.isEmpty(sort)) sort.id = -1;
    if (_.isArray(locationId)) where.id = { $in: locationId };
    else if (_.isNumber(locationId)) where.id = locationId;
    if (identifyCode) where.identifyCode = identifyCode;
    if (parentIdentifyCode) where.parentIdentifyCode = parentIdentifyCode;

    const selectedFields = `-_id id identifyCode parentIdentifyCode title path ${selectParentPath ? 'parentPath' : ''}`;
    const locations = await LocationModel.find(where)
      .select(selectedFields)
      .skip(paging.start)
      .limit(paging.limit)
      .sort(sort)
      .lean();

    return reply.api(locations).code(ResponseCode.REQUEST_SUCCESS);
  } catch (error) {
    throw error;
  }
};
