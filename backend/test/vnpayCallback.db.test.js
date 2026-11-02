// Luong VNPay: dat hang KHONG tao mot don "nhin thay duoc" - server giu cho
// don o phia sau (tru kho, chiem khoa idempotency) nhung client chi nhan ve
// payUrl, khong he co orderId/order. Don chi thuc su "xuat hien" (hien trong
// GET /my, co thong bao) sau khi callback VNPay bao thanh toan thanh cong.
// Day la bo test cho chinh hanh vi do - truoc day dat hang la thay don xuat
// hien ngay (GET /my) roi moi den man thanh toan, dung nhu bug duoc bao.
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import querystring from "node:querystring";
import { randomUUID } from "node:crypto";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeOrder, countRows,
} from "./helpers/db.mjs";

process.env.VNPAY_TMN_CODE = "TEST01";
process.env.VNPAY_HASH_SECRET = "secret-sandbox-chi-dung-trong-test";
process.env.VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
process.env.VNPAY_RETURN_URL = "http://localhost:5000/api/order/vnpay/return";

const skip = hasDb ? false : dbMissingReason;
let order;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  order = await import("../controllers/orderController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
after(async () => { if (hasDb) await closeDb(); });

const address = { fullName: "Khach", phone: "0900000000", address: "1 Duong ABC", note: "" };

// Ky giong thuat toan VNPay de gia lap callback hop le
const signVnpay = (params) => {
  const sorted = {};
  for (const key of Object.keys(params).sort()) {
    sorted[key] = encodeURIComponent(String(params[key])).replace(/%20/g, "+");
  }
  const data = querystring.stringify(sorted, undefined, undefined, { encodeURIComponent: (v) => v });
  return crypto.createHmac("sha512", process.env.VNPAY_HASH_SECRET)
    .update(Buffer.from(data, "utf-8")).digest("hex");
};

const callback = ({ txnRef, amountVnd, responseCode = "00", transactionStatus = "00",
  transactionNo = "14000001", tmnCode = "TEST01" }) => {
  const params = {
    vnp_Amount: String(Math.round(amountVnd * 100)),
    vnp_BankCode: "NCB",
    vnp_CardType: "ATM",
    vnp_OrderInfo: "Thanh toan don hang",
    vnp_PayDate: "20261024120000",
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: tmnCode,
    vnp_TransactionNo: transactionNo,
    vnp_TransactionStatus: transactionStatus,
    vnp_TxnRef: txnRef,
  };
  return { ...params, vnp_SecureHash: signVnpay(params) };
};

// Dat mot don VNPay qua dung API cong khai (khong di tat qua makeOrder), vi
// request_fingerprint va vnp_txn_ref phai duoc tinh dung nhu mot client that -
// day la dieu kien de cac nhanh "gui lai cung clientRequestId" o duoi hoat dong.
const placeVnpayOrder = async (foodId, amount, extra = {}) => {
  const userId = extra.userId || await makeUser({ email: extra.email || `khach-${randomUUID()}@test.local` });
  const clientRequestId = randomUUID();
  const response = makeResponse();
  await order.placeOrder({
    userId,
    ip: "127.0.0.1",
    body: {
      items: [{ foodId, quantity: 1 }],
      address,
      clientRequestId,
      paymentMethod: "vnpay",
    },
  }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.ok(response.body.payUrl, "phai co payUrl");
  // Day la cho chinh de kiem bug: KHONG duoc co orderId/order trong response
  assert.equal(response.body.orderId, undefined, "khong duoc tra orderId khi chua thanh toan");
  assert.equal(response.body.order, undefined, "khong duoc tra order khi chua thanh toan");

  const txnRef = new URL(response.body.payUrl).searchParams.get("vnp_TxnRef");
  const orderId = txnRef.slice(0, txnRef.lastIndexOf("-"));
  return { userId, clientRequestId, orderId, txnRef, amount, payUrl: response.body.payUrl };
};

const paymentStatusOf = async (orderId) =>
  (await db.query("SELECT payment_status, status FROM orders WHERE id = $1", [orderId])).rows[0];

test("dat hang VNPay khong tra orderId/order - chi tra payUrl", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 90000 });
  const { userId, txnRef, orderId, payUrl } = await placeVnpayOrder(foodId, 90000);

  assert.ok(txnRef.startsWith(orderId));
  assert.ok(payUrl.includes("vnp_Amount=9000000"), "so tien phai nhan 100");

  // Don co that tren server (giu cho/tru kho) nhung KHONG duoc thay o GET /my -
  // day chinh la hanh vi dung thay cho bug "da dat hang roi moi thanh toan"
  const list = makeResponse();
  await order.getMyOrders({ userId, query: {} }, list);
  assert.equal(list.body.orders.length, 0, "don chua thanh toan khong duoc hien");
});

