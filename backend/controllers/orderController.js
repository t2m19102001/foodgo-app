import { createHash, randomInt } from "node:crypto";
import { withTransaction } from "../db/index.js";
import {
  toOrder,
  findOrderById, findOrderByRequestId,
  listOrdersForUser, listOrdersForAdmin, readOrderStats,
  findReusablePayUrl, findActivePayUrl,
  lockOrderById, lockOrderByRequestId, lockFoodsForOrder, lockStaleVnpayOrders,
  insertOrder, takeStock, insertOrderItem, setOrderAmount, restoreStock,
  changeOrderStatus, cancelOrderIfStatus, cancelOrderNow, setOrderStatus, recordStatusChange,
  claimPaymentAttempt, insertPaymentAttempt, findPaymentAttempt, insertPaymentLedger,
  markPaymentFailed, markPaymentPaid, markRefundRequired,
  insertNotification,
} from "../db/orders.js";
import { buildPaymentUrl, verifySignature } from "../util/vnpay.js";
import { parseOrderPagination } from "../util/pagination.js";
import { isUuid } from "../util/ids.js";
import { HttpError, sendHttpError } from "../util/httpError.js";
import logger from "../util/logger.js";

const VALID_PAYMENT_METHODS = ["cod", "vnpay"];
const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const NEXT_STATUSES = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
const CANCELLABLE_STATUSES = ["pending", "confirmed"];
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 50;

const positiveIntFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};
// Thoi gian VNPay chap nhan thanh toan cho mot payUrl (vnp_ExpireDate)
const PAYMENT_TTL_MINUTES = positiveIntFromEnv("VNPAY_PAYMENT_TTL_MINUTES", 15);
// Cho them sau han thanh toan truoc khi huy don: IPN co the den tre vai phut
const EXPIRY_GRACE_MINUTES = positiveIntFromEnv("VNPAY_EXPIRY_GRACE_MINUTES", 15);
const EXPIRED_MESSAGE = "Phiên thanh toán VNPay đã hết hạn hoặc đã bị hủy, vui lòng đặt hàng lại";

export const canTransition = (from, to) => (NEXT_STATUSES[from] || []).includes(to);

const fingerprintOf = (quantities, address) => createHash("sha256")
  .update(JSON.stringify({
    items: [...quantities].sort(([a], [b]) => a.localeCompare(b)),
    address: [address.fullName, address.phone, address.address, address.note || ""]
      .map((value) => String(value).trim()),
  }))
  .digest("hex");

const statusMessages = {
  confirmed: "Đơn hàng của bạn đã được xác nhận",
  shipped: "Đơn hàng của bạn đang được giao",
  delivered: "Đơn hàng của bạn đã được giao thành công",
  cancelled: "Đơn hàng của bạn đã bị hủy",
};

// Ma don rut gon 8 ky tu cuoi, giong cach app hien thi "Don hang #xxxxxxxx"
const shortCode = (orderId) => String(orderId).slice(-8);

const notifyOrderStatus = (userId, orderId, status, client) => {
  const message = statusMessages[status];
  if (!message) return Promise.resolve();
  return insertNotification(client, userId, "Cập nhật đơn hàng", `${message} (#${shortCode(orderId)})`);
};

