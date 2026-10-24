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

  const byRequestId = makeResponse();
  await order.getOrderByRequestId({ userId, params: { clientRequestId } }, byRequestId);
  assert.equal(byRequestId.statusCode, 404, "giong het 'chua dat duoc' de app tu resubmit");

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

test("gui lai cung clientRequestId khi CHUA thanh toan -> cap payUrl MOI, khong tao don trung", { skip }, async () => {
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
  assert.notEqual(second.body.payUrl, first.body.payUrl, "txnRef phai doi moi lan de tranh payUrl cu con hieu luc");
  assert.equal(await countRows("orders"), 1, "van chi mot don duy nhat o phia server");
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
  assert.equal(retry.statusCode, 400);
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

test("vnp_TxnRef cu (payUrl sinh tu lan truoc) bi tu choi", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, clientRequestId, orderId, txnRef: oldRef, amount } = await placeVnpayOrder(foodId, 65000);

  // Goi lai placeOrder voi cung clientRequestId -> vnp_txn_ref trong DB doi
  await order.placeOrder({
    userId, ip: "127.0.0.1",
    body: { items: [{ foodId, quantity: 1 }], address, clientRequestId, paymentMethod: "vnpay" },
  }, makeResponse());

  const response = makeResponse();
  await order.handleVnpayIpn({ query: callback({ txnRef: oldRef, amountVnd: amount }) }, response);
  // Truoc day vnpTxnRef duoc ghi vao DB roi khong bao gio doc lai, nen mot
  // payUrl sinh ra tu lan truoc van thanh toan duoc vinh vien.
  assert.equal(response.body.RspCode, "02");
  assert.equal((await paymentStatusOf(orderId)).payment_status, "unpaid");
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
