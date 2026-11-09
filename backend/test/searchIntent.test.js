import test from "node:test";
import assert from "node:assert/strict";
import { parseSearchIntent } from "../util/searchIntent.js";

const categories = ["Bún & Phở", "Cơm", "Ăn vặt", "Tráng miệng", "Đồ uống"];

test("gia 'duoi X dong' duoc nhan dien dung, khong can fallback", () => {
  const result = parseSearchIntent("Tìm quán ăn gần tôi dưới 50.000 đồng.", categories);
  assert.equal(result.maxPrice, 50000);
  assert.deepEqual(result.unsupported, ["distance"]);
  assert.equal(result.needsLlmFallback, false);
});

test("gia dang 'k' duoc hieu la nghin dong", () => {
  const result = parseSearchIntent("Món nào dưới 50k vậy", categories);
  assert.equal(result.maxPrice, 50000);
});

test("so khong co don vi va nho hon 1000 duoc hieu la nghin dong", () => {
  const result = parseSearchIntent("Có món nào dưới 30 không", categories);
  assert.equal(result.maxPrice, 30000);
});

test("gia 'tren X' nhan dien minPrice", () => {
  const result = parseSearchIntent("Tôi muốn món trên 100k", categories);
  assert.equal(result.minPrice, 100000);
});

test("nhan dien dung ten category thuc su co trong he thong", () => {
  const result = parseSearchIntent("Tôi muốn ăn Cơm", categories);
  assert.equal(result.categoryName, "Cơm");
});

test("khong khop nham category khi tu khoa khong lien quan", () => {
  const result = parseSearchIntent("Tôi muốn ăn gà rán", categories);
  assert.equal(result.categoryName, undefined);
});

test("cau don gian ('ga ran') duoc rule tu loc het tu dem, khong can fallback", () => {
  // Cac tu dem "toi/muon/an" bi loai bang STOPWORDS, chi con "ga ran" lam
  // keyword - LIKE truc tiep khop duoc ten mon, khong can goi LLM.
  const result = parseSearchIntent("Tôi muốn ăn gà rán", categories);
  assert.equal(result.keyword, "ga ran");
  assert.equal(result.needsLlmFallback, false);
});

test("remainder chi gom tu dem (khong co noi dung tim kiem thuc) thi keyword = undefined", () => {
  const result = parseSearchIntent("Có món nào dưới 50k không", categories);
  assert.equal(result.maxPrice, 50000);
  assert.equal(result.keyword, undefined, "khong duoc dung 'co mon nao khong' lam keyword LIKE");
});

test("phat hien khuyen mai la tieu chi CHUA ho tro, khong am tham bo qua", () => {
  const result = parseSearchIntent("Có quán nào đang giảm giá không?", categories);
  assert.ok(result.unsupported.includes("promotion"));
});

test("phat hien gan ban/khoang cach la tieu chi CHUA ho tro", () => {
  const result = parseSearchIntent("Tìm quán gần tôi", categories);
  assert.ok(result.unsupported.includes("distance"));
});

test("phat hien so nguoi dang chu so la tieu chi CHUA ho tro (han che: khong nhan dang so dang chu)", () => {
  const result = parseSearchIntent("Tìm món phù hợp cho 2 người", categories);
  assert.ok(result.unsupported.includes("groupSize"));
});

test("cum 'danh gia cao' dat minRating = 4", () => {
  const result = parseSearchIntent("Món nào được đánh giá cao", categories);
  assert.equal(result.minRating, 4);
});

test("cau phuc tap nhieu tinh tu khong khop rule nao -> needsLlmFallback = true", () => {
  const result = parseSearchIntent("Tôi muốn đồ ăn ít dầu mỡ, không cay, giá rẻ", categories);
  assert.equal(result.needsLlmFallback, true);
});

test("cau rong hoac chi khoang trang -> keyword undefined, khong fallback", () => {
  const result = parseSearchIntent("   ", categories);
  assert.equal(result.keyword, undefined);
  assert.equal(result.needsLlmFallback, false);
});

test("ket hop gia + category trong cung mot cau", () => {
  const result = parseSearchIntent("Cơm dưới 50k", categories);
  assert.equal(result.categoryName, "Cơm");
  assert.equal(result.maxPrice, 50000);
});