test("don VNPay chua thanh toan: an khoi GET /my, /list, /stats va getOrderByRequestId", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, clientRequestId, orderId } = await placeVnpayOrder(foodId, 65000);
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });

  const my = makeResponse();
  await order.getMyOrders({ userId, query: {} }, my);
  assert.equal(my.body.orders.length, 0);

  const list = makeResponse();
  await order.listAllOrders({ userId: adminId, query: {} }, list);
  assert.equal(list.body.orders.length, 0, "admin cung khong thay don chua thanh toan");

  const stats = makeResponse();
  await order.getOrderStats({ userId: adminId, query: {} }, stats);
  assert.equal(stats.body.totalOrders, 0, "thong ke khong dem don chua thanh toan");
  assert.equal(stats.body.byStatus.find((s) => s.status === "pending").count, 0);

  // Khong con tra 404 (404 lam app tu POST lai va server cap payUrl moi - goc
  // cua loi "payUrl da thanh toan bi vo hieu"). Gio bao "dang cho thanh toan"
  // va van KHONG lo orderId/order.
  const byRequestId = makeResponse();
  await order.getOrderByRequestId({ userId, params: { clientRequestId } }, byRequestId);
  assert.equal(byRequestId.statusCode, 200);
  assert.equal(byRequestId.body.paymentPending, true);
  assert.equal(byRequestId.body.paymentStatus, "unpaid");
  assert.ok(byRequestId.body.payUrl, "tra lai payUrl dang con han de mo lai");
  assert.equal(byRequestId.body.orderId, undefined);
  assert.equal(byRequestId.body.order, undefined);

  // Ngay ca GET /:id truc tiep (neu ai do co id) cung khong lo thong tin don
  // cho NGUOI KHONG LIEN QUAN - quyen so huu van duoc giu nguyen
  const outsider = await makeUser({ email: "nguoila@test.local" });
  const direct = makeResponse();
  await order.getOrderById({ userId: outsider, user: { isAdmin: false }, params: { id: orderId } }, direct);
  assert.equal(direct.statusCode, 403);
});

test("thanh toan thanh cong -> don xuat hien o GET /my, /list, /stats va getOrderByRequestId", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, clientRequestId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });

  const ipn = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount }) }, ipn);
  assert.equal(ipn.body.RspCode, "00");

  const my = makeResponse();
  await order.getMyOrders({ userId, query: {} }, my);
  assert.equal(my.body.orders.length, 1);
  assert.equal(my.body.orders[0]._id, orderId);
  assert.equal(my.body.orders[0].paymentStatus, "paid");

  const list = makeResponse();
  await order.listAllOrders({ userId: adminId, query: {} }, list);
  assert.equal(list.body.orders.length, 1);

  const stats = makeResponse();
  await order.getOrderStats({ userId: adminId, query: {} }, stats);
  assert.equal(stats.body.totalOrders, 1);

  const byRequestId = makeResponse();
  await order.getOrderByRequestId({ userId, params: { clientRequestId } }, byRequestId);
  assert.equal(byRequestId.statusCode, 200);
  assert.equal(byRequestId.body.orderId, orderId);
});

