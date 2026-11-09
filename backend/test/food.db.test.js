import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeCategory, makeFood, countRows,
} from "./helpers/db.mjs";
import { uploadsDir } from "../util/uploadFile.js";

const skip = hasDb ? false : dbMissingReason;
let food;
let category;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  food = await import("../controllers/foodController.js");
  category = await import("../controllers/categoryController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
afterEach(() => { global.fetch = originalFetch; });
after(async () => { if (hasDb) await closeDb(); });

const originalFetch = global.fetch;
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-test-model";
const llmTextReply = (content) => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { role: "assistant", content } }] }),
  text: async () => "",
});

test("listFood without page/limit keeps the old response shape under a hard cap", { skip }, async () => {
  const categoryId = await makeCategory();
  for (let i = 0; i < 3; i += 1) await makeFood(categoryId, { name: `Mon ${i}` });

  const response = makeResponse();
  await food.listFood({ query: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.foods.length, 3);
  assert.deepEqual(response.body.pagination,
    { currentPage: 1, totalPages: 1, totalItems: 3, limit: 200 });
});

test("listFood paginates when asked and reports the total page count", { skip }, async () => {
  const categoryId = await makeCategory();
  for (let i = 0; i < 5; i += 1) await makeFood(categoryId, { name: `Mon ${i}` });

  const response = makeResponse();
  await food.listFood({ query: { page: "2", limit: "2" } }, response);
  assert.equal(response.body.foods.length, 2);
  assert.equal(response.body.pagination.currentPage, 2);
  assert.equal(response.body.pagination.totalPages, 3);
  assert.equal(response.body.pagination.totalItems, 5);
});

test("listFood rejects invalid pagination before querying the database", { skip }, async () => {
  for (const query of [{ page: "0" }, { limit: "101" }, { page: "abc" }]) {
    const response = makeResponse();
    await food.listFood({ query }, response);
    assert.equal(response.statusCode, 400, JSON.stringify(query));
  }
});

test("mon tra ve category la TEN danh muc dang chuoi, khong phai id", { skip }, async () => {
  const categoryId = await makeCategory("Bún & Phở");
  await makeFood(categoryId, { name: "Phở bò" });

  const response = makeResponse();
  await food.listFood({ query: {} }, response);
  // App Android doc Food.category la String ten danh muc - tra id la vo UI
  assert.equal(response.body.foods[0].category, "Bún & Phở");
  assert.equal(typeof response.body.foods[0].price, "number");
  assert.ok(response.body.foods[0]._id);
});

test("tim kiem bo dau: go khong dau ra mon co dau", { skip }, async () => {
  const categoryId = await makeCategory();
  await makeFood(categoryId, { name: "Phở bò tái nạm" });
  await makeFood(categoryId, { name: "Cơm tấm sườn bì chả" });

  for (const keyword of ["pho bo", "PHO BO", "Phở bò", "com tam"]) {
    const response = makeResponse();
    await food.listFood({ query: { q: keyword, page: "1", limit: "10" } }, response);
    assert.equal(response.body.foods.length, 1, `q=${keyword}`);
  }

  const miss = makeResponse();
  await food.listFood({ query: { q: "banh mi", page: "1", limit: "10" } }, miss);
  assert.equal(miss.body.foods.length, 0);
});

test("getFoodByCategory loc theo ten danh muc", { skip }, async () => {
  const a = await makeCategory("Cơm");
  const b = await makeCategory("Đồ uống");
  await makeFood(a, { name: "Cơm gà" });
  await makeFood(b, { name: "Trà sữa" });

  const response = makeResponse();
  await food.getFoodByCategory({ params: { category: "Cơm" }, query: {} }, response);
  assert.equal(response.body.foods.length, 1);
  assert.equal(response.body.foods[0].name, "Cơm gà");
});

test("addFood dung prepTimeMinutes gui len, hoac default 15 khi khong gui", { skip }, async () => {
  const categoryLabel = "Mon chinh";
  await makeCategory(categoryLabel);

  const withValue = makeResponse();
  await food.addFood({
    body: { name: "Phở bò", category: categoryLabel, price: "50000", prepTimeMinutes: "25" },
    file: { filename: `${randomUUID()}.jpg` },
  }, withValue);
  assert.equal(withValue.statusCode, 201);
  assert.equal(withValue.body.food.prepTimeMinutes, 25);

  const withoutValue = makeResponse();
  await food.addFood({
    body: { name: "Cơm gà", category: categoryLabel, price: "50000" },
    file: { filename: `${randomUUID()}.jpg` },
  }, withoutValue);
  assert.equal(withoutValue.statusCode, 201);
  assert.equal(withoutValue.body.food.prepTimeMinutes, 15, "default khi khong gui");
});

test("addFood/updateFood tu choi prepTimeMinutes ngoai khoang 1-180", { skip }, async () => {
  const categoryLabel = "Mon chinh";
  const categoryId = await makeCategory(categoryLabel);

  for (const bad of ["0", "181", "-5", "abc"]) {
    const added = makeResponse();
    await food.addFood({
      body: { name: "Phở bò", category: categoryLabel, price: "50000", prepTimeMinutes: bad },
      file: { filename: `${randomUUID()}.jpg` },
    }, added);
    assert.equal(added.statusCode, 400, `addFood voi prepTimeMinutes=${bad}`);
  }

  const foodId = await makeFood(categoryId);
  for (const bad of ["0", "181", "-5"]) {
    const updated = makeResponse();
    await food.updateFood({ params: { id: foodId }, body: { prepTimeMinutes: bad } }, updated);
    assert.equal(updated.statusCode, 400, `updateFood voi prepTimeMinutes=${bad}`);
  }
});

test("updateFood doi prepTimeMinutes, giu nguyen khi khong gui", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { prepTimeMinutes: 15 });

  const changed = makeResponse();
  await food.updateFood({ params: { id: foodId }, body: { prepTimeMinutes: "40" } }, changed);
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.body.food.prepTimeMinutes, 40);

  const untouched = makeResponse();
  await food.updateFood({ params: { id: foodId }, body: { isAvailable: "false" } }, untouched);
  assert.equal(untouched.statusCode, 200);
  assert.equal(untouched.body.food.prepTimeMinutes, 40, "khong gui prepTimeMinutes thi giu gia tri cu");
});

