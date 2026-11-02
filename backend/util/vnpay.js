import crypto from "node:crypto";
import querystring from "node:querystring";

// Sap xep key theo thu tu alphabet va encode gia tri (bat buoc theo thuat toan ky cua VNPay)
const sortObject = (obj) => {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = encodeURIComponent(String(obj[key])).replace(/%20/g, "+");
  }
  return sorted;
};

const sign = (params, hashSecret) => {
  const sorted = sortObject(params);
  const signData = querystring.stringify(sorted, undefined, undefined, { encodeURIComponent: (v) => v });
  return crypto.createHmac("sha512", hashSecret).update(Buffer.from(signData, "utf-8")).digest("hex");
};

// VNPay doc vnp_CreateDate / vnp_ExpireDate theo gio Viet Nam (GMT+7). Truoc
// day dung gio local cua may chu: server chay UTC (Render, Neon, Docker) se
// lech 7 tieng va cong thanh toan tu choi hoac het han sai.
const vnTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23",
});

// Dinh dang yyyyMMddHHmmss theo gio Viet Nam, dung chuan VNPay yeu cau
export const formatVnpDate = (date) => {
  const parts = Object.fromEntries(
    vnTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

// amount: so tien VND (chua nhan 100), txnRef: ma giao dich duy nhat, orderInfo: noi dung thanh toan.
// createdAt/expiresAt: Date; expiresAt la han VNPay chap nhan thanh toan cho txnRef nay.
export const buildPaymentUrl = ({
  txnRef, amount, orderInfo, ipAddr, createdAt = new Date(), expiresAt,
}) => {
  const createDate = formatVnpDate(createdAt);
  const expireDate = formatVnpDate(expiresAt || new Date(createdAt.getTime() + 15 * 60 * 1000));

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Amount: Math.round(amount * 100),
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  };

  const secureHash = sign(params, process.env.VNPAY_HASH_SECRET);
  const sorted = sortObject(params);
  const query = querystring.stringify(sorted, undefined, undefined, { encodeURIComponent: (v) => v });
  return `${process.env.VNPAY_URL}?${query}&vnp_SecureHash=${secureHash}`;
};

// query: req.query goc tu VNPay (da bi Express decode). Tra ve true neu chu ky hop le
export const verifySignature = (query) => {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;
  if (!vnp_SecureHash) return false;
  const expected = Buffer.from(sign(rest, process.env.VNPAY_HASH_SECRET).toLowerCase(), "utf-8");
  const received = Buffer.from(String(vnp_SecureHash).toLowerCase(), "utf-8");
  // So sanh hang thoi gian: `===` tra ve som o byte dau khac nhau, de lo thong tin cho tan cong do chu ky
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};