test("don COD khong bao gio co payUrl trong response", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const userId = await makeUser();
  const response = makeResponse();
  await order.placeOrder({
    userId, ip: "127.0.0.1",
    body: { items: [{ foodId, quantity: 1 }], address, clientRequestId: randomUUID(), paymentMethod: "cod" },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.ok(response.body.orderId, "COD van phai tra orderId ngay - khong qua cong thanh toan");
  assert.equal(response.body.payUrl, undefined);
});

test("gui lai cung clientRequestId khi CHUA thanh toan -> tra lai DUNG payUrl cu, khong tao don trung", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const userId = await makeUser();
  const clientRequestId = randomUUID();
  const body = { items: [{ foodId, quantity: 1 }], address, clientRequestId, paymentMethod: "vnpay" };

  const first = makeResponse();
  await order.placeOrder({ userId, ip: "127.0.0.1", body }, first);
  const second = makeResponse();
  await order.placeOrder({ userId, ip: "127.0.0.1", body }, second);

  assert.equal(second.statusCode, 200);
  assert.ok(second.body.payUrl);
  // Cap txnRef moi o day chinh la cach payUrl khach DANG thanh toan bi vo hieu
  assert.equal(second.body.payUrl, first.body.payUrl, "payUrl con han thi phai dung lai");
  assert.equal(await countRows("orders"), 1, "van chi mot don duy nhat o phia server");
  assert.equal(await countRows("payment_attempts"), 1);
});

test("gui lai cung clientRequestId SAU KHI da thanh toan -> tra ve don, khong tao payUrl moi", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, clientRequestId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount }) }, makeResponse());

  const again = makeResponse();
  await order.placeOrder({
    userId, ip: "127.0.0.1",
    body: { items: [{ foodId, quantity: 1 }], address, clientRequestId, paymentMethod: "vnpay" },
  }, again);

  assert.equal(again.statusCode, 200);
  assert.equal(again.body.orderId, orderId, "don da thanh toan thi tra ve don that, khong phai payUrl");
  assert.equal(again.body.payUrl, undefined);
});

test("don VNPay da bi huy thi khong cap lai payUrl", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const userId = await makeUser();
  const clientRequestId = randomUUID();
  const body = { items: [{ foodId, quantity: 1 }], address, clientRequestId, paymentMethod: "vnpay" };

  const first = makeResponse();
  await order.placeOrder({ userId, ip: "127.0.0.1", body }, first);
  const txnRef = new URL(first.body.payUrl).searchParams.get("vnp_TxnRef");
  const orderId = txnRef.slice(0, txnRef.lastIndexOf("-"));
  // Gia lap admin huy don (vi du don giu cho qua lau) - huy truc tiep bang SQL
  // vi don chua "ton tai" voi client nen khong co API nao de huy no qua HTTP.
  await db.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);

  const retry = makeResponse();
  await order.placeOrder({ userId, ip: "127.0.0.1", body }, retry);
  // 410: app doc 4xx nay la "xoa yeu cau dang cho, cho dat lai"
  assert.equal(retry.statusCode, 410);
  assert.equal(retry.body.payUrl, undefined);
});

test("chu ky gia bi tu choi va KHONG doi payment_status", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  const fake = { ...callback({ txnRef, amountVnd: amount }), vnp_SecureHash: "0".repeat(128) };

  const response = makeResponse();
  await order.handleVnpayIpn({ query: fake }, response);
  assert.equal(response.body.RspCode, "97");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
  assert.equal(await countRows("payments"), 0, "chu ky sai thi khong ghi ledger");
});

test("SO TIEN khong khop -> RspCode 04 va khong doi payment_status", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, txnRef } = await placeVnpayOrder(foodId, 65000);
  // Chu ky HOP LE nhung so tien khac so tien cua don
  const tampered = callback({ txnRef, amountVnd: 1000 });

  const response = makeResponse();
  await order.handleVnpayIpn({ query: tampered }, response);
  assert.equal(response.body.RspCode, "04");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
  assert.equal(await countRows("payments"), 0);
});

