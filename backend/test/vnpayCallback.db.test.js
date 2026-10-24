// Ba handler VNPay trong controller truoc day KHONG co unit test nao - chi
// util/vnpay.js (ham ky) duoc test. Day la lo hong coverage nang nhat cua ban
// Mongo vi no nam tren duong tien: chu ky duoc canh phong can mat trong khi
// noi dung giao dich (so tien, ma giao dich, trang thai) khong ai kiem.
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import querystring from "node:querystring";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeOrder, countRows,
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

// Tao don vnpay va lay vnp_TxnRef ma backend sinh ra
const prepareOrder = async (amount = 65000) => {
  const userId = await makeUser();
  const orderId = await makeOrder(userId, {
    paymentMethod: "vnpay", paymentStatus: "unpaid", status: "pending", amount,
  });
  const response = makeResponse();
  await order.createVnpayPayment({ userId, params: { id: orderId }, ip: "127.0.0.1" }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  const { rows } = await db.query("SELECT vnp_txn_ref FROM orders WHERE id = $1", [orderId]);
  return { userId, orderId, txnRef: rows[0].vnp_txn_ref, amount };
};

const paymentStatusOf = async (orderId) =>
  (await db.query("SELECT payment_status, status FROM orders WHERE id = $1", [orderId])).rows[0];

test("payUrl gui so tien x100 va giu dung ma merchant", { skip }, async () => {
  const { txnRef, orderId } = await prepareOrder(90000);
  assert.ok(txnRef.startsWith(orderId));

  const userId = await makeUser({ email: "khac@test.local" });
  const foreign = makeResponse();
  await order.createVnpayPayment({ userId, params: { id: orderId }, ip: "1.1.1.1" }, foreign);
  assert.equal(foreign.statusCode, 403, "nguoi khac khong tao duoc thanh toan cho don nay");
});

test("chu ky gia bi tu choi va KHONG doi payment_status", { skip }, async () => {
  const { orderId, txnRef, amount } = await prepareOrder();
  const fake = { ...callback({ txnRef, amountVnd: amount }), vnp_SecureHash: "0".repeat(128) };

  const response = makeResponse();
  await order.handleVnpayIpn({ query: fake }, response);
  assert.equal(response.body.RspCode, "97");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
  assert.equal(await countRows("payments"), 0, "chu ky sai thi khong ghi ledger");
});

test("SO TIEN khong khop -> RspCode 04 va khong doi payment_status", { skip }, async () => {
  const { orderId, txnRef } = await prepareOrder(65000);
  // Chu ky HOP LE nhung so tien khac so tien cua don
  const tampered = callback({ txnRef, amountVnd: 1000 });

  const response = makeResponse();
  await order.handleVnpayIpn({ query: tampered }, response);
  // Ban Mongo chi doc vnp_ResponseCode nen khoan nay se duoc ghi nhan la da
  // thanh toan du khach chi tra 1.000d cho don 65.000d.
  assert.equal(response.body.RspCode, "04");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
  assert.equal(await countRows("payments"), 0);
});

test("vnp_TransactionStatus that bai thi khong tinh la da tra tien", { skip }, async () => {
  const { orderId, txnRef, amount } = await prepareOrder();
  // ResponseCode 00 nhung TransactionStatus 02: chuan 2.1.0 yeu cau kiem CA HAI
  const response = makeResponse();
  await order.handleVnpayIpn(
    { query: callback({ txnRef, amountVnd: amount, transactionStatus: "02" }) }, response);

  assert.equal(response.body.RspCode, "00");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "failed");
});

test("vnp_TmnCode la cua merchant khac -> tu choi", { skip }, async () => {
  const { orderId, txnRef, amount } = await prepareOrder();
  const response = makeResponse();
  await order.handleVnpayIpn(
    { query: callback({ txnRef, amountVnd: amount, tmnCode: "MERCHANT-KHAC" }) }, response);

  assert.equal(response.body.RspCode, "02");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
});

