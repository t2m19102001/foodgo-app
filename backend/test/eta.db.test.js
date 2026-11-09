import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeOrder,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";

// Co dinh config Smart ETA cho ca file nay, khong phu thuoc .env ambient -
// cho phep doi chieu ket qua bang tay (xem cong thuc trong tung test).
process.env.ETA_CONFIRM_MINUTES = "5";
process.env.ETA_PREP_EXTRA_ITEM_MINUTES = "2";
process.env.ETA_PREP_MAX_MINUTES = "60";
process.env.ETA_DELIVERY_MINUTES = "20";
process.env.ETA_LOAD_LOW_THRESHOLD = "5";
process.env.ETA_LOAD_MEDIUM_THRESHOLD = "15";
process.env.ETA_LOAD_MEDIUM_FACTOR = "1.2";
process.env.ETA_LOAD_HIGH_FACTOR = "1.5";
process.env.ETA_SIGNIFICANT_CHANGE_MINUTES = "10";

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
const placeReq = (userId, foodId, extra = {}) => ({
  userId,
  body: {
    items: [{ foodId, quantity: 1 }],
    address,
    clientRequestId: randomUUID(),
    ...extra,
  },
});

const findEstimate = async (orderId) => {
  const { rows } = await db.query("SELECT * FROM delivery_estimates WHERE order_id = $1", [orderId]);
  return rows[0];
};

// Tao n don 'pending' cua mot khach khac, chi de day "tai he thong" len -
// khong dinh gi den don dang test.
const seedPendingOrders = async (foodId, n) => {
  const fillerId = await makeUser({ email: `filler-${randomUUID()}@test.local` });
  for (let i = 0; i < n; i += 1) {
    await makeOrder(fillerId, { status: "pending", foodId });
  }
};

test("placeOrder tinh va luu dung baseline Smart ETA khi khong co don nao khac dang cho", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { prepTimeMinutes: 10 });

  const response = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), response);
  assert.equal(response.statusCode, 201);

  const estimate = await findEstimate(response.body.orderId);
  assert.equal(estimate.distinct_items_count, 1);
  assert.equal(estimate.active_orders_at_creation, 0, "khong tinh chinh don vua tao vao tai cua no");
  assert.equal(estimate.prep_base_minutes, 10, "1 mon, khong phu phi");
  assert.equal(Number(estimate.load_factor), 1);
  assert.equal(estimate.confirm_minutes, 5);
  assert.equal(estimate.prep_minutes, 10);
  assert.equal(estimate.delivery_minutes, 20);
  assert.equal(estimate.total_minutes, 35, "5 + 10 + 20");
  assert.equal(estimate.actual_confirmed_at, null);
  assert.equal(estimate.actual_shipped_at, null);
  assert.equal(estimate.actual_delivered_at, null);

  // orderId cung tra ve "eta" trong JSON response, dung hinh camelCase
  assert.equal(response.body.order.eta.totalMinutes, 35);
  assert.equal(response.body.order.eta.prepMinutes, 10);
});

test("placeOrder nhan he so tai dung theo so don active hien co (nguong trung binh/cao)", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { prepTimeMinutes: 10 });

  // 6 don active > nguong thap (5) -> tai TRUNG BINH -> he so 1.2
  await seedPendingOrders(foodId, 6);
  const medium = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), medium);
  assert.equal(medium.statusCode, 201);
  const mediumEstimate = await findEstimate(medium.body.orderId);
  assert.equal(mediumEstimate.active_orders_at_creation, 6);
  assert.equal(Number(mediumEstimate.load_factor), 1.2);
  assert.equal(mediumEstimate.prep_minutes, 12, "ceil(10 * 1.2)");

  // Them don de vuot nguong trung binh (15) -> tai CAO -> he so 1.5
  await seedPendingOrders(foodId, 10); // tong active truoc don moi: 6 + 1 (don medium) + 10 = 17
  const high = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), high);
  assert.equal(high.statusCode, 201);
  const highEstimate = await findEstimate(high.body.orderId);
  assert.equal(highEstimate.active_orders_at_creation, 17);
  assert.equal(Number(highEstimate.load_factor), 1.5);
  assert.equal(highEstimate.prep_minutes, 15, "ceil(10 * 1.5)");
});