export const placeOrder = async (req, res) => {
  try {
    const { items, address, clientRequestId, paymentMethod } = req.body || {};

    if (typeof clientRequestId !== "string" || !REQUEST_ID_PATTERN.test(clientRequestId)) {
      return res.status(400).json({ success: false, message: "Mã yêu cầu không hợp lệ" });
    }

    const normalizedPaymentMethod = VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : "cod";

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Giỏ hàng trống" });
    }
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ success: false, message: "Giỏ hàng có quá nhiều món" });
    }
    if (!address || typeof address !== "object" || Array.isArray(address)
        || ![address.fullName, address.phone, address.address].every((value) =>
          typeof value === "string" && value.trim().length > 0)
        || typeof (address.note ?? "") !== "string"
        || address.fullName.length > 100 || address.phone.length > 30
        || address.address.length > 300 || (address.note || "").length > 500) {
      return res.status(400).json({ success: false, message: "Thiếu địa chỉ giao hàng" });
    }

    // Gop cac dong trung foodId va chuan hoa so luong truoc khi doi chieu voi DB
    const quantityByFoodId = new Map();
    for (const item of items) {
      const foodId = item && item.foodId;
      if (!isUuid(foodId)) {
        return res.status(400).json({ success: false, message: "Món ăn không hợp lệ" });
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ success: false, message: "Số lượng món không hợp lệ" });
      }
      const key = String(foodId).toLowerCase();
      const totalQuantity = (quantityByFoodId.get(key) || 0) + quantity;
      if (totalQuantity > 100) {
        return res.status(400).json({ success: false, message: "Số lượng món không hợp lệ" });
      }
      quantityByFoodId.set(key, totalQuantity);
    }

    const requestFingerprint = fingerprintOf(quantityByFoodId, address);
    const foodIds = [...quantityByFoodId.keys()];

    const result = await withTransaction(async (client) => {
      const orderId = await insertOrder(client, {
        userId: req.userId,
        clientRequestId,
        requestFingerprint,
        address,
        paymentMethod: normalizedPaymentMethod,
        paymentTtlMinutes: PAYMENT_TTL_MINUTES,
      });

      // Ma yeu cau da duoc dung: khong tao don moi, tra lai don da co
      if (!orderId) {
        return {
          duplicate: true,
          order: await findOrderByRequestId(req.userId, clientRequestId, client),
        };
      }

      const foods = await lockFoodsForOrder(client, foodIds);

      // Tu day tro di phai THROW chu khong return: don da duoc INSERT o tren de
      // chiem khoa idempotency, return se commit va de lai don mo coi.
      if (foods.length !== foodIds.length) {
        throw new HttpError(400, "Có món ăn không còn tồn tại");
      }

      const soldOut = foods.find((food) => !food.is_available);
      if (soldOut) {
        throw new HttpError(400, `Món "${soldOut.name}" hiện đã hết hàng`);
      }

      let amount = 0;
      for (const food of foods) {
        const quantity = quantityByFoodId.get(String(food.id));

        // Chi tru ton kho voi mon co bat track_stock (xem migration 002)
        if (food.track_stock && !await takeStock(client, food.id, quantity)) {
          throw new HttpError(400, `Món "${food.name}" không còn đủ số lượng`);
        }

        await insertOrderItem(client, orderId, food, quantity);
        amount += Number(food.price) * quantity;
      }

      await setOrderAmount(client, orderId, amount);
      await recordStatusChange(client, orderId, null, "pending", "customer", req.userId);

      // Chi bao "dat hang thanh cong" ngay cho COD - khong qua cong thanh toan
      // nen dat la xong. Don VNPay van duoc tao o day (de giu cho/chiem khoa
      // idempotency, tranh "khach da tra tien nhung khong con suat") nhung
      // CHUA bao cho khach: thong bao va ket qua tra ve chi den khi thanh toan
      // thanh cong (xem processVnpayResult).
      if (normalizedPaymentMethod === "cod") {
        await insertNotification(client, req.userId, "Đặt hàng thành công",
          `Đơn hàng #${shortCode(orderId)} đã được tạo, tổng tiền ${amount.toLocaleString("vi-VN")}đ. `
          + "Chúng tôi sẽ xác nhận trong thời gian sớm nhất.");
      }

      return {
        order: await findOrderById(orderId, client),
        paymentMethod: normalizedPaymentMethod,
      };
    });

    if (result.duplicate) {
      const existing = result.order;
      if (existing.request_fingerprint !== requestFingerprint) {
        return res.status(409).json({ success: false, message: "Mã yêu cầu đã dùng cho đơn hàng khác" });
      }
      // Don VNPay gui lai ma CHUA thanh toan: tra lai payUrl dang con han
      // (KHONG cap txnRef moi - xem getOrIssuePayUrl), hoac cap lan thanh toan
      // moi neu lan truoc da that bai/het han. Don da het han/huy -> 410 de app
      // xoa yeu cau dang cho va cho dat lai.
      if (existing.payment_method === "vnpay" && existing.payment_status !== "paid") {
        if (existing.status === "cancelled") {
          return res.status(410).json({ success: false, message: EXPIRED_MESSAGE });
        }
        const payUrl = await getOrIssuePayUrl(existing, req.ip);
        return res.json({ success: true, message: "Vui lòng hoàn tất thanh toán VNPay", payUrl });
      }
      const order = toOrder(existing);
      return res.json({ success: true, message: "Đơn hàng đã được tạo", orderId: order._id, order });
    }

    if (result.paymentMethod === "vnpay") {
      // KHONG tra orderId/order o day - day chinh la cho sua bug "bam Dat hang
      // la thay da dat hang xong roi moi hien man thanh toan". Server da tao
      // va giu cho don (tru kho, chiem khoa idempotency) nhung client khong
      // biet no ton tai; don chi "xuat hien" (GET /my, thong bao) sau khi
      // VNPay bao thanh toan thanh cong trong processVnpayResult.
      const payUrl = await getOrIssuePayUrl(result.order, req.ip);
      return res.json({ success: true, message: "Vui lòng hoàn tất thanh toán VNPay", payUrl });
    }

    const order = toOrder(result.order);
    res.status(201).json({ success: true, message: "Đặt hàng thành công", orderId: order._id, order });
  } catch (error) {
    sendHttpError(res, error, "Lỗi khi đặt hàng",
      (e) => logger.error("Place order error:", e));
  }
};

