// Luong ZaloPay giong tinh than VNPay: dat hang KHONG tao mot don "nhin thay
// duoc" - server giu cho don o phia sau (tru kho, chiem khoa idempotency)
// nhung client chi nhan ve payUrl (= order_url cua ZaloPay). Don chi thuc su
// "xuat hien" sau khi callback ZaloPay bao thanh toan thanh cong.
import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";
process.env.ZALOPAY_APP_ID = "2553";
process.env.ZALOPAY_KEY1 = "test-key1";
process.env.ZALOPAY_KEY2 = "test-key2";

const skip = hasDb ? false : dbMissingReason;
let order;
let db;
const originalFetch = global.fetch;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  order = await import("../controllers/orderController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
afterEach(() => { global.fetch = originalFetch; });
after(async () => { if (hasDb) await closeDb(); });

const address = { fullName: "Khach", phone: "0900000000", address: "1 Duong ABC", note: "" };

const mockZalopayCreate = (orderUrl = "https://sbgateway.zalopay.vn/pay/fake") => {
  global.fetch = async () => ({
    json: async () => ({ return_code: 1, return_message: "success", order_url: orderUrl, zp_trans_token: "tok" }),
  });
};

// Dat mot don ZaloPay qua dung API cong khai (khong di tat qua makeOrder),
// giong ly do placeVnpayOrder trong vnpayCallback.db.test.js lam vay.
const placeZalopayOrder = async (foodId) => {
  const userId = await makeUser({ email: `khach-${randomUUID()}@test.local` });
  mockZalopayCreate();
  const response = makeResponse();
  await order.placeOrder({
    userId, ip: "127.0.0.1",
    body: {
      items: [{ foodId, quantity: 1 }], address,
      clientRequestId: randomUUID(), paymentMethod: "zalopay",
    },
  }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.ok(response.body.payUrl, "phai co payUrl");
  assert.equal(response.body.orderId, undefined, "khong duoc tra orderId khi chua thanh toan");
  assert.equal(response.body.order, undefined, "khong duoc tra order khi chua thanh toan");

  const { rows } = await db.query(
    "SELECT order_id, app_trans_id FROM zalopay_transactions ORDER BY created_at DESC LIMIT 1");
  return { userId, orderId: rows[0].order_id, appTransId: rows[0].app_trans_id, payUrl: response.body.payUrl };
};

const signCallback = (payload) => {
  const data = JSON.stringify(payload);
  const mac = crypto.createHmac("sha256", process.env.ZALOPAY_KEY2).update(data).digest("hex");
  return { data, mac };
};

const callback = async (payload) => {
  const response = makeResponse();
  await order.handleZalopayCallback({ body: signCallback(payload) }, response);
  return response;
};

const orderRow = async (orderId) =>
  (await db.query("SELECT status, payment_status FROM orders WHERE id = $1", [orderId])).rows[0];
const zalopayTxnRow = async (appTransId) =>
  (await db.query("SELECT status, zp_trans_id FROM zalopay_transactions WHERE app_trans_id = $1", [appTransId])).rows[0];

test("dat hang ZaloPay khong tra orderId/order - chi tra payUrl, don an khoi GET /my", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId } = await placeZalopayOrder(foodId);

  const list = makeResponse();
  await order.getMyOrders({ userId, query: {} }, list);
  assert.equal(list.body.orders.length, 0, "don chua thanh toan khong duoc hien");
});

test("callback hop le -> don chuyen pending->confirmed, payment_status=paid, co thong bao", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { userId, orderId, appTransId } = await placeZalopayOrder(foodId);

  const response = await callback({ app_trans_id: appTransId, amount: 65000, zp_trans_id: "zp123" });
  assert.equal(response.body.return_code, 1);

  const order1 = await orderRow(orderId);
  assert.equal(order1.status, "confirmed");
  assert.equal(order1.payment_status, "paid");

  const txn = await zalopayTxnRow(appTransId);
  assert.equal(txn.status, "paid");
  assert.equal(txn.zp_trans_id, "zp123");

  const list = makeResponse();
  await order.getMyOrders({ userId, query: {} }, list);
  assert.equal(list.body.orders.length, 1, "don phai xuat hien sau khi thanh toan thanh cong");

  assert.equal(await (await db.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n, 1);
});

test("callback sai mac -> tu choi, khong doi trang thai don", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, appTransId } = await placeZalopayOrder(foodId);

  const response = makeResponse();
  await order.handleZalopayCallback({
    body: { data: JSON.stringify({ app_trans_id: appTransId, amount: 65000 }), mac: "deadbeef" },
  }, response);
  assert.equal(response.body.return_code, -1);

  const row = await orderRow(orderId);
  assert.equal(row.status, "pending");
  assert.equal(row.payment_status, "unpaid");
});

