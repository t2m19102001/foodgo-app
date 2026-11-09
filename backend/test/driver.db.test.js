// Location Sharing (ban nhe) - khong co dieu phoi tu dong, admin gan tay 1
// tai xe/don; tai xe chi chia se vi tri, khong tu doi trang thai don.
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeOrder,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";

const skip = hasDb ? false : dbMissingReason;
let order;
let driver;
let auth;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  order = await import("../controllers/orderController.js");
  driver = await import("../controllers/driverController.js");
  auth = await import("../controllers/authController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
after(async () => { if (hasDb) await closeDb(); });

test("assignDriver: thanh cong khi don confirmed/shipped va dich la driver that", { skip }, async () => {
  const customerId = await makeUser({ email: "customer@test.local" });
  const driverId = await makeUser({ email: "driver@test.local", isDriver: true });
  const foodId = await makeFood(await makeCategory());
  const orderId = await makeOrder(customerId, { status: "confirmed", foodId });

  const response = makeResponse();
  await order.assignDriver({ params: { id: orderId }, body: { driverId } }, response);
  assert.equal(response.statusCode, 200);

  const row = (await db.query("SELECT driver_id FROM orders WHERE id = $1", [orderId])).rows[0];
  assert.equal(row.driver_id, driverId);
});

test("assignDriver: tu choi khi dich KHONG phai tai xe (is_driver=false)", { skip }, async () => {
  const customerId = await makeUser({ email: "customer@test.local" });
  const notDriverId = await makeUser({ email: "not-driver@test.local" });
  const foodId = await makeFood(await makeCategory());
  const orderId = await makeOrder(customerId, { status: "confirmed", foodId });

  const response = makeResponse();
  await order.assignDriver({ params: { id: orderId }, body: { driverId: notDriverId } }, response);
  assert.equal(response.statusCode, 400);

  const row = (await db.query("SELECT driver_id FROM orders WHERE id = $1", [orderId])).rows[0];
  assert.equal(row.driver_id, null);
});

test("assignDriver: tu choi khi don dang o trang thai pending/delivered/cancelled", { skip }, async () => {
  const customerId = await makeUser({ email: "customer@test.local" });
  const driverId = await makeUser({ email: "driver@test.local", isDriver: true });
  const foodId = await makeFood(await makeCategory());

  for (const status of ["pending", "delivered", "cancelled"]) {
    const orderId = await makeOrder(customerId, { status, foodId });
    const response = makeResponse();
    await order.assignDriver({ params: { id: orderId }, body: { driverId } }, response);
    assert.equal(response.statusCode, 400, status);
  }
});

test("getMyDeliveries: tai xe chi thay don CUA CHINH MINH, dang 'shipped'", { skip }, async () => {
  const customerId = await makeUser({ email: "customer@test.local" });
  const driverA = await makeUser({ email: "driver-a@test.local", isDriver: true });
  const driverB = await makeUser({ email: "driver-b@test.local", isDriver: true });
  const foodId = await makeFood(await makeCategory());

  const shippedForA = await makeOrder(customerId, { status: "shipped", foodId });
  await db.query("UPDATE orders SET driver_id = $2 WHERE id = $1", [shippedForA, driverA]);
  const confirmedForA = await makeOrder(customerId, { status: "confirmed", foodId });
  await db.query("UPDATE orders SET driver_id = $2 WHERE id = $1", [confirmedForA, driverA]);
  const shippedForB = await makeOrder(customerId, { status: "shipped", foodId });
  await db.query("UPDATE orders SET driver_id = $2 WHERE id = $1", [shippedForB, driverB]);

  const response = makeResponse();
  await driver.getMyDeliveries({ userId: driverA }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.orders.map((o) => o._id), [shippedForA],
    "chi thay don 'shipped' cua chinh minh - khong thay don 'confirmed' (chua giao) hay don cua driver khac");
});

test("updateMyLocation: upsert dung vi tri CUA CHINH tai xe dang goi", { skip }, async () => {
  const driverId = await makeUser({ email: "driver@test.local", isDriver: true });

  const first = makeResponse();
  await driver.updateMyLocation({ userId: driverId, body: { lat: 10.77, lng: 106.70 } }, first);
  assert.equal(first.statusCode, 200);

  const second = makeResponse();
  await driver.updateMyLocation({ userId: driverId, body: { lat: 10.78, lng: 106.71 } }, second);
  assert.equal(second.statusCode, 200);

  const rows = (await db.query("SELECT lat, lng FROM driver_locations WHERE driver_id = $1", [driverId])).rows;
  assert.equal(rows.length, 1, "chi 1 dong/tai xe (vi tri moi nhat, khong luu lich su)");
  assert.equal(rows[0].lat, 10.78);
  assert.equal(rows[0].lng, 106.71);
});

test("updateMyLocation: tu choi toa do ngoai pham vi", { skip }, async () => {
  const driverId = await makeUser({ email: "driver@test.local", isDriver: true });
  const response = makeResponse();
  await driver.updateMyLocation({ userId: driverId, body: { lat: 999, lng: 106.7 } }, response);
  assert.equal(response.statusCode, 400);
});

test("driverLocation trong order: chi hien khi status='shipped' VA co vi tri, tu an khi giao xong", { skip }, async () => {
  const customerId = await makeUser({ email: "customer@test.local" });
  const driverId = await makeUser({ email: "driver@test.local", isDriver: true });
  const foodId = await makeFood(await makeCategory());
  const orderId = await makeOrder(customerId, { status: "shipped", foodId });
  await db.query("UPDATE orders SET driver_id = $2 WHERE id = $1", [orderId, driverId]);

  const beforeLocation = makeResponse();
  await order.getOrderById({ userId: customerId, user: { isAdmin: false }, params: { id: orderId } }, beforeLocation);
  assert.equal(beforeLocation.body.order.driverLocation, null, "chua cap nhat vi tri thi driverLocation la null");

  const update = makeResponse();
  await driver.updateMyLocation({ userId: driverId, body: { lat: 10.77, lng: 106.70 } }, update);
  assert.equal(update.statusCode, 200);

  const afterLocation = makeResponse();
  await order.getOrderById({ userId: customerId, user: { isAdmin: false }, params: { id: orderId } }, afterLocation);
  assert.equal(afterLocation.body.order.driverLocation.lat, 10.77);
  assert.equal(afterLocation.body.order.driverLocation.lng, 106.70);

  // Giao xong - vi tri PHAI tu an du row driver_locations van con trong DB
  // (khong xoa du lieu, chi khong hien voi khach - dung yeu cau bao mat cua spec)
  const adminId = await makeUser({ email: "admin@test.local", isAdmin: true });
  const delivered = makeResponse();
  await order.updateOrderStatus({ userId: adminId, params: { id: orderId }, body: { status: "delivered" } }, delivered);
  assert.equal(delivered.statusCode, 200);
  assert.equal(delivered.body.order.driverLocation, null, "an vi tri ngay khi don khong con 'shipped'");
});

test("listDrivers/setDriverFlag: admin cap quyen tai xe va thay trong danh sach", { skip }, async () => {
  const userId = await makeUser({ email: "will-be-driver@test.local" });

  const emptyList = makeResponse();
  await auth.listDrivers({}, emptyList);
  assert.deepEqual(emptyList.body.drivers, []);

  const grant = makeResponse();
  await auth.setDriverFlag({ params: { id: userId }, body: { isDriver: true } }, grant);
  assert.equal(grant.statusCode, 200);
  assert.equal(grant.body.user.isDriver, true);

  const filledList = makeResponse();
  await auth.listDrivers({}, filledList);
  assert.deepEqual(filledList.body.drivers.map((d) => d._id), [userId]);

  const revoke = makeResponse();
  await auth.setDriverFlag({ params: { id: userId }, body: { isDriver: false } }, revoke);
  assert.equal(revoke.statusCode, 200);

  const afterRevoke = makeResponse();
  await auth.listDrivers({}, afterRevoke);
  assert.deepEqual(afterRevoke.body.drivers, []);
});
