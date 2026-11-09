import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeOrder, countRows,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";

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

test("invalid pagination returns 400 before querying the database", { skip }, async () => {
  const userId = await makeUser();
  for (const query of [{ page: "0" }, { limit: "51" }, { page: "abc" }]) {
    const response = makeResponse();
    await order.getMyOrders({ userId, query }, response);
    assert.equal(response.statusCode, 400, JSON.stringify(query));
  }
});

test("a stale status update returns conflict without creating a notification", { skip }, async () => {
  const userId = await makeUser();
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });
  const orderId = await makeOrder(userId, { status: "confirmed" });

  // Gia lap: co nguoi doi trang thai truoc, nen lan doi nay da lac hau
  const first = makeResponse();
  await order.updateOrderStatus(
    { userId: adminId, params: { id: orderId }, body: { status: "shipped" } }, first);
  assert.equal(first.statusCode, 200);

  const notificationsAfterFirst = await countRows("notifications");

  // Doi lai tu confirmed -> shipped mot lan nua: gio trang thai la shipped
  const stale = makeResponse();
  await order.updateOrderStatus(
    { userId: adminId, params: { id: orderId }, body: { status: "shipped" } }, stale);
  assert.equal(stale.statusCode, 400, "shipped -> shipped khong phai chuyen doi hop le");
  assert.equal(await countRows("notifications"), notificationsAfterFirst,
    "lan that bai khong duoc sinh thong bao");
});

test("skipping a status is rejected", { skip }, async () => {
  const userId = await makeUser();
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });
  const orderId = await makeOrder(userId, { status: "pending" });

  const response = makeResponse();
  await order.updateOrderStatus(
    { userId: adminId, params: { id: orderId }, body: { status: "delivered" } }, response);
  assert.equal(response.statusCode, 400);

  const { rows } = await db.query("SELECT status FROM orders WHERE id = $1", [orderId]);
  assert.equal(rows[0].status, "pending", "trang thai khong duoc doi");
});

test("moi lan doi trang thai duoc ghi vao order_status_history", { skip }, async () => {
  const userId = await makeUser();
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });
  const orderId = await makeOrder(userId, { status: "pending" });

  for (const status of ["confirmed", "shipped", "delivered"]) {
    const response = makeResponse();
    await order.updateOrderStatus(
      { userId: adminId, params: { id: orderId }, body: { status } }, response);
    assert.equal(response.statusCode, 200, status);
  }

  const { rows } = await db.query(
    "SELECT from_status, to_status, actor_role, changed_by FROM order_status_history WHERE order_id = $1 ORDER BY id",
    [orderId]
  );
  // Ban Mongo chi luu status hien tai nen khong biet don sang shipped luc nao
  assert.deepEqual(rows.map((r) => `${r.from_status}>${r.to_status}`),
    ["pending>confirmed", "confirmed>shipped", "shipped>delivered"]);
  assert.ok(rows.every((r) => r.actor_role === "admin" && r.changed_by === adminId),
    "phai ghi lai ai doi trang thai - day la audit log");
});

test("repeated checkout returns the original order and creates one notification", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  const request = placeReq(userId, foodId);

  const first = makeResponse();
  await order.placeOrder(request, first);
  assert.equal(first.statusCode, 201);

  const again = makeResponse();
  await order.placeOrder(request, again);
  assert.equal(again.statusCode, 200, "gui lai cung clientRequestId tra ve don cu");
  assert.equal(again.body.orderId, first.body.orderId);

  assert.equal(await countRows("orders"), 1);
  assert.equal(await countRows("notifications"), 1, "khong duoc sinh thong bao lan hai");
});

test("concurrent checkout with one request id creates only one order", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  const request = placeReq(userId, foodId);

  const responses = [makeResponse(), makeResponse(), makeResponse()];
  await Promise.all(responses.map((response) => order.placeOrder({ ...request }, response)));

  assert.equal(await countRows("orders"), 1, "3 request song song chi tao 1 don");
  const created = responses.filter((r) => r.statusCode === 201);
  const replayed = responses.filter((r) => r.statusCode === 200);
  assert.equal(created.length, 1);
  assert.equal(replayed.length, 2);
  // Tat ca phai tra ve cung mot orderId
  const ids = new Set(responses.map((r) => r.body.orderId));
  assert.equal(ids.size, 1);
});