// Tra ve payUrl cho mot don VNPay chua thanh toan.
//
// Sua loi "payUrl da thanh toan bi vo hieu": truoc day MOI lan app gui lai don
// deu ghi mot vnp_txn_ref moi va callback chi cong nhan txnRef moi nhat, nen
// IPN cua giao dich khach DA TRA bang payUrl cu bi tu choi. Gio:
//   - payUrl con han (va don chua tung that bai) -> tra lai DUNG URL do, VNPay
//     tu chan tra tien hai lan tren cung mot txnRef;
//   - het han hoac lan truoc that bai -> cap lan thanh toan moi;
//   - MOI txnRef tung cap deu nam trong payment_attempts va van hop le khi IPN
//     ve tre (xem processVnpayResult).
const getOrIssuePayUrl = async (order, ip) => {
  if (order.payment_status === "unpaid") {
    const reusable = await findReusablePayUrl(order.id);
    if (reusable) return reusable;
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PAYMENT_TTL_MINUTES * 60 * 1000);
  // Hau to ngau nhien: hai lan cap trong cung mot mili giay khong dung khoa chinh
  const txnRef = `${order.id}-${createdAt.getTime()}${randomInt(100, 1000)}`;
  const payUrl = buildPaymentUrl({
    txnRef,
    amount: order.amount,
    orderInfo: `Thanh toan don hang ${shortCode(order.id)}`,
    ipAddr: ip,
    createdAt,
    expiresAt,
  });

  await withTransaction(async (client) => {
    const amount = await claimPaymentAttempt(client, order.id, txnRef, expiresAt);
    if (amount === undefined) throw new HttpError(410, EXPIRED_MESSAGE);
    await insertPaymentAttempt(client, { txnRef, orderId: order.id, amount, payUrl, expiresAt });
  });
  return payUrl;
};

// Danh dau don can hoan tien khi tien ve ma KHONG the ghi nhan la paid: don
// da het han/huy (constraint orders_paid_not_cancelled), hoac don da paid tu
// mot giao dich khac (khach tra hai lan). Ban ghi payments da luu o tren nen
// doi soat va hoan tien duoc; scripts/reconcile-payments.mjs liet ke cac don nay.
const flagRefund = async (client, order, transactionNo) => {
  await markRefundRequired(client, order.id);
  logger.error(
    `VNPay: nhan tien cho don ${order.id} (status=${order.status}, payment_status=${order.payment_status}), `
    + `giao dich ${transactionNo || "?"} - CAN HOAN TIEN`);
  await insertNotification(client, order.user_id, "Thanh toán sẽ được hoàn lại",
    order.status === "cancelled"
      ? `Khoản thanh toán VNPay cho đơn #${shortCode(order.id)} đến sau khi phiên đặt hàng đã hết hạn hoặc bị hủy. Chúng tôi sẽ hoàn tiền cho bạn.`
      : `Đơn hàng #${shortCode(order.id)} đã được thanh toán trước đó. Khoản thanh toán thừa sẽ được hoàn lại cho bạn.`);
};

