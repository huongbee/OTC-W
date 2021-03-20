module.exports = {
  ACCOUNT_GENDER: {
    MALE: 'MALE',
    FEMALE: 'FEMALE',
    OTHER: 'OTHER'
  },
  ACCOUNT_TYPE: {
    ADMIN: -1,
    LEVEL_0: 0,
    LEVEL_1: 1,
    LEVEL_2: 2,
    LEVEL_3: 3
  },
  ACCOUNT_SCOPE: {
    ROOT: 'root',
    ADS: 'ads',// xem  Ads
    USERS: 'users', //  xem user
    USERS_UPDATE: 'users.update', //  cập nhật user
    REPORT: 'report',//xem thông kê
    TRADES: 'trades',//  xem GD
    TRADES_UPDATE: 'trades.update', //  update trạng thái GD
    INTERACTION_HISTORY: 'interactionHistory', //   xem lịch sử truy câp
    TELEGRAMLOG: 'telegramLog' //   xem lịch sử truy câp
  },
  ACCOUNT_ACTION: {
    LOGIN: 'Đăng nhập',
    LOGOUT: 'Đăng xuất',
    UPDATE_ACCOUNT: 'Cập nhật tài khoản',
    CHANGE_PASSWORD: 'Đổi mật khẩu',
    CREATE_ACCOUNT: 'Tạo tài khoản',
    SET_UPDATE_ACCOUNT: 'Cập nhật phòng ban/account type',
    SET_DELETE_ACCOUNT: 'Xoá tài khoản',
    FORGOT_PASSWORD: 'User quên mật khẩu',
    RESET_FORGOT_PASSWORD: 'User reset mật khẩu cho TH quên mật khẩu',
    UNLINK_GOOGLE_ACCOUNT: 'Hủy liên kết tài khoản google',
    LINK_GOOGLE_ACCOUNT: 'Liên kết tài khoản google',
    LINK_TELEGRAM_ACCOUNT: 'Liên kết tài khoản telegram',
    UNLINK_TELEGRAM_ACCOUNT: 'Hủy liên kết tài khoản telegram',
    CREATE_APPLICATION: 'Tạo mới ứng dụng',
    UPDATE_APPLICATION: 'Cập nhật ứng dụng',
    DELETE_APPLICATION: 'Xóa ứng dụng',
    ADD_BALANCE: 'ADD_BALANCE',
    MINUS_BALANCE: 'MINUS_BALANCE',
    PUBLISH_ADS: 'Tạo Ads',
    CANCEL_ADS: 'Hủy Ads',
    UPDATE_ADS: 'Cập nhật Ads',
    PUBLISH_TRADE: 'Tạo GD',
    ACCEPT_TRADE: 'Nhận lệnh',
    CANCEL_TRADE: 'Hủy GD',
    REFUSE_TRADE: 'Từ chối GD',
    CONFIRM_PAID: 'Xác nhận chuyển khoản',
    CONTINUE_WAITING_TRADE: 'Xác nhận tiếp tục chờ CK',
    NONE_RECEIVE_VND: 'Xác nhận chưa nhận chưa nhận tiền',
    CONFIRM_PAID_UPLOAD_PROOF: 'Upload BCCT',
    CLAIM_TRADE: 'Khiếu nại',
    SEND_PROOF: 'Gửi BCCT',
    CONFIRM_RECEIVE_VND: 'Xác nhận đã nhận tiền',
    UPDATE_BANKTRANSFER: 'Cập nhật ngân hàng nhận tiền'
  },
  ACTION_RESULT: {
    SUCCESS: 'Thành công',
    FAILURE: 'Thất bại'
  },
  EMAIL_SUBJECT: {
    RESET_PASSWORD: 'RESET PASSWORD OTP'
  },
  REDIS_KEY: {
    RESET_PASSWORD_OTP: 'RESET_PASSWORD_OTP_',
    OTP_LOCK_ID: 'OTP_LOCK_ID_'
  },
  SETTING_TYPE: {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN'
  },
  allowMimeType: [
    'image/jpeg',
    'image/jpg',
    'image/bmp',
    'image/png',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/pdf'
  ],
  UUID_STATE: {
    NEW: 'NEW',
    USED: 'USED'
  },
  PREFIX_CONFIG_TYPE: {
    ALPHABET: 'ALPHABET',
    NUMBER: 'NUMBER',
    ALPHABET_AND_NUMBER: 'ALPHABET_AND_NUMBER'
  },
  SOURCE_NAME: {
    ADS: 'ADS',
    TRADE: 'TRADE',
    TRADE_FEE: 'TRADE_FEE',
    COMMISION: 'COMMISION',
    SYSTEM: 'SYSTEM',
    REFUND_DIFF_TRADE: 'REFUND_DIFF_TRADE',
    TRADE_EXPIRED: 'TRADE_EXPIRED'
  },
  SOURCE_NAME_EXPLAIN: {
    ADS: 'Quảng cáo',
    TRADE: 'Giao dịch',
    TRADE_FEE: 'Phí giao dịch',
    COMMISION: 'Commision',
    SYSTEM: 'Hệ thống',
    REFUND_DIFF_TRADE: 'Giao dịch khác số dư',
    TRADE_EXPIRED: 'Giao dịch bị hủy hoặc hết hạn'
  },
  SYSTEM_ACCOUNT_EMAIL: 'huongnguyenak96@gmail.com', // account email A0 chia commision
  SYSTEM_ACCOUNT_LEVEL0: 'huongnguyenak96@gmail.com', // MC LV 0 - dùng để khớp lệnh bán V cho các đại lý cấp dưới
  SYSTEM_ACCOUNT_LEVEL1: 'huongnguyenak96@gmail.com', // account level 1 nhận commision từ nhưng account level 2 ko có cấp cha
  SYSTEM_ACCOUNT_LEVEL2: 'huongnguyenak96@gmail.com',// account level 2 luôn nhận lệnh nếu các level 2 khác từ chối
  SYSTEM_ADMIN: 'huongntn@payme.vn',

  COMMISION_PERCENT: 0.3,
  COMMISION_PERCENT_LEVEL2: 0.2,
  COMMISION_PERCENT_LEVEL1: 0.1,
  COMMISION_TYPE: {
    COMMISION: 'COMMISION',
    BONUS: 'BONUS'
  },
  TRANSACTION_LIMIT: {
    LEVEL1_DAY_LIMIT_AMOUNT: {
      MIN: 0,
      MAX: 100000000
    }
  },
  NOTIFICATION_TYPE: {
    TELEGRAM: {
      SEND: 'SEND',
      RECEIVE: 'RECEIVE'
    }
  },
  FLATFORM: {
    API: 'API',
    WEB: 'WEB',
    APPLICATION: 'APPLICATION',
    TELEGRAM: 'TELEGRAM'
  }
};