test("cung clientRequestId nhung gio hang khac -> 409", { skip }, async () => {
  const userId = await makeUser();
  const categoryId = await makeCategory();
  const foodId = await makeFood(categoryId);
  const otherFoodId = await makeFood(categoryId, { name: "Bún bò" });
  const clientRequestId = randomUUID();

  const first = makeResponse();
  await order.placeOrder(
    { userId, body: { items: [{ foodId, quantity: 1 }], address, clientRequestId } }, first);
  assert.equal(first.statusCode, 201);

  const different = makeResponse();
  await order.placeOrder(
    { userId, body: { items: [{ foodId: otherFoodId, quantity: 1 }], address, clientRequestId } },
    different);
  assert.equal(different.statusCode, 409);
  assert.equal(await countRows("orders"), 1);
});

test("hai don SONG SONG tren mon con 1 suat chi mot don thanh cong", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { stock: 1, trackStock: true });

  const responses = [makeResponse(), makeResponse()];
  await Promise.all([
    order.placeOrder(placeReq(userId, foodId), responses[0]),
    order.placeOrder(placeReq(userId, foodId), responses[1]),
  ]);

  const ok = responses.filter((r) => r.statusCode === 201).length;
  assert.equal(ok, 1, `chi duoc 1 don thanh cong, thuc te ${ok}`);
  assert.equal(await countRows("orders"), 1, "khong duoc co don mo coi");

  const { rows } = await db.query("SELECT stock FROM foods WHERE id = $1", [foodId]);
  assert.equal(rows[0].stock, 0, "ton kho khong duoc am");
});

test("mon khong bat track_stock thi khong bi gioi han (giu hanh vi ban Mongo)", { skip }, async () => {
  const userId = await makeUser();
  // App Android khong gui field stock khi admin them mon, nen mon do phai dat
  // duoc binh thuong
  const foodId = await makeFood(await makeCategory(), { stock: 0, trackStock: false });

  const response = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), response);
  assert.equal(response.statusCode, 201);
});

test("huy don hoan lai ton kho", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { stock: 5, trackStock: true });

  const placed = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), placed);
  assert.equal(placed.statusCode, 201);
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [foodId])).rows[0].stock, 4);

  const cancelled = makeResponse();
  await order.cancelOrder(
    { userId, params: { id: placed.body.orderId }, body: { reason: "doi y" } }, cancelled);
  assert.equal(cancelled.statusCode, 200);
  assert.equal((await db.query("SELECT stock FROM foods WHERE id = $1", [foodId])).rows[0].stock, 5,
    "huy don phai tra lai suat da giu");
});

// Luu y: viec "tao thanh toan VNPay cho don da huy" khong con la mot endpoint
// rieng (xem test/vnpayCallback.db.test.js "don VNPay da bi huy thi khong cap
// lai payUrl" - gio di qua chinh placeOrder() khi gui lai cung clientRequestId).

test("khong huy duoc don DA THANH TOAN, phai hoan tien truoc", { skip }, async () => {
  const userId = await makeUser();
  const orderId = await makeOrder(userId, {
    status: "confirmed", paymentMethod: "vnpay", paymentStatus: "paid",
  });

  const response = makeResponse();
  await order.cancelOrder({ userId, params: { id: orderId }, body: { reason: "doi y" } }, response);
  assert.equal(response.statusCode, 409);

  const { rows } = await db.query("SELECT status FROM orders WHERE id = $1", [orderId]);
  assert.equal(rows[0].status, "confirmed", "don khong duoc chuyen sang cancelled");
});

test("constraint DB chan trang thai vua paid vua cancelled", { skip }, async () => {
  const userId = await makeUser();
  const orderId = await makeOrder(userId, { paymentStatus: "paid", status: "confirmed" });

  await assert.rejects(
    () => db.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]),
    (error) => error.constraint === "orders_paid_not_cancelled"
  );

  // Duong hop phap: hoan tien truoc, roi moi huy
  await db.query("UPDATE orders SET payment_status = 'refunded' WHERE id = $1", [orderId]);
  await db.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);
  const { rows } = await db.query(
    "SELECT status, payment_status FROM orders WHERE id = $1", [orderId]);
  assert.equal(rows[0].status, "cancelled");
  assert.equal(rows[0].payment_status, "refunded");
});