test("updateFood rejects an invalid isAvailable value", { skip }, async () => {
  const foodId = await makeFood(await makeCategory());
  const response = makeResponse();
  await food.updateFood(
    { params: { id: foodId }, body: { isAvailable: "co-le" } }, response);
  assert.equal(response.statusCode, 400);
});

test("updateFood toggles isAvailable when a valid value is provided", { skip }, async () => {
  const foodId = await makeFood(await makeCategory(), { isAvailable: true });

  const off = makeResponse();
  await food.updateFood({ params: { id: foodId }, body: { isAvailable: "false" } }, off);
  assert.equal(off.statusCode, 200);
  assert.equal(off.body.food.isAvailable, false);

  const on = makeResponse();
  await food.updateFood({ params: { id: foodId }, body: { isAvailable: "true" } }, on);
  assert.equal(on.body.food.isAvailable, true);
});

test("aiSearchFood tra 400 khi thieu hoac qua dai cau tim", { skip }, async () => {
  const empty = makeResponse();
  await food.aiSearchFood({ body: { q: "" } }, empty);
  assert.equal(empty.statusCode, 400);

  const tooLong = makeResponse();
  await food.aiSearchFood({ body: { q: "a".repeat(201) } }, tooLong);
  assert.equal(tooLong.statusCode, 400);
});

