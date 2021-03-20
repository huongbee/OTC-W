const sha256 = require('sha256');

class PasswordHelper {
  constructor(salt = 'PasswordSecretKey@123!') {
    this.salt = salt;
  }

  /**
   *
   * @param { String } password
   *
   */
  encryptPassword(password) {
    return sha256(password + this.salt);
  }

  /**
   *
   * @param { String } password
   * @param { String } hash password hash stored in DB
   *
   */
  comparePassword(password, hash) {
    return sha256(password + this.salt) === hash;
  }
}
module.exports = PasswordHelper;
