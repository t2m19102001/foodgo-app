// Test kiem tra anh upload. Khong can database.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isSupportedImage } from "../middleware/upload.js";
import { uploadsDir, deleteImageSafe } from "../util/uploadFile.js";

test("uploaded image extension must match actual header", () => {
  // Kiem magic byte cua noi dung that, khong tin phan mo rong
  assert.equal(isSupportedImage(Buffer.from([0xff, 0xd8, 0xff]), ".jpg"), true);
  assert.equal(isSupportedImage(Buffer.from("not an image"), ".jpg"), false);
  assert.equal(isSupportedImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ".png"), true);
  assert.equal(isSupportedImage(Buffer.from("GIF89a"), ".gif"), true);
  assert.equal(isSupportedImage(Buffer.from("RIFFxxxxWEBP"), ".webp"), true);
  assert.equal(isSupportedImage(Buffer.from("RIFFxxxxWEBP"), ".jpg"), false);
});

test("deleteImageSafe chi xoa trong uploads va chan path traversal", async () => {
  const name = `${randomUUID()}.jpg`;
  const filePath = path.join(uploadsDir, name);
  await fs.writeFile(filePath, "anh test");
  try {
    // Ten co thu muc thi bo qua, khong duoc xoa file ngoai uploads/
    await deleteImageSafe("../../package.json");
    await deleteImageSafe("/etc/hosts");
    assert.ok(await fs.readFile(filePath, "utf8"), "file hop le van con");

    await deleteImageSafe(name);
    await assert.rejects(fs.access(filePath), { code: "ENOENT" });
  } finally {
    await fs.rm(filePath, { force: true });
  }
});