test("updateOrderStatus ghi actual_*_at dung tung buoc, khong dung lai cac cot khac", { skip }, async () => {
  const userId = await makeUser();
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });
  const foodId = await makeFood(await makeCategory(), { prepTimeMinutes: 10 });

  const placed = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), placed);
  const orderId = placed.body.orderId;

  for (const status of ["confirmed", "shipped", "delivered"]) {
    const response = makeResponse();
    await order.updateOrderStatus({ userId: adminId, params: { id: orderId }, body: { status } }, response);
    assert.equal(response.statusCode, 200, status);
  }

  const estimate = await findEstimate(orderId);
  assert.ok(estimate.actual_confirmed_at, "phai ghi thoi diem xac nhan");
  assert.ok(estimate.actual_shipped_at, "phai ghi thoi diem giao cho tai xe");
  assert.ok(estimate.actual_delivered_at, "phai ghi thoi diem giao xong");
  assert.ok(estimate.actual_confirmed_at <= estimate.actual_shipped_at);
  assert.ok(estimate.actual_shipped_at <= estimate.actual_delivered_at);
  // Baseline khong bi doi khi ghi actual
  assert.equal(estimate.total_minutes, 35);
});

test("huy don khong ghi actual nao vao delivery_estimates", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { prepTimeMinutes: 10 });

  const placed = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), placed);
  const orderId = placed.body.orderId;

  const cancelled = makeResponse();
  await order.cancelOrder({ userId, params: { id: orderId }, body: { reason: "Doi y" } }, cancelled);
  assert.equal(cancelled.statusCode, 200);

  const estimate = await findEstimate(orderId);
  assert.equal(estimate.actual_confirmed_at, null);
  assert.equal(estimate.actual_shipped_at, null);
  assert.equal(estimate.actual_delivered_at, null);
});

test("getOrderById canh bao delayed khi tai thuc te tang manh sau khi dat hang", { skip }, async () => {
  const userId = await makeUser();
  // Mon nang (30 phut) de do lech du vuot nguong canh bao (10 phut) ngay ca
  // khi he so tai toi da chi la 1.5
  const foodId = await makeFood(await makeCategory(), { prepTimeMinutes: 30 });

  const placed = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), placed);
  const orderId = placed.body.orderId;
  assert.equal(placed.body.order.eta.totalMinutes, 55, "5 + 30 + 20, tai thap luc dat");

  // Day tai he thong len CAO (>15 don active) SAU khi don nay da dat
  await seedPendingOrders(foodId, 16);

  const response = makeResponse();
  await order.getOrderById({ userId, user: { isAdmin: false }, params: { id: orderId } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.order.eta.delayed, true);
  assert.equal(response.body.order.eta.delayMinutes, 15, "tong moi 70 - tong goc 55");
  // Khong de lo prepBaseMinutes (field noi bo) ra JSON cuoi
  assert.equal(response.body.order.eta.prepBaseMinutes, undefined);
});

test("getMyOrders tra ve eta cho tung don, delayed=false khi tai khong doi", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { prepTimeMinutes: 10 });

  const placed = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), placed);

  const response = makeResponse();
  await order.getMyOrders({ userId, query: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.orders.length, 1);
  assert.equal(response.body.orders[0].eta.delayed, false);
  assert.equal(response.body.orders[0].eta.totalMinutes, 35);
});

test("don tao truoc khi co Smart ETA (khong co row delivery_estimates) tra eta=null, khong crash", { skip }, async () => {
  const userId = await makeUser();
  // makeOrder() khong di qua placeOrder nen khong tao row delivery_estimates -
  // mo phong don dat TRUOC migration 006.
  const orderId = await makeOrder(userId, { status: "pending" });

  const response = makeResponse();
  await order.getOrderById({ userId, user: { isAdmin: false }, params: { id: orderId } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.order.eta, null);
});