// Dung chung cho ca Return URL (browser redirect) va IPN (goi server-to-server
// tu VNPay). Ma tra ve theo bang RspCode cua VNPay:
//   00 thanh cong - 01 khong thay don - 02 don da xu ly/khong hop le
//   04 so tien khong khop - 97 sai chu ky - 99 loi khac
const processVnpayResult = async (vnpQuery, source) => {
  if (!verifySignature(vnpQuery)) {
    return { ok: false, code: "97" };
  }
  // Chu ky dung ma khong kiem noi dung thi chi chong duoc gia mao, khong chong
  // duoc sai lech nghiep vu.
  if (vnpQuery.vnp_TmnCode && vnpQuery.vnp_TmnCode !== process.env.VNPAY_TMN_CODE) {
    return { ok: false, code: "02" };
  }

  const txnRef = String(vnpQuery.vnp_TxnRef || "");
  const orderId = txnRef.slice(0, txnRef.lastIndexOf("-"));
  if (!isUuid(orderId)) {
    return { ok: false, code: "01" };
  }

  return withTransaction(async (client) => {
    const order = await lockOrderById(client, orderId);
    if (!order) return { ok: false, code: "01" };

    const attempt = await findPaymentAttempt(client, txnRef, order.id);
    if (!attempt) return { ok: false, code: "01" };

    // So tien VNPay gui ve tinh theo don vi x100
    const expectedAmount = Math.round(Number(attempt.amount) * 100);
    const paidAmount = Number(vnpQuery.vnp_Amount);
    if (!Number.isFinite(paidAmount) || paidAmount !== expectedAmount) {
      logger.error(
        `VNPay amount mismatch cho don ${orderId}: nhan ${vnpQuery.vnp_Amount}, cho doi ${expectedAmount}`);
      return { ok: false, code: "04" };
    }

    // Chuan 2.1.0 yeu cau kiem CA vnp_ResponseCode VA vnp_TransactionStatus
    const success = vnpQuery.vnp_ResponseCode === "00"
      && (vnpQuery.vnp_TransactionStatus === undefined
        || vnpQuery.vnp_TransactionStatus === "00");

    // VNPay gui vnp_TransactionNo = "0" cho giao dich khong thanh cong (vi du
    // khach bam huy). Coi la khong co ma, neu khong UNIQUE se gop moi lan that
    // bai cua moi don vao mot ban ghi.
    const rawTransactionNo = vnpQuery.vnp_TransactionNo;
    const transactionNo = rawTransactionNo && rawTransactionNo !== "0" ? String(rawTransactionNo) : null;

    // Khong co ma giao dich thi UNIQUE ben duoi khong chong trung duoc: callback
    // thanh cong lap lai cho don da paid coi la goi lai, khong phai tra hai lan
    if (success && !transactionNo && order.payment_status === "paid") {
      return { ok: true, code: "00", order, success: true };
    }

    // Ghi ledger TRUOC khi doi trang thai don: UNIQUE (vnp_transaction_no) lam
    // idempotency nam o tang DB, nen Return URL va IPN cung bao ve mot giao dich
    // thi chi mot lan di qua duoc day.
    const ledgerWritten = await insertPaymentLedger(client, {
      orderId: order.id,
      txnRef,
      transactionNo,
      responseCode: vnpQuery.vnp_ResponseCode || null,
      transactionStatus: vnpQuery.vnp_TransactionStatus || null,
      bankCode: vnpQuery.vnp_BankCode || null,
      cardType: vnpQuery.vnp_CardType || null,
      amount: paidAmount,
      payDate: vnpQuery.vnp_PayDate || null,
      source,
      raw: vnpQuery,
    });
    if (!ledgerWritten) {
      return { ok: true, code: "00", order, success: order.payment_status === "paid" };
    }

    if (!success) {
      if (await markPaymentFailed(client, order.id)) {
        await insertNotification(client, order.user_id, "Thanh toán VNPay thất bại",
          `Thanh toán VNPay cho đơn hàng #${shortCode(order.id)} không thành công. `
          + "Bạn có thể thanh toán lại hoặc hủy để chọn phương thức khác trong ứng dụng.");
      }
      return { ok: true, code: "00", order, success: false };
    }

    // Tien DA ve nhung khong the ghi nhan cho don nay -> giu ledger, danh dau
    // hoan tien. Van tra 00: giao dich da duoc merchant ghi nhan, VNPay khong
    // can goi lai IPN.
    if (order.status === "cancelled" || order.payment_status === "paid"
        || order.payment_status === "refunded") {
      await flagRefund(client, order, transactionNo);
      return { ok: true, code: "00", order, success: false, refund: true };
    }

    const statusAfterPayment = await markPaymentPaid(client, order.id);
    if (statusAfterPayment === undefined) {
      // Khong xay ra khi da khoa FOR UPDATE o tren; de phong thi van khong nuot tien
      await flagRefund(client, order, transactionNo);
      return { ok: true, code: "00", order, success: false, refund: true };
    }

    if (statusAfterPayment === "pending") {
      await setOrderStatus(client, order.id, "confirmed");
      await recordStatusChange(client, order.id, "pending", "confirmed", "system", null,
        "Thanh toan VNPay thanh cong");
    }

    // Voi VNPay day la thong bao DAU TIEN ma khach nhan duoc ve don nay - luc
    // dat hang server khong bao gi ca (xem placeOrder).
    await insertNotification(client, order.user_id, "Đặt hàng & thanh toán thành công",
      `Đơn hàng #${shortCode(order.id)} đã được tạo, tổng tiền ${Number(order.amount).toLocaleString("vi-VN")}đ, đã thanh toán qua VNPay.`);

    return { ok: true, code: "00", order, success: true };
  });
};