test("order stats fill missing statuses with zero and sum delivered revenue", { skip }, async () => {
  const userId = await makeUser();
  await makeOrder(userId, { status: "delivered", amount: 100000 });
  await makeOrder(userId, { status: "delivered", amount: 50000 });
  await makeOrder(userId, { status: "pending", amount: 70000 });

  const response = makeResponse();
  await order.getOrderStats({ query: {} }, response);
  assert.equal(response.statusCode, 200);

  const { byStatus, totalOrders, totalRevenue, last7Days } = response.body;
  assert.equal(byStatus.length, 5, "phai co du 5 trang thai ke ca trang thai khong co don");
  assert.deepEqual(byStatus.map((s) => s.status),
    ["pending", "confirmed", "shipped", "delivered", "cancelled"]);
  assert.equal(byStatus.find((s) => s.status === "delivered").count, 2);
  assert.equal(byStatus.find((s) => s.status === "shipped").count, 0);
  assert.equal(totalOrders, 3);
  assert.equal(totalRevenue, 150000, "doanh thu chi tinh don delivered");
  // generate_series dam bao du 7 ngay, ke ca ngay khong co don
  assert.equal(last7Days.length, 7);
});

test("getMyOrders chi tra don cua chinh minh", { skip }, async () => {
  const mine = await makeUser({ email: "toi@test.local" });
  const other = await makeUser({ email: "nguoikhac@test.local" });
  await makeOrder(mine);
  await makeOrder(other);
  await makeOrder(other);

  const response = makeResponse();
  await order.getMyOrders({ userId: mine, query: {} }, response);
  assert.equal(response.body.orders.length, 1);
  assert.equal(response.body.pagination.totalOrders, 1);
});

test("getOrderById chan nguoi khong lien quan nhung cho admin xem", { skip }, async () => {
  const owner = await makeUser({ email: "chu@test.local" });
  const outsider = await makeUser({ email: "nguoila@test.local" });
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });
  const orderId = await makeOrder(owner);

  const byOutsider = makeResponse();
  await order.getOrderById(
    { userId: outsider, user: { isAdmin: false }, params: { id: orderId } }, byOutsider);
  assert.equal(byOutsider.statusCode, 403);

  const byOwner = makeResponse();
  await order.getOrderById(
    { userId: owner, user: { isAdmin: false }, params: { id: orderId } }, byOwner);
  assert.equal(byOwner.statusCode, 200);

  const byAdmin = makeResponse();
  await order.getOrderById(
    { userId: adminId, user: { isAdmin: true }, params: { id: orderId } }, byAdmin);
  assert.equal(byAdmin.statusCode, 200);
});

test("id sai dinh dang tra 400 chu khong phai 500", { skip }, async () => {
  const userId = await makeUser();
  // Ban Mongo nem CastError nen roi vao catch va tra 500: client khong phan
  // biet duoc "id sai" voi "server chet"
  const response = makeResponse();
  await order.getOrderById(
    { userId, user: { isAdmin: false }, params: { id: "khong-phai-uuid" } }, response);
  assert.equal(response.statusCode, 400);
});

test("don tra ve dung hinh JSON ma app Android cho doi", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  const placed = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), placed);

  const created = placed.body.order;
  // Nhung field nay la hop dong voi Gson - doi la vo client
  assert.ok(created._id, "_id phai co (Gson doc @SerializedName(\"_id\"))");
  assert.equal(typeof created._id, "string");
  assert.equal(typeof created.amount, "number", "amount phai la number, khong phai string");
  assert.equal(created.items.length, 1);
  assert.equal(typeof created.items[0].price, "number");
  assert.equal(typeof created.items[0].foodId, "string");
  assert.deepEqual(Object.keys(created.address).sort(),
    ["address", "fullName", "note", "phone"]);
  assert.equal(created.isCancellable, true);
  assert.ok(created.date, "app doc Order.date");
});

test("placeOrder snapshot dung lat/lng khi dia chi co toa do, null khi khong co", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());

  const withCoords = makeResponse();
  await order.placeOrder(
    placeReq(userId, foodId, { address: { ...address, lat: 10.7769, lng: 106.7009 } }),
    withCoords);
  assert.equal(withCoords.statusCode, 201);
  assert.equal(withCoords.body.order.shipLat, 10.7769);
  assert.equal(withCoords.body.order.shipLng, 106.7009);

  const withoutCoords = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), withoutCoords);
  assert.equal(withoutCoords.body.order.shipLat, null);
  assert.equal(withoutCoords.body.order.shipLng, null);
});

test("placeOrder tu choi lat/lng ngoai pham vi toa do thuc", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());

  const response = makeResponse();
  await order.placeOrder(
    placeReq(userId, foodId, { address: { ...address, lat: 999, lng: 106.7 } }),
    response);
  assert.equal(response.statusCode, 400);
});
