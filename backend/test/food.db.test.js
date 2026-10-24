import test, { before, after, beforeEach } from "node:test";
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
after(async () => { if (hasDb) await closeDb(); });

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