export const handleVnpayReturn = async (req, res) => {
  try {
    const result = await processVnpayResult(req.query, "return");
    res.set("Content-Type", "text/html; charset=utf-8");
    if (!result.ok) {
      return res.send("<h3>Xác thực thanh toán không hợp lệ. Vui lòng quay lại ứng dụng.</h3>");
    }
    let message = "Thanh toán thành công! Vui lòng quay lại ứng dụng.";
    if (result.refund) {
      message = "Đã nhận thanh toán nhưng không thể ghi nhận cho đơn hàng này. Chúng tôi sẽ hoàn tiền cho bạn.";
    } else if (result.success === false) {
      message = "Thanh toán không thành công. Vui lòng quay lại ứng dụng để thanh toán lại hoặc chọn phương thức khác.";
    }
    res.send(`<h3>${message}</h3>`);
  } catch (error) {
    logger.error("Handle VNPay return error:", error);
    res.status(500).send("<h3>Lỗi xử lý kết quả thanh toán.</h3>");
  }
};

export const handleVnpayIpn = async (req, res) => {
  try {
    const result = await processVnpayResult(req.query, "ipn");
    if (!result.ok) {
      return res.json({ RspCode: result.code, Message: "Invalid checksum or order" });
    }
    res.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    logger.error("Handle VNPay IPN error:", error);
    res.json({ RspCode: "99", Message: "Unknown error" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const pagination = parseOrderPagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Trang hoặc giới hạn không hợp lệ" });
    const { page, limit, skip } = pagination;

    const status = req.query.status;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const { rows, total } = await listOrdersForUser({ userId: req.userId, status, limit, skip });
    res.json({
      success: true,
      orders: rows.map(toOrder),
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalOrders: total },
    });
  } catch (error) {
    logger.error("Get my orders error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đơn hàng" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
    }
    const order = await findOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (order.user_id !== req.userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
    }

    res.json({ success: true, order: toOrder(order) });
  } catch (error) {
    logger.error("Get order by id error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông tin đơn hàng" });
  }
};

