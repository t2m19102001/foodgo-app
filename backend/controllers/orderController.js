import { createHash, randomInt } from "node:crypto";
import { withTransaction } from "../db/index.js";
import {
  toOrder,
  findOrderById, findOrderByRequestId,
  listOrdersForUser, listOrdersForAdmin, readOrderStats,
  findReusablePayUrl, findActivePayUrl,
  lockOrderById, lockOrderByRequestId, lockFoodsForOrder, lockStaleVnpayOrders,
  insertOrder, takeStock, insertOrderItem, restoreStock,
  changeOrderStatus, cancelOrderIfStatus, cancelOrderNow, setOrderStatus, recordStatusChange,
  claimPaymentAttempt, insertPaymentAttempt, findPaymentAttempt, insertPaymentLedger,
  markPaymentFailed, markPaymentPaid, markRefundRequired,
  insertNotification,
  countActiveOrders, insertDeliveryEstimate, recordEstimateActual,
  findReusableZalopayOrderUrl, findActiveZalopayOrderUrl, insertZalopayTransaction,
  lockZalopayTransaction, markZalopayTransactionResult,
  assignOrderDriver,
} from "../db/orders.js";
import {
  lockVoucherByCode, countVoucherRedemptions, countVoucherRedemptionsByUser,
  insertVoucherRedemption, applyOrderVoucher,
} from "../db/vouchers.js";
import { buildPaymentUrl, verifySignature } from "../util/vnpay.js";
import { createOrder as createZalopayOrder, verifyCallbackMac as verifyZalopayMac, ZaloPayError } from "../util/zalopay.js";
import { calcEta, addMinutes, detectEtaDelay } from "../util/eta.js";
import { calcDiscountAmount, validateVoucherConditions } from "../util/voucher.js";
import { parseOrderPagination } from "../util/pagination.js";
import { isUuid } from "../util/ids.js";
import { HttpError, badRequest, sendHttpError } from "../util/httpError.js";
import { invalidUuid, invalidOptionalText, invalidInt, firstProblem } from "../util/validate.js";
import logger from "../util/logger.js";

const VALID_PAYMENT_METHODS = ["cod", "vnpay", "zalopay"];
const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const NEXT_STATUSES = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
const CANCELLABLE_STATUSES = ["pending", "confirmed"];
const MAX_ITEMS = 50;

// clientRequestId do app sinh bang UUID.randomUUID(), cung dinh dang voi khoa
// chinh - truoc day file nay giu mot ban copy cua UUID_PATTERN chi de kiem no.
const invalidRequestId = (value) => invalidUuid(value, "Mã yêu cầu");
const invalidOrderId = (value) => invalidUuid(value, "Mã đơn hàng");

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

// Smart ETA (rule-based, xem util/eta.js): chi don con 'pending' moi duoc
// tinh lai - don da 'confirmed'/'shipped' xem nhu nha hang da cam ket, giu
// nguyen baseline. Dung CHUNG mot query dem tai cho ca danh sach (khong tinh
// rieng tai tru chinh don dang xet) - du chinh xac voi muc do "canh bao" rule
// -based, khong can tuyet doi.
const attachEtaWarnings = async (rows, orders) => {
  const pendingIdx = [];
  rows.forEach((row, i) => {
    if (row.status === "pending" && orders[i] && orders[i].eta) pendingIdx.push(i);
  });
  if (pendingIdx.length === 0) return orders;

  const freshActiveOrdersCount = await countActiveOrders();
  for (const i of pendingIdx) {
    const row = rows[i];
    const order = orders[i];
    const { delayed, diffMinutes } = detectEtaDelay(order.eta.estimatedDeliveredAt, {
      prepBaseMinutes: row.eta_prep_base_minutes,
      freshActiveOrdersCount,
      confirmMinutes: order.eta.confirmMinutes,
      deliveryMinutes: order.eta.deliveryMinutes,
      createdAt: order.createdAt,
    });
    order.eta.delayed = delayed;
    order.eta.delayMinutes = delayed ? diffMinutes : 0;
  }
  return orders;
};

