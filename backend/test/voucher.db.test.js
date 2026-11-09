import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeVoucher, countRows,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";

const skip = hasDb ? false : dbMissingReason;
let order;
let voucherController;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  order = await import("../controllers/orderController.js");
  voucherController = await import("../controllers/voucherController.js");
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

const findOrder = async (orderId) => {
  const { rows } = await db.query("SELECT * FROM orders WHERE id = $1", [orderId]);
  return rows[0];
};

test("placeOrder voi ma percent co tran: discount bi kep lai dung tran", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { price: 100000 });
  // percent 50%, tran 20000 -> 100000*50% = 50000, nhung bi kep ve 20000
  await makeVoucher({ code: "SALE50", discountType: "percent", discountValue: 50, maxDiscountAmount: 20000 });

  const response = makeResponse();
  await order.placeOrder(placeReq(userId, foodId, { voucherCode: "sale50" }), response);
  assert.equal(response.statusCode, 201);

  const row = await findOrder(response.body.orderId);
  assert.equal(row.discount_amount, 20000);
  assert.equal(row.amount, 80000, "100000 subtotal - 20000 discount");
  assert.equal(response.body.order.discountAmount, 20000);
  assert.equal(response.body.order.amount, 80000);
  assert.equal(response.body.order.voucherCode, "SALE50");
});

test("placeOrder voi ma fixed lon hon subtotal: discount bi kep ve dung subtotal, khong am tien", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { price: 30000 });
  await makeVoucher({ code: "FIX50K", discountType: "fixed", discountValue: 50000 });

  const response = makeResponse();
  await order.placeOrder(placeReq(userId, foodId, { voucherCode: "FIX50K" }), response);
  assert.equal(response.statusCode, 201);

  const row = await findOrder(response.body.orderId);
  assert.equal(row.discount_amount, 30000);
  assert.equal(row.amount, 0);
});

test("placeOrder: don duoi muc toi thieu bi tu choi VA rollback sach (khong mat ton kho)", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { price: 30000, stock: 10, trackStock: true });
  await makeVoucher({ code: "MIN100K", discountType: "fixed", discountValue: 5000, minOrderValue: 100000 });

  const response = makeResponse();
  await order.placeOrder(placeReq(userId, foodId, { voucherCode: "MIN100K" }), response);
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /tối thiểu/);

  assert.equal(await countRows("orders"), 0, "transaction phai rollback toan bo, khong de lai don mo coi");
  const { rows } = await db.query("SELECT stock FROM foods WHERE id = $1", [foodId]);
  assert.equal(rows[0].stock, 10, "ton kho khong duoc tru khi don bi tu choi");
  assert.equal(await countRows("voucher_redemptions"), 0);
});

test("placeOrder: ma da het han hoac bi khoa thi bi tu choi", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());

  await makeVoucher({ code: "EXPIRED", validUntil: "2000-01-01T00:00:00Z" });
  const expired = makeResponse();
  await order.placeOrder(placeReq(userId, foodId, { voucherCode: "EXPIRED" }), expired);
  assert.equal(expired.statusCode, 400);
  assert.match(expired.body.message, /hết hạn/);

  await makeVoucher({ code: "LOCKED", isActive: false });
  const locked = makeResponse();
  await order.placeOrder(placeReq(userId, foodId, { voucherCode: "LOCKED" }), locked);
  assert.equal(locked.statusCode, 400);
  assert.match(locked.body.message, /khóa/);
});

test("placeOrder: usage_limit toan he thong - het luot thi don sau bi tu choi", { skip }, async () => {
  const foodId = await makeFood(await makeCategory());
  await makeVoucher({ code: "ONCE", usageLimit: 1 });

  const userA = await makeUser({ email: "a@test.local" });
  const first = makeResponse();
  await order.placeOrder(placeReq(userA, foodId, { voucherCode: "ONCE" }), first);
  assert.equal(first.statusCode, 201);

  const userB = await makeUser({ email: "b@test.local" });
  const second = makeResponse();
  await order.placeOrder(placeReq(userB, foodId, { voucherCode: "ONCE" }), second);
  assert.equal(second.statusCode, 400);
  assert.match(second.body.message, /hết lượt/);

  assert.equal(await countRows("voucher_redemptions"), 1);
});