// Ket qua theo clientRequestId - app goi khi nguoi dung bam "Kiem tra":
//   404  chua co don nao (request chua toi server) -> app gui lai POST
//   200  { orderId, order }                        -> don da ton tai that
//   200  { paymentPending: true, payUrl? }         -> don VNPay dang cho thanh toan
//   410                                             -> phien VNPay het han / da huy
// Truoc day don VNPay chua tra tien cung tra 404, nen app tu dong POST lai va
// server cap payUrl moi - chinh la nguyen nhan cua loi payUrl da thanh toan bi
// vo hieu. Gio app biet "dang cho VNPay" va khong POST lai.
export const getOrderByRequestId = async (req, res) => {
  try {
    if (!REQUEST_ID_PATTERN.test(req.params.clientRequestId)) {
      return res.status(400).json({ success: false, message: "Mã yêu cầu không hợp lệ" });
    }
    const row = await findOrderByRequestId(req.userId, req.params.clientRequestId);
    if (!row) {
      return res.status(404).json({ success: false, message: "Chưa tìm thấy đơn hàng" });
    }

    if (row.payment_method === "vnpay" && row.payment_status !== "paid") {
      if (row.status === "cancelled") {
        return res.status(410).json({ success: false, message: EXPIRED_MESSAGE });
      }
      // Van KHONG tra orderId/order: voi khach, don chi ton tai khi da tra tien
      const activePayUrl = await findActivePayUrl(row.id);
      const failed = row.payment_status === "failed";
      return res.json({
        success: true,
        paymentPending: true,
        paymentStatus: row.payment_status,
        payUrl: !failed && activePayUrl ? activePayUrl : undefined,
        paymentExpiresAt: row.payment_expires_at,
        message: failed
          ? "Thanh toán VNPay chưa thành công. Bạn có thể thanh toán lại hoặc hủy để chọn phương thức khác."
          : "Chưa nhận được xác nhận thanh toán từ VNPay. Nếu bạn đã thanh toán, vui lòng đợi ít phút rồi kiểm tra lại.",
      });
    }

    const order = toOrder(row);
    res.json({ success: true, orderId: order._id, order });
  } catch (error) {
    logger.error("Get order by request id error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi kiểm tra đơn hàng" });
  }
};

// Khach bo thanh toan VNPay de doi phuong thuc / doi gio. Huy don dang giu cho
// va hoan kho. Idempotent: goi lai voi don da huy van tra 200.
//   404  khong co don nao voi ma nay - app chi can xoa yeu cau dang cho
//   409  don da ton tai that (COD hoac VNPay da tra tien) - tra kem don
export const abandonPendingPayment = async (req, res) => {
  try {
    if (!REQUEST_ID_PATTERN.test(req.params.clientRequestId)) {
      return res.status(400).json({ success: false, message: "Mã yêu cầu không hợp lệ" });
    }
    const result = await withTransaction(async (client) => {
      const order = await lockOrderByRequestId(client, req.userId, req.params.clientRequestId);
      if (!order) throw new HttpError(404, "Không tìm thấy yêu cầu đặt hàng");

      if (order.payment_method !== "vnpay" || order.payment_status === "paid") {
        return { exists: true, order: await findOrderById(order.id, client) };
      }
      if (order.status === "cancelled") return { cancelled: true };

      await cancelOrderNow(client, order.id, "Khách hủy thanh toán VNPay");
      await restoreStock(client, order.id);
      await recordStatusChange(client, order.id, order.status, "cancelled", "customer",
        req.userId, "Khach huy thanh toan VNPay");
      return { cancelled: true };
    });

    if (result.exists) {
      const order = toOrder(result.order);
      return res.status(409).json({
        success: false, message: "Đơn hàng đã được tạo", orderId: order._id, order,
      });
    }
    res.json({ success: true, message: "Đã hủy thanh toán. Bạn có thể chọn phương thức khác." });
  } catch (error) {
    sendHttpError(res, error, "Lỗi khi hủy thanh toán",
      (e) => logger.error("Abandon payment error:", e));
  }
};

// Huy cac don VNPay qua han thanh toan (+ thoi gian an han cho IPN den tre) va
// hoan kho. Chay dinh ky tu server.js. FOR UPDATE SKIP LOCKED: nhieu instance
// chay cung luc khong xu ly trung, va khong cho callback VNPay dang giu khoa.
// Tien ve SAU khi don da bi huy o day se duoc processVnpayResult danh dau
// refund_required, khong bao gio bi nuot.
export const expireStaleVnpayOrders = async ({ graceMinutes = EXPIRY_GRACE_MINUTES, batchSize = 100 } = {}) =>
  withTransaction(async (client) => {
    const stale = await lockStaleVnpayOrders(client, graceMinutes, batchSize);
    for (const order of stale) {
      await cancelOrderNow(client, order.id, "Hết hạn thanh toán VNPay");
      await restoreStock(client, order.id);
      await recordStatusChange(client, order.id, order.status, "cancelled", "system", null,
        "Het han thanh toan VNPay");
    }
    return stale.length;
  });