test("callback sai so tien -> danh dau zalopay_transactions.status=failed, KHONG xac nhan don", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { orderId, appTransId } = await placeZalopayOrder(foodId);

  await callback({ app_trans_id: appTransId, amount: 999, zp_trans_id: "zp1" });

  const row = await orderRow(orderId);
  assert.equal(row.status, "pending");
  assert.equal(row.payment_status, "unpaid");
  assert.equal((await zalopayTxnRow(appTransId)).status, "failed");
});

test("callback goi lai nhieu lan (idempotent) chi xu ly MOT lan, khong tao them thong bao", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000 });
  const { appTransId } = await placeZalopayOrder(foodId);

  await callback({ app_trans_id: appTransId, amount: 65000, zp_trans_id: "zp1" });
  const notifAfterFirst = (await db.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n;

  const second = await callback({ app_trans_id: appTransId, amount: 65000, zp_trans_id: "zp1" });
  assert.equal(second.body.return_code, 1, "van tra thanh cong de ZaloPay khong goi lai vo han");
  const notifAfterSecond = (await db.query("SELECT count(*)::int AS n FROM notifications")).rows[0].n;
  assert.equal(notifAfterSecond, notifAfterFirst, "goi lai khong duoc tao them thong bao");
});

test("app_trans_id khong ro (server chua tung cap) -> van tra return_code=1, khong loi 500", { skip }, async () => {
  const response = await callback({ app_trans_id: "khong-ton-tai-123", amount: 1000 });
  assert.equal(response.body.return_code, 1);
});

test("khach bo thanh toan ZaloPay dang cho -> huy don, hoan kho, idempotent", { skip }, async () => {
  const categoryId = await makeCategory();
  const foodId = await makeFood(categoryId, { price: 65000, stock: 5, trackStock: true });
  const userId = await makeUser({ email: `khach-${randomUUID()}@test.local` });
  mockZalopayCreate();

  const placed = makeResponse();
  const clientRequestId = randomUUID();
  await order.placeOrder({
    userId, ip: "127.0.0.1",
    body: { items: [{ foodId, quantity: 2 }], address, clientRequestId, paymentMethod: "zalopay" },
  }, placed);
  assert.equal(placed.statusCode, 200);

  const stockAfterPlace = (await db.query("SELECT stock FROM foods WHERE id = $1", [foodId])).rows[0].stock;
  assert.equal(stockAfterPlace, 3, "da tru kho luc dat hang");

  const abandon = makeResponse();
  await order.abandonPendingPayment({ userId, params: { clientRequestId } }, abandon);
  assert.equal(abandon.statusCode, 200);

  const stockAfterAbandon = (await db.query("SELECT stock FROM foods WHERE id = $1", [foodId])).rows[0].stock;
  assert.equal(stockAfterAbandon, 5, "phai hoan lai kho sau khi bo thanh toan");

  // Goi lai lan 2 van phai tra 200 (idempotent), khong loi
  const abandonAgain = makeResponse();
  await order.abandonPendingPayment({ userId, params: { clientRequestId } }, abandonAgain);
  assert.equal(abandonAgain.statusCode, 200);
});

// expireStaleVnpayOrders xu ly chung ca VNPay va ZaloPay (xem db/orders.js) -
// kiem tra rieng de dam bao don ZaloPay het han CUNG duoc huy + hoan kho,
// khong bi bo sot vi ten ham con mang dau vet "Vnpay".
test("job het han cung huy duoc don ZaloPay qua han va hoan kho", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { price: 65000, stock: 3, trackStock: true });
  const { orderId } = await placeZalopayOrder(foodId);
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [foodId])).rows[0].stock, 2);

  await db.query("UPDATE orders SET payment_expires_at = now() - interval '1 hour' WHERE id = $1", [orderId]);
  assert.equal(await order.expireStaleVnpayOrders({ graceMinutes: 0 }), 1);

  const row = await orderRow(orderId);
  assert.equal(row.status, "cancelled");
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [foodId])).rows[0].stock, 3,
    "suat cua don ZaloPay het han duoc tra lai");

  // Callback thanh cong den tre van duoc ghi nhan refund_required, khong mat tien
  const response = await callback({ app_trans_id: (await db.query(
    "SELECT app_trans_id FROM zalopay_transactions WHERE order_id = $1", [orderId])).rows[0].app_trans_id,
    amount: 65000, zp_trans_id: "zp-tre" });
  assert.equal(response.body.return_code, 1);
  const afterLateCallback = (await db.query(
    "SELECT payment_status, refund_required FROM orders WHERE id = $1", [orderId])).rows[0];
  assert.equal(afterLateCallback.refund_required, true);
});