test("vnp_TransactionStatus that bai thi khong tinh la da tra tien", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  // ResponseCode 00 nhung TransactionStatus 02: chuan 2.1.0 yeu cau kiem CA HAI
  const response = makeResponse();
  await order.handleVnpayIpn(
    { query: callback({ txnRef, amountVnd: amount, transactionStatus: "02" }) }, response);

  assert.equal(response.body.RspCode, "00");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "failed");
});

test("vnp_TmnCode la cua merchant khac -> tu choi", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  const response = makeResponse();
  await order.handleVnpayIpn(
    { query: callback({ txnRef, amountVnd: amount, tmnCode: "MERCHANT-KHAC" }) }, response);

  assert.equal(response.body.RspCode, "02");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
});

test("vnp_TxnRef server chua tung cap cho don -> tu choi (01), khong ghi ledger", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, amount } = await placeVnpayOrder(foodId, 65000);

  const response = makeResponse();
  await order.handleVnpayIpn(
    { query: callback({ txnRef: `${orderId}-123456789`, amountVnd: amount }) }, response);
  assert.equal(response.body.RspCode, "01");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
  assert.equal(await countRows("payments"), 0);
});

test("callback hop le -> paid, pending chuyen sang confirmed, ghi ledger va thong bao", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);

  const response = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount }) }, response);
  assert.equal(response.body.RspCode, "00");

  const afterRow = await paymentStatusOf(orderId);
  assert.equal(afterRow.payment_status, "paid");
  assert.equal(afterRow.status, "confirmed");

  // Ledger luu du lieu de doi soat voi sao ke VNPay
  const ledger = await db.query("SELECT * FROM payments WHERE order_id = $1", [orderId]);
  assert.equal(ledger.rowCount, 1);
  assert.equal(ledger.rows[0].vnp_transaction_no, "14000001");
  assert.equal(Number(ledger.rows[0].vnp_amount), amount * 100);
  assert.equal(ledger.rows[0].vnp_bank_code, "NCB");
  assert.ok(ledger.rows[0].raw, "luu nguyen payload de tra lai khi khach khieu nai");

  // Day la thong bao DAU TIEN ma khach nhan ve don nay - luc dat hang server
  // khong bao gi ca (xem placeOrder)
  assert.equal(await countRows("notifications", "WHERE user_id = $1", [userId]), 1);
  // ORDER BY bat buoc: order_status_history co 2 dong cho don nay (luc tao
  // ghi to_status='pending', luc thanh toan ghi 'confirmed'), khong sap xep
  // thi Postgres khong dam bao thu tu tra ve.
  const history = await db.query(
    "SELECT to_status, actor_role FROM order_status_history WHERE order_id = $1 ORDER BY id DESC LIMIT 1",
    [orderId]);
  assert.equal(history.rows[0].to_status, "confirmed");
  assert.equal(history.rows[0].actor_role, "system");
});

test("Return URL va IPN cung mot giao dich -> chi mot ban ghi, mot thong bao", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  const query = callback({ txnRef, amountVnd: amount });

  const returnRes = makeResponse();
  await order.handleVnpayReturn({ query }, returnRes);
  const ipnRes = makeResponse();
  await order.handleVnpayIpn({ query }, ipnRes);

  assert.equal(ipnRes.body.RspCode, "00", "goi lai phai idempotent, khong bao loi");
  assert.equal(await countRows("payments", "WHERE order_id = $1", [orderId]), 1);
  assert.equal(await countRows("notifications", "WHERE user_id = $1", [userId]), 1, "khong duoc gui thong bao hai lan");
});

test("Return URL va IPN ve SONG SONG -> van chi mot ban ghi", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  const query = callback({ txnRef, amountVnd: amount });

  // Hai callback ve cung luc cung di qua check "da paid chua" - UPDATE co
  // dieu kien payment_status='unpaid' dam bao chi mot cai thang
  await Promise.all([
    order.handleVnpayReturn({ query }, makeResponse()),
    order.handleVnpayIpn({ query }, makeResponse()),
  ]);

  assert.equal(await countRows("payments", "WHERE order_id = $1", [orderId]), 1);
  assert.equal(await countRows("notifications", "WHERE user_id = $1", [userId]), 1);
  assert.equal((await paymentStatusOf(orderId)).payment_status, "paid");
});