test("aiSearchFood loc dung theo gia bang rule, khong can goi LLM", { skip }, async () => {
  const categoryId = await makeCategory();
  const re = await makeFood(categoryId, { name: "Mon re", price: 30000 });
  await makeFood(categoryId, { name: "Mon dat", price: 100000 });

  let fetchCalled = false;
  global.fetch = async () => { fetchCalled = true; throw new Error("khong duoc goi LLM"); };

  const response = makeResponse();
  await food.aiSearchFood({ body: { q: "Có món nào dưới 50k không" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(fetchCalled, false, "cau don gian rule tu xu ly duoc, khong can LLM");
  assert.deepEqual(response.body.foods.map((f) => f._id), [re]);
});

test("aiSearchFood tra unsupported khi phat hien tieu chi chua ho tro (khuyen mai)", { skip }, async () => {
  await makeFood(await makeCategory());
  const response = makeResponse();
  await food.aiSearchFood({ body: { q: "Có quán nào đang giảm giá không?" } }, response);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.unsupported.includes("promotion"));
});

test("aiSearchFood goi LLM fallback khi cau phuc tap, dung dung filter LLM tra ve", { skip }, async () => {
  const categoryId = await makeCategory();
  const re = await makeFood(categoryId, { name: "Mon re", price: 45000 });
  await makeFood(categoryId, { name: "Mon dat", price: 150000 });

  let fetchCalled = false;
  // "it dau mo, khong cay, gia re" la 6 tu CO NGHIA (sau khi loai stopword) ->
  // vuot nguong, rule tu bao needsLlmFallback=true (da xac nhan o searchIntent.test.js)
  global.fetch = async () => {
    fetchCalled = true;
    return llmTextReply('```json\n{"keyword": null, "maxPrice": 50000}\n```');
  };

  const response = makeResponse();
  await food.aiSearchFood(
    { body: { q: "Tôi muốn đồ ăn ít dầu mỡ, không cay, giá rẻ" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(fetchCalled, true, "cau phuc tap phai goi LLM fallback");
  assert.deepEqual(response.body.foods.map((f) => f._id), [re]);
});

test("aiSearchFood: LLM loi van tra 200 voi ket qua rule-based, khong vo request", { skip }, async () => {
  await makeFood(await makeCategory());
  global.fetch = async () => { throw new Error("network down"); };

  const response = makeResponse();
  await food.aiSearchFood(
    { body: { q: "Tôi muốn đồ ăn ít dầu mỡ, không cay, giá rẻ" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
});

test("sua mon that bai thi giu anh cu va xoa anh moi vua upload", { skip }, async () => {
  const newName = `${randomUUID()}.jpg`;
  const newPath = path.join(uploadsDir, newName);
  await fs.writeFile(newPath, "anh moi");
  try {
    // Mon khong ton tai -> 404, anh moi vua upload phai bi don
    const response = makeResponse();
    await food.updateFood(
      { params: { id: randomUUID() }, body: {}, file: { filename: newName } }, response);
    assert.equal(response.statusCode, 404);
    await assert.rejects(fs.access(newPath), { code: "ENOENT" },
      "anh moi phai bi xoa khi update that bai");
  } finally {
    await fs.rm(newPath, { force: true });
  }
});

test("danh muc dang co mon GIO doi ten duoc (ban Mongo tra 409)", { skip }, async () => {
  const categoryId = await makeCategory("Mon nuoc");
  const foodId = await makeFood(categoryId, { name: "Phở bò" });

  const response = makeResponse();
  await category.updateCategory(
    { params: { id: categoryId }, body: { name: "Mon nuoc nong" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.category.name, "Mon nuoc nong");

  // Mon van thuoc dung danh muc do - khoa ngoai ON UPDATE CASCADE
  const { rows } = await db.query(
    `SELECT c.name FROM foods f JOIN categories c ON c.id = f.category_id WHERE f.id = $1`,
    [foodId]
  );
  assert.equal(rows[0].name, "Mon nuoc nong");
});

test("khong xoa duoc danh muc dang co mon - do DB chan, khong phai mot cau SELECT", { skip }, async () => {
  const categoryId = await makeCategory("Mon nuoc");
  await makeFood(categoryId);

  const response = makeResponse();
  await category.removeCategory({ params: { id: categoryId } }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(await countRows("categories"), 1);
});

test("doi ten danh muc thanh ten da ton tai -> 400", { skip }, async () => {
  await makeCategory("Cơm");
  const second = await makeCategory("Đồ uống");

  const response = makeResponse();
  await category.updateCategory({ params: { id: second }, body: { name: "Cơm" } }, response);
  assert.equal(response.statusCode, 400);
});

test("id sai dinh dang tra 400 chu khong phai 500", { skip }, async () => {
  for (const handler of [food.getFoodById, food.removeFood]) {
    const response = makeResponse();
    await handler({ params: { id: "khong-phai-uuid" }, body: {}, query: {} }, response);
    assert.equal(response.statusCode, 400);
  }
});
