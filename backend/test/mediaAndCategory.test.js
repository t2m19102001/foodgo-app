import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import foodModel from "../models/foodModel.js";
import categoryModel from "../models/categoryModel.js";
import { updateFood } from "../controllers/foodController.js";
import { updateCategory } from "../controllers/categoryController.js";
import { isSupportedImage } from "../middleware/upload.js";
import { uploadsDir } from "../util/uploadFile.js";

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("uploaded image extension must match actual header", () => {
  assert.equal(isSupportedImage(Buffer.from([0xff, 0xd8, 0xff]), ".jpg"), true);
  assert.equal(isSupportedImage(Buffer.from("not an image"), ".jpg"), false);
  assert.equal(isSupportedImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ".png"), true);
  assert.equal(isSupportedImage(Buffer.from("GIF89a"), ".gif"), true);
  assert.equal(isSupportedImage(Buffer.from("RIFFxxxxWEBP"), ".webp"), true);
  assert.equal(isSupportedImage(Buffer.from("RIFFxxxxWEBP"), ".jpg"), false);
});

test("failed food update keeps old image and removes new upload", async () => {
  const oldName = `${randomUUID()}.jpg`;
  const newName = `${randomUUID()}.jpg`;
  const oldPath = path.join(uploadsDir, oldName);
  const newPath = path.join(uploadsDir, newName);
  await fs.writeFile(oldPath, "old");
  await fs.writeFile(newPath, "new");
  mock.method(foodModel, "findById", async () => ({
    image: oldName,
    save: async () => { throw new Error("DB write failed"); },
  }));
  mock.method(console, "error", () => {});
  try {
    const response = makeResponse();
    await updateFood({ params: { id: "food1" }, body: {}, file: { filename: newName } }, response);
    assert.equal(response.statusCode, 500);
    assert.equal(await fs.readFile(oldPath, "utf8"), "old");
    await assert.rejects(fs.access(newPath), { code: "ENOENT" });
  } finally {
    mock.restoreAll();
    await fs.rm(oldPath, { force: true });
    await fs.rm(newPath, { force: true });
  }
});

test("updateFood rejects an invalid isAvailable value", async () => {
  mock.method(foodModel, "findById", async () => { throw new Error("should not reach DB"); });
  try {
    const response = makeResponse();
    await updateFood({ params: { id: "food1" }, body: { isAvailable: "maybe" }, file: null }, response);
    assert.equal(response.statusCode, 400);
  } finally {
    mock.restoreAll();
  }
});

test("updateFood toggles isAvailable when a valid value is provided", async () => {
  let saved = false;
  const food = {
    isAvailable: true,
    image: "old.jpg",
    save: async () => { saved = true; },
  };
  mock.method(foodModel, "findById", async () => food);
  try {
    const response = makeResponse();
    await updateFood({ params: { id: "food1" }, body: { isAvailable: "false" }, file: null }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(food.isAvailable, false);
    assert.equal(saved, true);
  } finally {
    mock.restoreAll();
  }
});

test("category with food cannot be renamed", async () => {
  let saved = false;
  mock.method(categoryModel, "findById", async () => ({
    name: "Original",
    image: "",
    save: async () => { saved = true; },
  }));
  mock.method(foodModel, "exists", async () => true);
  try {
    const response = makeResponse();
    await updateCategory({ params: { id: "category1" }, body: { name: "New" } }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(saved, false);
  } finally {
    mock.restoreAll();
  }
});
