import test, { mock } from "node:test";
import assert from "node:assert/strict";
import foodModel from "../models/foodModel.js";
import { listFood } from "../controllers/foodController.js";
import { parseOptionalPagination } from "../util/pagination.js";

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const makeQueryChain = (items, calls) => ({
  sort(order) { calls.sort = order; return this; },
  skip(value) { calls.skip = value; return this; },
  limit(value) { calls.limit = value; return Promise.resolve(items); },
});

test("page/limit are optional but validated when present", () => {
  assert.deepEqual(parseOptionalPagination({}), { paginated: false });
  assert.deepEqual(parseOptionalPagination({ page: "2", limit: "20" }),
    { paginated: true, page: 2, limit: 20, skip: 20 });
  for (const query of [{ page: "0" }, { page: "-1" }, { limit: "0" }, { limit: "101" }, { page: "abc" }]) {
    assert.deepEqual(parseOptionalPagination(query), { invalid: true }, JSON.stringify(query));
  }
});

test("listFood without page/limit keeps the old response shape under a hard cap", async () => {
  const calls = {};
  mock.method(foodModel, "find", () => makeQueryChain([{ _id: "food1" }], calls));
  mock.method(foodModel, "countDocuments", async () => 1);
  try {
    const response = makeResponse();
    await listFood({ query: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.foods.length, 1);
    assert.equal(calls.limit, 200);
    assert.equal(calls.skip, 0);
    assert.deepEqual(response.body.pagination,
      { currentPage: 1, totalPages: 1, totalItems: 1, limit: 200 });
  } finally {
    mock.restoreAll();
  }
});

test("listFood paginates when asked and reports the total page count", async () => {
  const calls = {};
  mock.method(foodModel, "find", () => makeQueryChain([{ _id: "food3" }, { _id: "food4" }], calls));
  mock.method(foodModel, "countDocuments", async () => 9);
  try {
    const response = makeResponse();
    await listFood({ query: { page: "2", limit: "2" } }, response);

    assert.equal(calls.skip, 2);
    assert.equal(calls.limit, 2);
    assert.deepEqual(response.body.pagination,
      { currentPage: 2, totalPages: 5, totalItems: 9, limit: 2 });
  } finally {
    mock.restoreAll();
  }
});

test("listFood rejects invalid pagination before querying the database", async () => {
  mock.method(foodModel, "find", () => { throw new Error("should not reach DB"); });
  try {
    const response = makeResponse();
    await listFood({ query: { limit: "999" } }, response);
    assert.equal(response.statusCode, 400);
  } finally {
    mock.restoreAll();
  }
});
