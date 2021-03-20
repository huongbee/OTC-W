const jwt = require('jsonwebtoken')
const AuthenticationConfig = require('project/config/Authentication');
const AccessTokenModel = require('../models/AccessTokenModel')

const VerifyToken = async (request) => {
  let token = request.headers["x-access-token"] || request.headers["authorization"];
  if (token) {
    if (token.startsWith("Bearer ")) {
      token = token.slice(7, token.length);
    }
    const decoded = await jwt.verify(token, AuthenticationConfig.userSecretKey)
    const { accountId } = decoded;
    const atm = await AccessTokenModel.findOne({ accountId });
    if(atm.expiredAt > Date.now()){
      return request.decoded = decoded;
    }
  }
  return request.decoded = false;
}

module.exports = VerifyToken