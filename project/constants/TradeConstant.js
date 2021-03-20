module.exports = {
  ADS_TYPE: {
    BUY: 'BUY',
    SELL: 'SELL'
  },
  PAYMENT_TYPE: {
    BANKTRANSFER: 'BANKTRANSFER',
    DIRECT: 'DIRECT',
    OTHERS: 'OTHERS'
  },
  TRADE_TYPE: {
    BUY: 'BUY',
    SELL: 'SELL'
  },
  TRADE_STATUS: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED', // do user tự hủy
    EXPIRED: 'EXPIRED', // GD hết hạn do ko thực hiện GD
    SUCCEEDED: 'SUCCEEDED',
    WARNING: 'WARNING', // GD bị khiếu nại  || Giao dịch mà người bán không xác nhận.
    FAILED: 'FAILED', //Giao dịch thất bại do không có lệnh để khớp
    LOCKED: 'LOCKED',
    DIFF_AMOUNT_LOCKED: 'DIFF_AMOUNT_LOCKED', //Giao dịch người bán xác nhận số tiền nhận được không khớp với số tiền giao dịch,
    REFUSED: 'REFUSED' // đại lý từ chối GD
  },
  CLAIM_STATUS: {
    SELLER_CLAIM: 'SELLER_CLAIM',
    BUYER_CLAIM: 'BUYER_CLAIM',
    AUTO_SELLER_CLAIM: 'AUTO_SELLER_CLAIM', // hệ thống claim thay cho seller
    AUTO_BUYER_CLAIM: 'AUTO_BUYER_CLAIM'// hệ thống claim thay cho buyer
  },
  TRADE_STATUS_EXPLAIN: {
    PENDING: 'Đang chờ',
    PAID: 'Đã chuyển khoản',
    CANCELLED: 'Đã hủy', // do user tự hủy
    EXPIRED: 'Hết hạn', // GD hết hạn do ko thực hiện GD
    SUCCEEDED: 'Thành công',
    WARNING: 'Khiếu nại', // GD bị khiếu nại  || Giao dịch mà người bán không xác nhận.
    FAILED: 'Thấi bại', //Giao dịch thất bại do không có lệnh để khớp
    LOCKED: 'Đã bị khóa',
    DIFF_AMOUNT_LOCKED: 'Giao dịch không khớp số V' //Giao dịch người bán xác nhận số tiền nhận được không khớp với số tiền giao dịch
  },
  ADS_STATUS: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED'
  },
  MIN_TRADE_AMOUNT: 1000,
  COMMISION_STATUS: {
    PENDING: 'PENDING',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
  },
  ADMIN_UPDATE_BALANCE_ACTION: {
    DEPOSIT: 'DEPOSIT',
    WITHDRAW: 'WITHDRAW'
  },
  BALANCE_QUERY_SOURCE: {
    CREATE_SELL_ADS: 'CREATE_SELL_ADS',
    CANCEL_SELL_ADS: 'CANCEL_SELL_ADS',
    BUY: 'BUY'
  }
};