test("placeOrder: usage_limit_per_user gioi han theo tung nguoi, khong anh huong nguoi khac", { skip }, async () => {
  const foodId = await makeFood(await makeCategory());
  await makeVoucher({ code: "PERUSER", usageLimitPerUser: 1 });

  const userA = await makeUser({ email: "a@test.local" });
  const first = makeResponse();
  await order.placeOrder(placeReq(userA, foodId, { voucherCode: "PERUSER" }), first);
  assert.equal(first.statusCode, 201);

  const second = makeResponse();
  await order.placeOrder(placeReq(userA, foodId, { voucherCode: "PERUSER" }), second);
  assert.equal(second.statusCode, 400);
  assert.match(second.body.message, /đã dùng hết số lần/);

  const userB = await makeUser({ email: "b@test.local" });
  const third = makeResponse();
  await order.placeOrder(placeReq(userB, foodId, { voucherCode: "PERUSER" }), third);
  assert.equal(third.statusCode, 201, "gioi han la theo-user, khong phai global");
});

test("placeOrder KHONG dung voucherCode: discount_amount = 0, voucher_id = NULL (hanh vi cu khong doi)", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory(), { price: 50000 });

  const response = makeResponse();
  await order.placeOrder(placeReq(userId, foodId), response);
  assert.equal(response.statusCode, 201);

  const row = await findOrder(response.body.orderId);
  assert.equal(row.discount_amount, 0);
  assert.equal(row.voucher_id, null);
  assert.equal(row.amount, 50000);
});

// Case quan trong nhat: chung minh lockVoucherByCode (SELECT ... FOR UPDATE
// trong db/vouchers.js) chong duoc double-use khi nhieu request dat hang
// GOI DONG THOI cho cung mot ma voucher usage_limit = 1. Dung HAI MON KHAC
// NHAU de khong vo tinh dua vao khoa FOR UPDATE cua bang foods (lockFoodsForOrder)
// lam "ho" cho khoa voucher - phai chinh co che lock voucher tu chong duoc.
test("placeOrder: hai request dat hang DONG THOI cung ma usage_limit=1 -> dung 1 thanh cong", { skip }, async () => {
  const categoryId = await makeCategory();
  const foodA = await makeFood(categoryId, { name: "Mon A" });
  const foodB = await makeFood(categoryId, { name: "Mon B" });
  await makeVoucher({ code: "RACE1", usageLimit: 1 });

  const userA = await makeUser({ email: "race-a@test.local" });
  const userB = await makeUser({ email: "race-b@test.local" });

  const resA = makeResponse();
  const resB = makeResponse();
  await Promise.all([
    order.placeOrder(placeReq(userA, foodA, { voucherCode: "RACE1" }), resA),
    order.placeOrder(placeReq(userB, foodB, { voucherCode: "RACE1" }), resB),
  ]);

  const statusCodes = [resA.statusCode, resB.statusCode].sort();
  assert.deepEqual(statusCodes, [201, 400], "dung mot thanh cong, mot bi tu choi");

  const failed = resA.statusCode === 400 ? resA : resB;
  assert.match(failed.body.message, /hết lượt/);

  assert.equal(
    await countRows("voucher_redemptions"),
    1,
    "khoa FOR UPDATE phai serialize hai giao dich - khong duoc ghi nhan hai lan"
  );
});

test("voucherController.removeVoucher: khong xoa duoc ma da co nguoi dung (409), khoa duoc (isActive=false)", { skip }, async () => {
  const foodId = await makeFood(await makeCategory());
  const voucherId = await makeVoucher({ code: "USED1" });

  const userId = await makeUser();
  const placed = makeResponse();
  await order.placeOrder(placeReq(userId, foodId, { voucherCode: "USED1" }), placed);
  assert.equal(placed.statusCode, 201);

  const removeRes = makeResponse();
  await voucherController.removeVoucher({ params: { id: voucherId } }, removeRes);
  assert.equal(removeRes.statusCode, 409);

  const updateRes = makeResponse();
  await voucherController.updateVoucher({
    params: { id: voucherId },
    body: {
      code: "USED1", discountType: "percent", discountValue: 10, isActive: false,
    },
  }, updateRes);
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.body.voucher.isActive, false);
});