export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
    }
    if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
      return res.status(400).json({ success: false, message: "Lý do hủy không hợp lệ" });
    }

    const result = await withTransaction(async (client) => {
      const order = await lockOrderById(client, req.params.id);
      if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng");
      if (order.user_id !== req.userId) {
        throw new HttpError(403, "Không có quyền hủy đơn hàng này");
      }
      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw new HttpError(400, "Đơn hàng không thể hủy vào lúc này");
      }
      // Ban Mongo khong kiem payment_status: huy duoc don da tra tien VNPay ma
      // khong co duong hoan tien nao. Constraint orders_paid_not_cancelled la
      // chot cuoi, nhung chan o day de tra loi ro rang thay vi loi DB.
      if (order.payment_status === "paid") {
        throw new HttpError(409, "Đơn hàng đã thanh toán, vui lòng liên hệ hỗ trợ để được hoàn tiền");
      }

      const cancelled = await cancelOrderIfStatus(client, order.id, {
        from: order.status,
        reason: reason || "",
      });
      if (!cancelled) {
        throw new HttpError(409, "Đơn hàng đã thay đổi, vui lòng tải lại");
      }

      await restoreStock(client, order.id);
      await recordStatusChange(client, order.id, order.status, "cancelled", "customer",
        req.userId, reason || "");
      await notifyOrderStatus(order.user_id, order.id, "cancelled", client);

      return { order: await findOrderById(order.id, client) };
    });


    res.json({
      success: true,
      message: "Đã hủy đơn hàng thành công",
      order: toOrder(result.order),
    });
  } catch (error) {
    sendHttpError(res, error, "Lỗi khi hủy đơn hàng",
      (e) => logger.error("Cancel order error:", e));
  }
};

export const listAllOrders = async (req, res) => {
  try {
    const pagination = parseOrderPagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Trang hoặc giới hạn không hợp lệ" });
    const { page, limit, skip } = pagination;

    const status = req.query.status;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const { rows, total } = await listOrdersForAdmin({ status, limit, skip });
    res.json({
      success: true,
      orders: rows.map(toOrder),
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalOrders: total },
    });
  } catch (error) {
    logger.error("List all orders error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đơn hàng" });
  }
};

export const getOrderStats = async (req, res) => {
  try {
    const { statusRows, dayRows } = await readOrderStats();

    const byStatus = VALID_STATUSES.map((status) => {
      const found = statusRows.find((row) => row.status === status);
      return {
        status,
        count: found ? found.count : 0,
        total: found ? Number(found.total) : 0,
      };
    });

    const totalOrders = byStatus.reduce((sum, item) => sum + item.count, 0);
    const totalRevenue = byStatus.find((item) => item.status === "delivered")?.total || 0;
    const last7Days = dayRows.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue),
      count: row.count,
    }));

    res.json({ success: true, totalRevenue, totalOrders, byStatus, last7Days });
  } catch (error) {
    logger.error("Get order stats error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thống kê đơn hàng" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
    }

    const result = await withTransaction(async (client) => {
      const order = await lockOrderById(client, req.params.id);
      if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng");
      if (!canTransition(order.status, status)) {
        throw new HttpError(400, "Chuyển trạng thái không hợp lệ");
      }
      if (status === "cancelled" && order.payment_status === "paid") {
        throw new HttpError(409, "Đơn hàng đã thanh toán, phải hoàn tiền trước khi hủy");
      }

      const changed = await changeOrderStatus(client, order.id, { from: order.status, to: status });
      if (!changed) {
        throw new HttpError(409, "Đơn hàng đã thay đổi, vui lòng tải lại");
      }

      if (status === "cancelled") await restoreStock(client, order.id);
      await recordStatusChange(client, order.id, order.status, status, "admin", req.userId);
      await notifyOrderStatus(order.user_id, order.id, status, client);

      return { order: await findOrderById(order.id, client) };
    });


    res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      order: toOrder(result.order),
    });
  } catch (error) {
    sendHttpError(res, error, "Lỗi khi cập nhật trạng thái đơn hàng",
      (e) => logger.error("Update order status error:", e));
  }
};