test("vnp_TxnRef cu (payUrl sinh tu lan truoc) bi tu choi", { skip }, async () => {
  const { userId, orderId, txnRef: oldRef, amount } = await prepareOrder();

  // Tao payUrl moi -> vnp_txn_ref trong DB doi
  const again = makeResponse();
  await order.createVnpayPayment({ userId, params: { id: orderId }, ip: "127.0.0.1" }, again);

  const response = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef: oldRef, amountVnd: amount }) }, response);
  // Ban Mongo ghi vnpTxnRef vao DB roi khong bao gio doc lai, nen mot payUrl
  // sinh ra tu thang truoc van thanh toan duoc vinh vien.
  assert.equal(response.body.RspCode, "02");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
});

test("callback hop le -> paid, pending chuyen sang confirmed, ghi ledger va thong bao", { skip }, async () => {
  const { orderId, txnRef, amount } = await prepareOrder();

  const response = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef, amountVnd: amount }) }, response);
  assert.equal(response.body.RspCode, "00");

  const after = await paymentStatusOf(orderId);
  assert.equal(after.payment_status, "paid");
  assert.equal(after.status, "confirmed");

  // Ledger luu du lieu de doi soat voi sao ke VNPay - ban Mongo vut bo het
  const ledger = await db.query("SELECT * FROM payments WHERE order_id = $1", [orderId]);
  assert.equal(ledger.rowCount, 1);
  assert.equal(ledger.rows[0].vnp_transaction_no, "14000001");
  assert.equal(Number(ledger.rows[0].vnp_amount), amount * 100);
  assert.equal(ledger.rows[0].vnp_bank_code, "NCB");
  assert.ok(ledger.rows[0].raw, "luu nguyen payload de tra lai khi khach khieu nai");

  assert.equal(await countRows("notifications"), 1);
  const history = await db.query(
    "SELECT to_status, actor_role FROM order_status_history WHERE order_id = $1", [orderId]);
  assert.equal(history.rows[0].to_status, "confirmed");
  assert.equal(history.rows[0].actor_role, "system");
});

test("Return URL va IPN cung mot giao dich -> chi mot ban ghi, mot thong bao", { skip }, async () => {
  const { orderId, txnRef, amount } = await prepareOrder();
  const query = callback({ txnRef, amountVnd: amount });

  const returnRes = makeResponse();
  await order.handleVnpayReturn({ query }, returnRes);
  const ipnRes = makeResponse();
  await order.handleVnpayIpn({ query }, ipnRes);

  assert.equal(ipnRes.body.RspCode, "00", "goi lai phai idempotent, khong bao loi");
  assert.equal(await countRows("payments", "WHERE order_id = $1", [orderId]), 1);
  assert.equal(await countRows("notifications"), 1, "khong duoc gui thong bao hai lan");
});

test("Return URL va IPN ve SONG SONG -> van chi mot ban ghi", { skip }, async () => {
  const { orderId, txnRef, amount } = await prepareOrder();
  const query = callback({ txnRef, amountVnd: amount });

  // Ban Mongo dung findById -> sua -> save() nen hai callback song song cung di
  // qua check "da paid chua", tao hai thong bao va 'failed' co the ghi de 'paid'
  await Promise.all([
    order.handleVnpayReturn({ query }, makeResponse()),
    order.handleVnpayIpn({ query }, makeResponse()),
  ]);

  assert.equal(await countRows("payments", "WHERE order_id = $1", [orderId]), 1);
  assert.equal(await countRows("notifications"), 1);
  assert.equal((await paymentStatusOf(orderId)).payment_status, "paid");
});

test("khong tao duoc payUrl cho don da thanh toan", { skip }, async () => {
  const userId = await makeUser();
  const orderId = await makeOrder(userId, {
    paymentMethod: "vnpay", paymentStatus: "paid", status: "confirmed",
  });
  const response = makeResponse();
  await order.createVnpayPayment({ userId, params: { id: orderId }, ip: "127.0.0.1" }, response);
  assert.equal(response.statusCode, 400);
});

test("don COD khong tao duoc thanh toan VNPay", { skip }, async () => {
  const userId = await makeUser();
  const orderId = await makeOrder(userId, { paymentMethod: "cod" });
  const response = makeResponse();
  await order.createVnpayPayment({ userId, params: { id: orderId }, ip: "127.0.0.1" }, response);
  assert.equal(response.statusCode, 400);
});
