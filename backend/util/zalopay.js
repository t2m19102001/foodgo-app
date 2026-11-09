// Tich hop ZaloPay "Create Order" (san pham Payment Gateway, KHAC QuickPay).
// Da xac nhan qua tai lieu chinh thuc (docs.zalopay.vn, 11/2026): field
// request, cong thuc mac tao don, va cong thuc verify callback bang key2.
// CHUA xac minh duoc 100% base URL sandbox va cong thuc mac cua API truy
// van trang thai (/v2/query) - can doi chieu lai ngay khi co tai khoan
// sandbox that (ZALOPAY_APP_ID/KEY1/KEY2), cung cach da lam voi Gemini/Groq.
//
// Khong tich hop SDK native ZaloPay (can AAR rieng ngoai Maven + app-link) -
// dung "order_url" tra ve, mo qua trinh duyet/Custom Tab giong cach VNPay
// dang lam voi "payUrl", nen Android khong can code moi.
import crypto from "node:crypto";
import logger from "./logger.js";

export class ZaloPayError extends Error {}

const endpoint = () => process.env.ZALOPAY_ENDPOINT || "https://sb-openapi.zalopay.vn/v2/create";

const hmacSha256 = (key, data) => crypto.createHmac("sha256", key).update(data).digest("hex");

// ZaloPay yeu cau dinh dang "yymmdd_<ma rieng>", toi da 40 ky tu. Dung gio
// Viet Nam (giong cach vnpay.js dung Intl.DateTimeFormat) de khop ngay thuc
// te du server chay UTC.
export const buildAppTransId = (orderId, createdAt = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "2-digit", month: "2-digit", day: "2-digit",
  }).formatToParts(createdAt).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  // UUID bo dau "-" roi lay 16 ky tu cuoi: ngan gon nhung van du phan biet,
  // tong do dai "yymmdd_" (7) + 16 = 23 ky tu, con du cho dinh dang 40.
  const shortId = String(orderId).replace(/-/g, "").slice(-16);
  return `${parts.year}${parts.month}${parts.day}_${shortId}`;
};

// mac = HMAC_SHA256(key1, app_id|app_trans_id|app_user|amount|app_time|embed_data|item)
export const computeCreateMac = ({ appId, appTransId, appUser, amount, appTime, embedData, item }, key1) =>
  hmacSha256(key1, `${appId}|${appTransId}|${appUser}|${amount}|${appTime}|${embedData}|${item}`);

// Goi API tao don THAT cua ZaloPay. Tra ve { appTransId, orderUrl, zpTransToken }.
export const createOrder = async ({ orderId, amount, description }) => {
  const appId = process.env.ZALOPAY_APP_ID;
  const key1 = process.env.ZALOPAY_KEY1;
  if (!appId || !key1) throw new ZaloPayError("ZALOPAY_APP_ID/ZALOPAY_KEY1 chưa được cấu hình");

  const appTime = Date.now();
  const appTransId = buildAppTransId(orderId, new Date(appTime));
  const appUser = "foodgo"; // app chi co 1 "nguoi dung" phia merchant, khong gui thong tin ca nhan khach
  const embedData = JSON.stringify({});
  const item = JSON.stringify([]);
  const mac = computeCreateMac(
    { appId, appTransId, appUser, amount, appTime, embedData, item }, key1);

  const body = new URLSearchParams({
    app_id: appId,
    app_trans_id: appTransId,
    app_user: appUser,
    app_time: String(appTime),
    amount: String(Math.round(amount)),
    item,
    embed_data: embedData,
    description: description || `Thanh toan don hang FoodGo ${orderId}`,
    bank_code: "",
    mac,
    ...(process.env.ZALOPAY_CALLBACK_URL ? { callback_url: process.env.ZALOPAY_CALLBACK_URL } : {}),
  });

  let response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (error) {
    logger.error("ZaloPay fetch error:", error.message);
    throw new ZaloPayError("Không gọi được ZaloPay API");
  }

  const json = await response.json().catch(() => null);
  if (!json || json.return_code !== 1) {
    logger.error("ZaloPay create order trả lỗi:", JSON.stringify(json));
    throw new ZaloPayError(json?.return_message || "ZaloPay từ chối tạo đơn");
  }

  return { appTransId, orderUrl: json.order_url, zpTransToken: json.zp_trans_token };
};

// Callback ZaloPay POST {data, mac} - "data" la CHUOI JSON string (chua
// parse). mac = HMAC_SHA256(key2, data). So sanh hang thoi gian giong
// verifySignature trong vnpay.js de khong lo thong tin qua thoi gian phan hoi.
export const verifyCallbackMac = (data, mac) => {
  if (!mac || !data) return false;
  const expected = Buffer.from(hmacSha256(process.env.ZALOPAY_KEY2, data), "utf-8");
  const received = Buffer.from(String(mac), "utf-8");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};