// ---------------------------------------------------------------------------
// Tai hien hai loi Critical trong ban review ngay 02/11/2026

const resend = (userId, foodId, clientRequestId) => {
  const response = makeResponse();
  return order.placeOrder({
    userId, ip: "127.0.0.1",
    body: { items: [{ foodId, quantity: 1 }], address, clientRequestId, paymentMethod: "vnpay" },
  }, response).then(() => response);
};

test("CRITICAL #1: that bai mot lan, thanh toan lai thanh cong -> don PAID va hien ra", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, clientRequestId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);

  // Lan 1: khach bam huy tren cong VNPay (24), VNPay gui TransactionNo = 0
  const firstIpn = makeResponse();
  await order.handleVnpayIpn({ query: callback({
    txnRef, amountVnd: amount, responseCode: "24", transactionStatus: "02", transactionNo: "0",
  }) }, firstIpn);
  assert.equal(firstIpn.body.RspCode, "00");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "failed");

  // App bam "Thanh toan lai" -> lan truoc that bai nen phai co txnRef MOI
  const retry = await resend(userId, foodId, clientRequestId);
  assert.equal(retry.statusCode, 200);
  const newRef = new URL(retry.body.payUrl).searchParams.get("vnp_TxnRef");
  assert.notEqual(newRef, txnRef);

  // Lan 2 thanh cong. Truoc khi sua: UPDATE ... WHERE payment_status = 'unpaid'
  // khong khop, don van 'failed' va bi an trong khi VNPay da tru tien.
  const secondIpn = makeResponse();
  await order.handleVnpayIpn(
    { query: callback({ txnRef: newRef, amountVnd: amount, transactionNo: "14000002" }) }, secondIpn);
  assert.equal(secondIpn.body.RspCode, "00");

  const row = await paymentStatusOf(orderId);
  assert.equal(row.payment_status, "paid");
  assert.equal(row.status, "confirmed");

  const my = makeResponse();
  await order.getMyOrders({ userId, query: {} }, my);
  assert.equal(my.body.orders.length, 1, "don da tra tien phai hien voi khach");

  const byRequestId = makeResponse();
  await order.getOrderByRequestId({ userId, params: { clientRequestId } }, byRequestId);
  assert.equal(byRequestId.body.orderId, orderId);
  assert.equal(await countRows("notifications", "WHERE user_id = $1 AND title = $2",
    [userId, "Đặt hàng & thanh toán thành công"]), 1);
});

test("CRITICAL #2: IPN cua payUrl cu ve SAU khi da cap payUrl moi van duoc ghi nhan", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, clientRequestId, orderId, txnRef: firstRef, amount } = await placeVnpayOrder(foodId, 65000);

  // Lan thanh toan dau that bai -> app cap lan thanh toan moi (txnRef moi)
  await order.handleVnpayIpn({ query: callback({
    txnRef: firstRef, amountVnd: amount, responseCode: "24", transactionStatus: "02", transactionNo: "0",
  }) }, makeResponse());
  const retry = await resend(userId, foodId, clientRequestId);
  const secondRef = new URL(retry.body.payUrl).searchParams.get("vnp_TxnRef");
  assert.notEqual(secondRef, firstRef);

  // Gia su khach van thanh toan duoc tren tab cu (txnRef dau tien). Truoc khi
  // sua: txnRef khong con khop vnp_txn_ref moi nhat -> RspCode 02, khong ghi
  // ledger, tien mat dau vet.
  const lateIpn = makeResponse();
  await order.handleVnpayIpn(
    { query: callback({ txnRef: firstRef, amountVnd: amount, transactionNo: "14000003" }) }, lateIpn);
  assert.equal(lateIpn.body.RspCode, "00");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "paid");
  assert.equal(await countRows("payments", "WHERE vnp_transaction_no = $1", ["14000003"]), 1);
});

