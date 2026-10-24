import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeOrder, countRows,
} from "./helpers/db.mjs";

const skip = hasDb ? false : dbMissingReason;
let review;
let notification;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  review = await import("../controllers/reviewController.js");
  notification = await import("../controllers/notificationController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
after(async () => { if (hasDb) await closeDb(); });

test("a rating outside 1..5 is rejected before any database write", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());

  for (const rating of [0, 6, -1, 2.5, "nhieu"]) {
    const response = makeResponse();
    await review.addReview({ userId, body: { foodId, rating } }, response);
    assert.equal(response.statusCode, 400, `rating=${rating}`);
  }
  assert.equal(await countRows("reviews"), 0);
});

test("a food never received in a delivered order cannot be reviewed", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  // Co don nhung chua giao
  await makeOrder(userId, { status: "pending", foodId });

  const response = makeResponse();
  await review.addReview({ userId, body: { foodId, rating: 5, comment: "Ngon" } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(await countRows("reviews"), 0);
});

test("the delivered-order check is scoped to the signed-in user and that food", { skip }, async () => {
  const me = await makeUser({ email: "toi@test.local" });
  const other = await makeUser({ email: "nguoikhac@test.local" });
  const categoryId = await makeCategory();
  const foodId = await makeFood(categoryId);
  const otherFoodId = await makeFood(categoryId, { name: "Bún bò" });

  // Nguoi KHAC da nhan mon nay
  await makeOrder(other, { status: "delivered", foodId });
  // Con toi thi da nhan mon KHAC
  await makeOrder(me, { status: "delivered", foodId: otherFoodId });

  const notMine = makeResponse();
  await review.addReview({ userId: me, body: { foodId, rating: 5 } }, notMine);
  assert.equal(notMine.statusCode, 403, "khong duoc danh gia nho don nguoi khac");

  // Mon toi da that su nhan thi duoc
  const mine = makeResponse();
  await review.addReview({ userId: me, body: { foodId: otherFoodId, rating: 4 } }, mine);
  assert.equal(mine.statusCode, 201);
});

test("a second review for the same food is rejected", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  await makeOrder(userId, { status: "delivered", foodId });

  const first = makeResponse();
  await review.addReview({ userId, body: { foodId, rating: 5 } }, first);
  assert.equal(first.statusCode, 201);

  const second = makeResponse();
  await review.addReview({ userId, body: { foodId, rating: 1 } }, second);
  assert.equal(second.statusCode, 400);
  assert.equal(await countRows("reviews"), 1);
});

test("a user cannot edit or delete someone else's review", { skip }, async () => {
  const owner = await makeUser({ email: "chu@test.local" });
  const outsider = await makeUser({ email: "nguoila@test.local" });
  const foodId = await makeFood(await makeCategory());
  await makeOrder(owner, { status: "delivered", foodId });

  const created = makeResponse();
  await review.addReview({ userId: owner, body: { foodId, rating: 5, comment: "Ngon" } }, created);
  const reviewId = created.body.review._id;

  const edit = makeResponse();
  await review.updateReview(
    { userId: outsider, params: { id: reviewId }, body: { rating: 1 } }, edit);
  assert.equal(edit.statusCode, 403);

  const remove = makeResponse();
  await review.deleteReview({ userId: outsider, params: { id: reviewId } }, remove);
  assert.equal(remove.statusCode, 403);

  const { rows } = await db.query("SELECT rating FROM reviews WHERE id = $1", [reviewId]);
  assert.equal(rows[0].rating, 5, "danh gia khong duoc doi");
});

test("danh gia tra ve userId la OBJECT {_id, name, image} dung nhu app cho doi", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  await makeOrder(userId, { status: "delivered", foodId });

  const created = makeResponse();
  await review.addReview({ userId, body: { foodId, rating: 5, comment: "Ngon" } }, created);

  // Ban Mongo dung populate("userId", "name image"), app doc Review.UserRef
  const got = created.body.review;
  assert.equal(typeof got.userId, "object");
  assert.equal(got.userId._id, userId);
  assert.equal(got.userId.name, "Khach Test");
  assert.equal(typeof got.foodId, "string");
});

test("xoa mon thi danh gia cua mon do bi xoa theo, khong con mo coi", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  await makeOrder(userId, { status: "delivered", foodId });
  const created = makeResponse();
  await review.addReview({ userId, body: { foodId, rating: 5 } }, created);
  assert.equal(await countRows("reviews"), 1);

  // Ban Mongo xoa mon xong thi review o lai vinh vien va API van tra ve
  await db.query("DELETE FROM foods WHERE id = $1", [foodId]);
  assert.equal(await countRows("reviews"), 0);
});

test("notifications are scoped to the signed-in user and carry the unread count", { skip }, async () => {
  const me = await makeUser({ email: "toi@test.local" });
  const other = await makeUser({ email: "nguoikhac@test.local" });
  await db.query(
    `INSERT INTO notifications (user_id, title, message, is_read) VALUES
       ($1, 'A', 'cua toi chua doc', false),
       ($1, 'B', 'cua toi da doc', true),
       ($2, 'C', 'cua nguoi khac', false)`,
    [me, other]
  );

  const response = makeResponse();
  await notification.getMyNotifications({ userId: me }, response);
  assert.equal(response.body.notifications.length, 2, "chi thay thong bao cua minh");
  assert.equal(response.body.unreadCount, 1);
  assert.ok(response.body.notifications.every((n) => n.message.includes("cua toi")));
});

test("marking a notification that belongs to another user returns 404", { skip }, async () => {
  const me = await makeUser({ email: "toi@test.local" });
  const other = await makeUser({ email: "nguoikhac@test.local" });
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, title, message) VALUES ($1, 'C', 'cua nguoi khac')
     RETURNING id`, [other]);

  const response = makeResponse();
  await notification.markAsRead({ userId: me, params: { id: rows[0].id } }, response);
  assert.equal(response.statusCode, 404);

  const after = await db.query("SELECT is_read FROM notifications WHERE id = $1", [rows[0].id]);
  assert.equal(after.rows[0].is_read, false, "khong duoc danh dau thong bao cua nguoi khac");
});

test("mark-all-as-read only touches the signed-in user's unread notifications", { skip }, async () => {
  const me = await makeUser({ email: "toi@test.local" });
  const other = await makeUser({ email: "nguoikhac@test.local" });
  await db.query(
    `INSERT INTO notifications (user_id, title, message, is_read) VALUES
       ($1, 'A', 'cua toi', false), ($1, 'B', 'cua toi', false),
       ($2, 'C', 'cua nguoi khac', false)`,
    [me, other]
  );

  const response = makeResponse();
  await notification.markAllAsRead({ userId: me }, response);
  assert.equal(response.statusCode, 200);

  assert.equal(await countRows("notifications", "WHERE user_id = $1 AND NOT is_read", [me]), 0);
  assert.equal(await countRows("notifications", "WHERE user_id = $1 AND NOT is_read", [other]), 1,
    "thong bao cua nguoi khac khong duoc cham vao");
});
