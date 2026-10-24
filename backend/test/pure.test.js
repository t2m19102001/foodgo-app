// Test thuan, khong can database. Luon chay duoc bang `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { canTransition } from "../controllers/orderController.js";
import { parseOptionalPagination, parseOrderPagination, buildMeta, resolveLimits } from "../util/pagination.js";
import { isUuid } from "../util/ids.js";

test("only allowed order transitions are accepted", () => {
  const statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  const allowed = new Set([
    "pending>confirmed", "pending>cancelled",
    "confirmed>shipped", "confirmed>cancelled",
    "shipped>delivered",
  ]);
  // Quet het 25 cap (from, to) - khong de lot trang thai nao
  for (const from of statuses) {
    for (const to of statuses) {
      assert.equal(
        canTransition(from, to),
        allowed.has(`${from}>${to}`),
        `${from} -> ${to}`
      );
    }
  }
  assert.equal(canTransition("khong-ton-tai", "pending"), false);
});

test("page/limit are optional but validated when present", () => {
  assert.deepEqual(parseOptionalPagination({}), { paginated: false });
  assert.equal(parseOptionalPagination({ page: "2", limit: "5" }).paginated, true);
  assert.equal(parseOptionalPagination({ page: "2", limit: "5" }).skip, 5);
  // limit mac dinh 20 khi chi gui page
  assert.equal(parseOptionalPagination({ page: "1" }).limit, 20);
  for (const bad of [{ page: "0" }, { page: "-1" }, { limit: "0" }, { limit: "101" },
    { page: "1.5" }, { page: "abc" }, { page: "10001" }]) {
    assert.equal(parseOptionalPagination(bad).invalid, true, JSON.stringify(bad));
  }
});

test("order pagination keeps its own defaults and cap", () => {
  // Don hang dung mac dinh 10 / tran 50, khac han food va category (20 / 100)
  assert.deepEqual(parseOrderPagination({}), { page: 1, limit: 10, skip: 0 });
  assert.equal(parseOrderPagination({ limit: "50" }).limit, 50);
  assert.equal(parseOrderPagination({ limit: "51" }), null);
  assert.equal(parseOrderPagination({ page: "0" }), null);
});

test("unpaginated requests stay under a hard cap and report it", () => {
  const pagination = parseOptionalPagination({});
  const { limit, skip } = resolveLimits(pagination);
  assert.equal(limit, 200);
  assert.equal(skip, 0);
  const meta = buildMeta(0, pagination, limit);
  // Khong co ban ghi nao thi van la 1 trang, khong phai 0
  assert.equal(meta.totalPages, 1);
  assert.equal(buildMeta(250, pagination, limit).totalPages, 2);
});

test("uuid validation replaces ObjectId validation", () => {
  assert.equal(isUuid("0cc2abec-c252-4522-944e-7f496cd4d7a9"), true);
  for (const bad of [
    "507f1f77bcf86cd799439011",              // ObjectId cu
    "0cc2abec-c252-4522-944e-7f496cd4d7a",   // thieu ky tu
    "khong-phai-uuid", "", null, undefined, 123,
  ]) {
    assert.equal(isUuid(bad), false, String(bad));
  }
});