test("CRITICAL #2: kiem tra lai truoc khi IPN ve -> 'dang cho', KHONG cap txnRef moi", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, clientRequestId, orderId, txnRef, amount, payUrl } = await placeVnpayOrder(foodId, 65000);

  // Khach vua tra tien xong, quay lai app bam "Kiem tra" truoc khi IPN den
  const check = makeResponse();
  await order.getOrderByRequestId({ userId, params: { clientRequestId } }, check);
  assert.equal(check.statusCode, 200);
  assert.equal(check.body.paymentPending, true);
  assert.equal(check.body.payUrl, payUrl);

  // Ke ca khi app cu van POST lai, txnRef cung khong doi
  const again = await resend(userId, foodId, clientRequestId);
  assert.equal(again.body.payUrl, payUrl);
  assert.equal(await countRows("payment_attempts", "WHERE order_id = $1", [orderId]), 1);

  const ipn = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount }) }, ipn);
  assert.equal(ipn.body.RspCode, "00");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "paid");
});

test("payUrl co vnp_ExpireDate theo gio Viet Nam", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { payUrl } = await placeVnpayOrder(foodId, 65000);
  const params = new URL(payUrl).searchParams;
  const created = params.get("vnp_CreateDate");
  const expires = params.get("vnp_ExpireDate");
  assert.match(created, /^\d{14}$/);
  assert.match(expires, /^\d{14}$/);
  assert.ok(expires > created, "han thanh toan phai sau luc tao");
});

test("tien ve cho don DA HET HAN -> khong mat tien: ghi ledger + refund_required, admin thay don", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });
  await db.query("UPDATE orders SET payment_expires_at = now() - interval '1 hour' WHERE id = $1", [orderId]);
  assert.equal(await order.expireStaleVnpayOrders({ graceMinutes: 0 }), 1);

  const ipn = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount }) }, ipn);
  assert.equal(ipn.body.RspCode, "00", "da ghi nhan giao dich, VNPay khong can goi lai");

  const row = (await db.query(
    "SELECT status, payment_status, refund_required FROM orders WHERE id = $1", [orderId])).rows[0];
  assert.equal(row.status, "cancelled");
  assert.notEqual(row.payment_status, "paid", "constraint: khong the vua paid vua cancelled");
  assert.equal(row.refund_required, true);
  assert.equal(await countRows("payments", "WHERE order_id = $1", [orderId]), 1);

  const list = makeResponse();
  await order.listAllOrders({ userId: adminId, query: {} }, list);
  assert.equal(list.body.orders.length, 1, "admin phai thay don can hoan tien");
  assert.equal(list.body.orders[0].refundRequired, true);
  assert.equal(await countRows("notifications", "WHERE user_id = $1 AND title = $2",
    [userId, "Thanh toán sẽ được hoàn lại"]), 1);
});

test("khach tra HAI LAN cho cung mot don -> lan hai danh dau refund_required", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount, transactionNo: "1" }) }, makeResponse());
  const second = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount, transactionNo: "2" }) }, second);

  assert.equal(second.body.RspCode, "00");
  const row = (await db.query(
    "SELECT payment_status, refund_required FROM orders WHERE id = $1", [orderId])).rows[0];
  assert.equal(row.payment_status, "paid");
  assert.equal(row.refund_required, true);
  assert.equal(await countRows("payments", "WHERE order_id = $1", [orderId]), 2);
});

// ---------------------------------------------------------------------------
// Het han thanh toan va huy / doi phuong thuc

