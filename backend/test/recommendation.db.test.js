import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeOrder,
} from "./helpers/db.mjs";

const skip = hasDb ? false : dbMissingReason;
let recommendation;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  recommendation = await import("../controllers/recommendationController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
after(async () => { if (hasDb) await closeDb(); });

const addReview = (userId, foodId, rating) => db.query(
  "INSERT INTO reviews (user_id, food_id, rating) VALUES ($1, $2, $3)",
  [userId, foodId, rating]
);

test("forYou: sap theo so lan dat giam dan, bo qua mon khong con available", { skip }, async () => {
  const userId = await makeUser();
  const categoryId = await makeCategory();
  const food1 = await makeFood(categoryId, { name: "Mon 1" });
  const food2 = await makeFood(categoryId, { name: "Mon 2" });
  const food3 = await makeFood(categoryId, { name: "Mon het hang", isAvailable: false });

  for (let i = 0; i < 3; i += 1) await makeOrder(userId, { status: "delivered", foodId: food1 });
  await makeOrder(userId, { status: "delivered", foodId: food2 });
  for (let i = 0; i < 5; i += 1) await makeOrder(userId, { status: "delivered", foodId: food3 });

  const response = makeResponse();
  await recommendation.getHomeRecommendations({ userId }, response);
  assert.equal(response.statusCode, 200);

  const ids = response.body.forYou.map((item) => item.food._id);
  assert.deepEqual(ids, [food1, food2], "food3 khong available phai bi loai");
  assert.equal(response.body.forYou[0].reason, "Bạn đã đặt món này 3 lần");
});

test("forYou: don pending/cancelled khong tinh, chi tinh don delivered", { skip }, async () => {
  const userId = await makeUser();
  const foodId = await makeFood(await makeCategory());
  await makeOrder(userId, { status: "pending", foodId });
  await makeOrder(userId, { status: "cancelled", foodId });

  const response = makeResponse();
  await recommendation.getHomeRecommendations({ userId }, response);
  assert.deepEqual(response.body.forYou.map((item) => item.food._id), [],
    "chua co don delivered nao nen forYou rong (se fallback sang popular)");
});

test("forYou rong khi user chua co lich su -> fallback ve mon pho bien TOAN he thong", { skip }, async () => {
  const buyer = await makeUser({ email: "buyer@test.local" });
  const newUser = await makeUser({ email: "new@test.local" });
  const foodId = await makeFood(await makeCategory());
  await makeOrder(buyer, { status: "delivered", foodId });
  await makeOrder(buyer, { status: "delivered", foodId });

  const response = makeResponse();
  await recommendation.getHomeRecommendations({ userId: newUser }, response);
  assert.deepEqual(response.body.forYou.map((item) => item.food._id), [foodId]);
  assert.equal(response.body.forYou[0].reason, "Món phổ biến tại FoodGo");
});

test("topRated: sap theo diem trung binh giam dan, bo qua mon it hon 2 danh gia", { skip }, async () => {
  const categoryId = await makeCategory();
  const foodHighRated = await makeFood(categoryId, { name: "Mon diem cao" });
  const foodMidRated = await makeFood(categoryId, { name: "Mon diem trung" });
  const foodOneReview = await makeFood(categoryId, { name: "Mon 1 review" });
  const reviewer1 = await makeUser({ email: "r1@test.local" });
  const reviewer2 = await makeUser({ email: "r2@test.local" });
  const reviewer3 = await makeUser({ email: "r3@test.local" });

  await addReview(reviewer1, foodHighRated, 5);
  await addReview(reviewer2, foodHighRated, 5);
  await addReview(reviewer3, foodHighRated, 4);
  await addReview(reviewer1, foodMidRated, 3);
  await addReview(reviewer2, foodMidRated, 3);
  await addReview(reviewer1, foodOneReview, 5);

  const response = makeResponse();
  await recommendation.getHomeRecommendations({ userId: reviewer1 }, response);

  const ids = response.body.topRated.map((item) => item.food._id);
  assert.deepEqual(ids, [foodHighRated, foodMidRated],
    "mon chi co 1 review phai bi loai khoi topRated");
  assert.equal(response.body.topRated[0].reason, "4.7/5 từ 3 lượt đánh giá");
});