export const placeOrder = async (req, res) => {
  try {
    const { items, address, clientRequestId, paymentMethod, voucherCode } = req.body || {};

    const requestIdProblem = invalidRequestId(clientRequestId);
    if (requestIdProblem) return badRequest(res, requestIdProblem);

    // Chuoi rong = khong dung voucher, KHONG phai loi - app luon gui field nay,
    // co the rong khi khach khong nhap ma.
    const voucherCodeRaw = typeof voucherCode === "string" ? voucherCode.trim() : "";
    if (voucherCodeRaw.length > 50) return badRequest(res, "Mã giảm giá không hợp lệ");

    const normalizedPaymentMethod = VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : "cod";

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest(res, "Giỏ hàng trống");
    }
    if (items.length > MAX_ITEMS) {
      return badRequest(res, "Giỏ hàng có quá nhiều món");
    }
    if (!address || typeof address !== "object" || Array.isArray(address)
        || ![address.fullName, address.phone, address.address].every((value) =>
          typeof value === "string" && value.trim().length > 0)
        || typeof (address.note ?? "") !== "string"
        || address.fullName.length > 100 || address.phone.length > 30
        || address.address.length > 300 || (address.note || "").length > 500) {
      // Giu nguyen mot khoi dieu kien gop: ca bon truong deu tra ve CUNG mot
      // thong diep, nen tach thanh bon loi goi invalidText chi de lap lai
      // message bon lan - khong ro hon, lai de sai cho note (null la hop le).
      return badRequest(res, "Thiếu địa chỉ giao hàng");
    }
    // lat/lng optional (chon tren ban do - module Maps), khong bat buoc
    if ((address.lat !== undefined && address.lat !== null
          && !(Number.isFinite(Number(address.lat)) && Number(address.lat) >= -90 && Number(address.lat) <= 90))
        || (address.lng !== undefined && address.lng !== null
          && !(Number.isFinite(Number(address.lng)) && Number(address.lng) >= -180 && Number(address.lng) <= 180))) {
      return badRequest(res, "Toạ độ giao hàng không hợp lệ");
    }

    // Gop cac dong trung foodId va chuan hoa so luong truoc khi doi chieu voi DB
    const quantityByFoodId = new Map();
    for (const item of items) {
      // Hai if roi nhau, KHONG gop vao firstProblem: item co the la null, va
      // doc item.quantity truoc khi biet item hop le se nem TypeError -> 500.
      const foodId = item && item.foodId;
      const foodIdProblem = invalidUuid(foodId, "Món ăn");
      if (foodIdProblem) return badRequest(res, foodIdProblem);

      const quantityProblem = invalidInt(item.quantity, { label: "Số lượng món", min: 1, max: 100 });
      if (quantityProblem) return badRequest(res, quantityProblem);

      const quantity = Number(item.quantity);
      const key = String(foodId).toLowerCase();
      // Gop cac dong trung cung mot mon: tran 100 tinh tren TONG, khong tung dong
      const totalQuantity = (quantityByFoodId.get(key) || 0) + quantity;
      if (totalQuantity > 100) {
        return badRequest(res, "Số lượng món không hợp lệ");
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

      // Voucher: khoa dong vouchers theo code NGAY TRONG transaction dat hang -
      // moi giao dich dung cung ma deu phai doi o day, nen dem-roi-ghi ben
      // duoi la an toan truoc race condition (xem db/vouchers.js).
      let discountAmount = 0;
      let voucherIdApplied = null;
      let finalAmount = amount;

      if (voucherCodeRaw) {
        const voucher = await lockVoucherByCode(client, voucherCodeRaw);
        const voucherForCalc = voucher && {
          discountType: voucher.discount_type,
          discountValue: voucher.discount_value,
          maxDiscountAmount: voucher.max_discount_amount,
          minOrderValue: voucher.min_order_value,
          validFrom: voucher.valid_from,
          validUntil: voucher.valid_until,
          isActive: voucher.is_active,
        };

        const conditionProblem = validateVoucherConditions(voucherForCalc, amount);
        if (conditionProblem) throw new HttpError(400, conditionProblem);

        const totalUsed = await countVoucherRedemptions(client, voucher.id);
        if (voucher.usage_limit != null && totalUsed >= voucher.usage_limit) {
          throw new HttpError(400, "Mã giảm giá đã hết lượt sử dụng");
        }
        const usedByThisUser = await countVoucherRedemptionsByUser(client, voucher.id, req.userId);
        if (voucher.usage_limit_per_user != null && usedByThisUser >= voucher.usage_limit_per_user) {
          throw new HttpError(400, "Bạn đã dùng hết số lần được phép áp dụng mã này");
        }

        discountAmount = calcDiscountAmount(voucherForCalc, amount);
        finalAmount = amount - discountAmount;
        voucherIdApplied = voucher.id;
      }

      await applyOrderVoucher(client, orderId, { amount: finalAmount, discountAmount, voucherId: voucherIdApplied });
      if (voucherIdApplied) {
        await insertVoucherRedemption(client, {
          voucherId: voucherIdApplied, userId: req.userId, orderId, discountAmount,
        });
      }

      // Smart ETA: tinh baseline MOT LAN luc dat hang (xem util/eta.js).
      // excludeOrderId = chinh don nay - da duoc INSERT o tren voi status
      // 'pending' nen se tu tinh vao tai cua no neu khong tru ra.
      const createdAt = new Date();
      const eta = calcEta(
        foods.map((food) => ({ prepTimeMinutes: food.prep_time_minutes })),
        await countActiveOrders(client, orderId)
      );
      await insertDeliveryEstimate(client, orderId, {
        ...eta,
        estimatedReadyAt: addMinutes(createdAt, eta.confirmMinutes + eta.prepMinutes),
        estimatedDeliveredAt: addMinutes(createdAt, eta.totalMinutes),
      });

      await recordStatusChange(client, orderId, null, "pending", "customer", req.userId);

      // Chi bao "dat hang thanh cong" ngay cho COD - khong qua cong thanh toan
      // nen dat la xong. Don VNPay van duoc tao o day (de giu cho/chiem khoa
      // idempotency, tranh "khach da tra tien nhung khong con suat") nhung
      // CHUA bao cho khach: thong bao va ket qua tra ve chi den khi thanh toan
      // thanh cong (xem processVnpayResult).
      if (normalizedPaymentMethod === "cod") {
        await insertNotification(client, req.userId, "Đặt hàng thành công",
          `Đơn hàng #${shortCode(orderId)} đã được tạo, tổng tiền ${finalAmount.toLocaleString("vi-VN")}đ. `
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
      // Don VNPay/ZaloPay gui lai ma CHUA thanh toan: tra lai URL thanh toan
      // dang con han, hoac cap lan thanh toan moi neu lan truoc da that
      // bai/het han. Don da het han/huy -> 410 de app xoa yeu cau dang cho
      // va cho dat lai.
      if (["vnpay", "zalopay"].includes(existing.payment_method) && existing.payment_status !== "paid") {
        if (existing.status === "cancelled") {
          return res.status(410).json({ success: false, message: EXPIRED_MESSAGE });
        }
        const payUrl = existing.payment_method === "vnpay"
          ? await getOrIssuePayUrl(existing, req.ip)
          : await getOrIssueZaloPayOrder(existing);
        return res.json({ success: true, message: "Vui lòng hoàn tất thanh toán", payUrl });
      }
      const order = toOrder(existing);
      return res.json({ success: true, message: "Đơn hàng đã được tạo", orderId: order._id, order });
    }

    if (result.paymentMethod === "vnpay" || result.paymentMethod === "zalopay") {
      // KHONG tra orderId/order o day - day chinh la cho sua bug "bam Dat hang
      // la thay da dat hang xong roi moi hien man thanh toan". Server da tao
      // va giu cho don (tru kho, chiem khoa idempotency) nhung client khong
      // biet no ton tai; don chi "xuat hien" (GET /my, thong bao) sau khi
      // cong thanh toan bao thanh cong qua callback.
      const payUrl = result.paymentMethod === "vnpay"
        ? await getOrIssuePayUrl(result.order, req.ip)
        : await getOrIssueZaloPayOrder(result.order);
      return res.json({ success: true, message: "Vui lòng hoàn tất thanh toán", payUrl });
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

// Tra ve order_url cho mot don ZaloPay chua thanh toan - cung tinh than
// getOrIssuePayUrl (tai su dung url con han truoc khi cap moi), nhung ZaloPay
// can GOI API THAT de tao don (khac VNPay tu build URL khong can goi mang).
const getOrIssueZaloPayOrder = async (order) => {
  const reusable = await findReusableZalopayOrderUrl(order.id);
  if (reusable) return reusable;

  let created;
  try {
    created = await createZalopayOrder({
      orderId: order.id,
      amount: order.amount,
      description: `Thanh toan don hang ${shortCode(order.id)}`,
    });
  } catch (error) {
    if (error instanceof ZaloPayError) throw new HttpError(502, "Không tạo được đơn thanh toán ZaloPay, vui lòng thử lại");
    throw error;
  }

  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MINUTES * 60 * 1000);
  await withTransaction(async (client) => {
    await insertZalopayTransaction(client, {
      orderId: order.id, appTransId: created.appTransId, orderUrl: created.orderUrl, expiresAt,
    });
  });
  return created.orderUrl;
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
      await recordEstimateActual(client, order.id, "confirmed");
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

// Callback ZaloPay POST {data, mac}. QUAN TRONG: "data" la CHUOI JSON string
// (chua parse) - mac phai duoc tinh tren CHINH chuoi nay (xem util/zalopay.js),
// khong phai tren object da JSON.parse, vi JSON.stringify lai co the sinh ra
// chuoi khac byte-for-byte (thu tu key, khoang trang) lam mac khong khop.
//
// return_code tra ve theo tai lieu ZaloPay: 1 = thanh cong (ZaloPay se KHONG
// goi lai), khac 1 = loi/can goi lai. CHUA xac minh 100% cac ma loi chi tiet
// khac 1 - se doi chieu lai khi co sandbox that.
export const handleZalopayCallback = async (req, res) => {
  try {
    const { data, mac } = req.body || {};
    if (typeof data !== "string" || !verifyZalopayMac(data, mac)) {
      return res.json({ return_code: -1, return_message: "mac not match" });
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return res.json({ return_code: -1, return_message: "invalid data" });
    }
    const appTransId = String(payload.app_trans_id || "");

    await withTransaction(async (client) => {
      const txn = await lockZalopayTransaction(client, appTransId);
      // Khong ro giao dich nay - tra 1 de ZaloPay khong goi lai vo han cho
      // mot app_trans_id server khong cap (khong phai loi can sua)
      if (!txn) return;
      // Idempotent: callback den nhieu lan (Server gui lai khi chua nhan
      // duoc "return_code":1) chi xu ly MOT lan dau tien
      if (txn.status !== "pending") return;

      const order = await lockOrderById(client, txn.order_id);
      if (!order) return;

      const expectedAmount = Math.round(Number(order.amount));
      const paidAmount = Number(payload.amount);
      if (!Number.isFinite(paidAmount) || paidAmount !== expectedAmount) {
        logger.error(`ZaloPay amount mismatch cho don ${order.id}: nhan ${payload.amount}, cho doi ${expectedAmount}`);
        await markZalopayTransactionResult(client, appTransId, { status: "failed", raw: payload });
        return;
      }

      await markZalopayTransactionResult(client, appTransId,
        { status: "paid", zpTransId: payload.zp_trans_id, raw: payload });

      // Tien DA ve nhung khong the ghi nhan cho don nay (da huy/da paid tu
      // giao dich khac) - giu ban ghi, danh dau hoan tien (giong flagRefund VNPay)
      if (order.status === "cancelled" || order.payment_status === "paid" || order.payment_status === "refunded") {
        await flagRefund(client, order, payload.zp_trans_id);
        return;
      }

      const statusAfterPayment = await markPaymentPaid(client, order.id);
      if (statusAfterPayment === undefined) {
        await flagRefund(client, order, payload.zp_trans_id);
        return;
      }
      if (statusAfterPayment === "pending") {
        await setOrderStatus(client, order.id, "confirmed");
        await recordStatusChange(client, order.id, "pending", "confirmed", "system", null,
          "Thanh toan ZaloPay thanh cong");
        await recordEstimateActual(client, order.id, "confirmed");
      }
      await insertNotification(client, order.user_id, "Đặt hàng & thanh toán thành công",
        `Đơn hàng #${shortCode(order.id)} đã được tạo, tổng tiền ${Number(order.amount).toLocaleString("vi-VN")}đ, đã thanh toán qua ZaloPay.`);
    });

    res.json({ return_code: 1, return_message: "success" });
  } catch (error) {
    logger.error("Handle ZaloPay callback error:", error);
    res.json({ return_code: 0, return_message: "error" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const pagination = parseOrderPagination(req.query);
    if (!pagination) return badRequest(res, "Trang hoặc giới hạn không hợp lệ");
    const { page, limit, skip } = pagination;

    const status = req.query.status;
    if (status && !VALID_STATUSES.includes(status)) {
      return badRequest(res, "Trạng thái không hợp lệ");
    }

    const { rows, total } = await listOrdersForUser({ userId: req.userId, status, limit, skip });
    const orders = rows.map(toOrder);
    await attachEtaWarnings(rows, orders);
    res.json({
      success: true,
      orders,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalOrders: total },
    });
  } catch (error) {
    logger.error("Get my orders error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đơn hàng" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const problem = invalidOrderId(req.params.id);
    if (problem) return badRequest(res, problem);

    const row = await findOrderById(req.params.id);

    if (!row) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (row.user_id !== req.userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
    }

    const order = toOrder(row);
    await attachEtaWarnings([row], [order]);
    res.json({ success: true, order });
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
    const problem = invalidRequestId(req.params.clientRequestId);
    if (problem) return badRequest(res, problem);
    const row = await findOrderByRequestId(req.userId, req.params.clientRequestId);
    if (!row) {
      return res.status(404).json({ success: false, message: "Chưa tìm thấy đơn hàng" });
    }

    if (["vnpay", "zalopay"].includes(row.payment_method) && row.payment_status !== "paid") {
      if (row.status === "cancelled") {
        return res.status(410).json({ success: false, message: EXPIRED_MESSAGE });
      }
      // Van KHONG tra orderId/order: voi khach, don chi ton tai khi da tra tien
      const activePayUrl = row.payment_method === "vnpay"
        ? await findActivePayUrl(row.id)
        : await findActiveZalopayOrderUrl(row.id);
      const failed = row.payment_status === "failed";
      return res.json({
        success: true,
        paymentPending: true,
        paymentStatus: row.payment_status,
        payUrl: !failed && activePayUrl ? activePayUrl : undefined,
        paymentExpiresAt: row.payment_expires_at,
        message: failed
          ? "Thanh toán chưa thành công. Bạn có thể thanh toán lại hoặc hủy để chọn phương thức khác."
          : "Chưa nhận được xác nhận thanh toán. Nếu bạn đã thanh toán, vui lòng đợi ít phút rồi kiểm tra lại.",
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
    const problem = invalidRequestId(req.params.clientRequestId);
    if (problem) return badRequest(res, problem);
    const result = await withTransaction(async (client) => {
      const order = await lockOrderByRequestId(client, req.userId, req.params.clientRequestId);
      if (!order) throw new HttpError(404, "Không tìm thấy yêu cầu đặt hàng");

      if (!["vnpay", "zalopay"].includes(order.payment_method) || order.payment_status === "paid") {
        return { exists: true, order: await findOrderById(order.id, client) };
      }
      if (order.status === "cancelled") return { cancelled: true };

      await cancelOrderNow(client, order.id, "Khách hủy thanh toán");
      await restoreStock(client, order.id);
      await recordStatusChange(client, order.id, order.status, "cancelled", "customer",
        req.userId, "Khach huy thanh toan");
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

// Huy cac don VNPay/ZaloPay qua han thanh toan (+ thoi gian an han cho callback
// den tre) va hoan kho. Chay dinh ky tu server.js. FOR UPDATE SKIP LOCKED:
// nhieu instance chay cung luc khong xu ly trung, va khong cho callback dang
// giu khoa. Tien ve SAU khi don da bi huy o day se duoc processVnpayResult/
// processZalopayCallback danh dau refund_required, khong bao gio bi nuot.
export const expireStaleVnpayOrders = async ({ graceMinutes = EXPIRY_GRACE_MINUTES, batchSize = 100 } = {}) =>
  withTransaction(async (client) => {
    const stale = await lockStaleVnpayOrders(client, graceMinutes, batchSize);
    for (const order of stale) {
      await cancelOrderNow(client, order.id, "Hết hạn thanh toán");
      await restoreStock(client, order.id);
      await recordStatusChange(client, order.id, order.status, "cancelled", "system", null,
        "Het han thanh toan");
    }
    return stale.length;
  });

export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const problem = firstProblem(
      invalidOrderId(req.params.id),
      invalidOptionalText(reason, { label: "Lý do hủy", max: 500 }),
    );
    if (problem) return badRequest(res, problem);

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
    if (!pagination) return badRequest(res, "Trang hoặc giới hạn không hợp lệ");
    const { page, limit, skip } = pagination;

    const status = req.query.status;
    if (status && !VALID_STATUSES.includes(status)) {
      return badRequest(res, "Trạng thái không hợp lệ");
    }

    const { rows, total } = await listOrdersForAdmin({ status, limit, skip });
    const orders = rows.map(toOrder);
    await attachEtaWarnings(rows, orders);
    res.json({
      success: true,
      orders,
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
      return badRequest(res, "Trạng thái không hợp lệ");
    }
    const problem = invalidOrderId(req.params.id);
    if (problem) return badRequest(res, problem);

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
      await recordEstimateActual(client, order.id, status);
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

// Location Sharing (ban nhe): admin gan 1 tai xe cho 1 don - KHONG doi
// actor_role/trang thai don (tai xe chi chia se vi tri, khong tu chuyen
// trang thai trong ban nay). assignOrderDriver() tu kiem dieu kien (don
// confirmed/shipped, dich la driver that) ngay trong SQL.
export const assignDriver = async (req, res) => {
  try {
    const problem = invalidOrderId(req.params.id);
    if (problem) return badRequest(res, problem);
    const driverIdProblem = invalidUuid(req.body?.driverId, "Tài xế");
    if (driverIdProblem) return badRequest(res, driverIdProblem);

    const assigned = await withTransaction(async (client) => {
      const order = await lockOrderById(client, req.params.id);
      if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng");
      return assignOrderDriver(client, order.id, req.body.driverId);
    });

    if (!assigned) {
      return res.status(400).json({
        success: false,
        message: "Không thể gán tài xế: đơn hàng không ở trạng thái phù hợp hoặc người dùng không phải tài xế",
      });
    }

    const order = await findOrderById(req.params.id);
    res.json({ success: true, message: "Đã gán tài xế", order: toOrder(order) });
  } catch (error) {
    sendHttpError(res, error, "Lỗi khi gán tài xế",
      (e) => logger.error("Assign driver error:", e));
  }
};