test("job het han huy don VNPay qua han va hoan kho; bo qua don con han va don da tra", { skip }, async () => {
  const categoryId = await makeCategory();
  const tracked = await makeFood(categoryId, { name: "Mon dem suat", price: 50000, stock: 5, trackStock: true });
  const stale = await placeVnpayOrder(tracked, 50000);
  const fresh = await placeVnpayOrder(tracked, 50000);
  const paid = await placeVnpayOrder(tracked, 50000);
  await order.handleVnpayIpn({ query: callback({ txnRef: paid.txnRef, amountVnd: 50000 }) }, makeResponse());
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [tracked])).rows[0].stock, 2);

  await db.query("UPDATE orders SET payment_expires_at = now() - interval '40 minutes' WHERE id = ANY($1)",
    [[stale.orderId, paid.orderId]]);
  // An han 15 phut: qua han 40 phut thi huy
  assert.equal(await order.expireStaleVnpayOrders({ graceMinutes: 15 }), 1);

  assert.equal((await paymentStatusOf(stale.orderId)).status, "cancelled");
  assert.equal((await paymentStatusOf(fresh.orderId)).status, "pending");
  assert.equal((await paymentStatusOf(paid.orderId)).status, "confirmed");
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [tracked])).rows[0].stock, 3,
    "suat cua don het han duoc tra lai");
  const history = await db.query(
    "SELECT actor_role FROM order_status_history WHERE order_id = $1 AND to_status = 'cancelled'",
    [stale.orderId]);
  assert.equal(history.rows[0].actor_role, "system");

  // App kiem tra lai -> 410, va gui lai cung khong hoi sinh duoc don
  const check = makeResponse();
  await order.getOrderByRequestId({ userId: stale.userId, params: { clientRequestId: stale.clientRequestId } }, check);
  assert.equal(check.statusCode, 410);

  // Chay lai khong lam gi them
  assert.equal(await order.expireStaleVnpayOrders({ graceMinutes: 15 }), 0);
});

test("huy thanh toan VNPay dang cho -> huy don, hoan kho, idempotent", { skip }, async () => {
  const tracked = await makeFood(await makeCategory(), { price: 50000, stock: 2, trackStock: true });
  const { userId, clientRequestId, orderId } = await placeVnpayOrder(tracked, 50000);
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [tracked])).rows[0].stock, 1);

  for (let i = 0; i < 2; i += 1) {
    const response = makeResponse();
    await order.abandonPendingPayment({ userId, params: { clientRequestId } }, response);
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  }
  assert.equal((await paymentStatusOf(orderId)).status, "cancelled");
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [tracked])).rows[0].stock, 2,
    "chi hoan kho mot lan du goi hai lan");
});

test("huy thanh toan: ma chua toi server -> 404; don COD that -> 409 kem don; nguoi khac -> 404", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const userId = await makeUser();

  const unknown = makeResponse();
  await order.abandonPendingPayment({ userId, params: { clientRequestId: randomUUID() } }, unknown);
  assert.equal(unknown.statusCode, 404);

  const clientRequestId = randomUUID();
  const placed = makeResponse();
  await order.placeOrder({ userId, ip: "127.0.0.1", body: {
    items: [{ foodId, quantity: 1 }], address, clientRequestId, paymentMethod: "cod",
  } }, placed);
  const cod = makeResponse();
  await order.abandonPendingPayment({ userId, params: { clientRequestId } }, cod);
  assert.equal(cod.statusCode, 409);
  assert.equal(cod.body.orderId, placed.body.orderId);
  assert.equal((await paymentStatusOf(placed.body.orderId)).status, "pending", "don COD khong bi huy");

  const vnpay = await placeVnpayOrder(foodId, 65000);
  const outsider = makeResponse();
  await order.abandonPendingPayment(
    { userId: await makeUser({ email: "nguoila@test.local" }), params: { clientRequestId: vnpay.clientRequestId } },
    outsider);
  assert.equal(outsider.statusCode, 404);
  assert.equal((await paymentStatusOf(vnpay.orderId)).status, "pending");
});

test("don VNPay da tra tien: khong hien nut Huy (isCancellable = false)", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, orderId, txnRef, amount } = await placeVnpayOrder(foodId, 65000);
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount }) }, makeResponse());

  const detail = makeResponse();
  await order.getOrderById({ userId, user: { isAdmin: false }, params: { id: orderId } }, detail);
  assert.equal(detail.body.order.isCancellable, false);
});
