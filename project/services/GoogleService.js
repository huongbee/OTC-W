const speakeasy = require('speakeasy');

module.exports = {
  generateOTPAuthenticator: (tokenKey) => {
    return speakeasy.totp({
      secret: tokenKey,
      encoding: 'base32'
    });
  },
  /**
    * @param { String } tokenKey base32
    * @param { String } OTP
    * @return { Boolean }
    */
  verifyGoogleAuthenticator: (tokenKey, OTP, window = 3) => {
    const verified = speakeasy.totp.verify({
      secret: tokenKey,
      encoding: 'base32',
      token: OTP,
      window
    });
    return !!verified;
  }
};
