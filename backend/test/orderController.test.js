import test, { mock } from "node:test";
import assert from "node:assert/strict";
import orderModel from "../models/orderModel.js";
import foodModel from "../models/foodModel.js";
import notificationModel from "../models/notificationModel.js";
import { canTransition, cancelOrder, getMyOrders, getOrderStats, placeOrder, updateOrderStatus } from "../controllers/orderController.js";

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("only allowed order transitions are accepted", () => {
  const allowed = [
    ["pending", "confirmed"], ["pending", "cancelled"],
    ["confirmed", "shipped"], ["confirmed", "cancelled"],
    ["shipped", "delivered"],
  ];
  for (const from of ["pending", "confirmed", "shipped", "delivered", "cancelled"]) {
    for (const to of ["pending", "confirmed", "shipped", "delivered", "cancelled"]) {
      assert.equal(canTransition(from, to), allowed.some(([a, b]) => a === from && b === to));
    }
  }
});

test("a stale status update returns conflict without notification", async () => {
  const order = { _id: "order1", userId: "user1", status: "pending" };
  let notifications = 0;
  mock.method(orderModel, "findById", async () => order);
  mock.method(orderModel, "findOneAndUpdate", async () => null);
  mock.method(notificationModel, "create", async () => { notifications++; });
  try {
    const response = makeResponse();
    await updateOrderStatus({ body: { status: "confirmed" }, params: { id: "order1" } }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(notifications, 0);
  } finally {
    mock.restoreAll();
  }
});

test("API rejects skipping a status and concurrent customer cancellation", async () => {
  const userId = "507f1f77bcf86cd799439012";
  const order = { _id: "order1", userId: { toString: () => userId }, status: "pending" };
  let updates = 0;
  mock.method(orderModel, "findById", async () => order);
  mock.method(orderModel, "findOneAndUpdate", async () => { updates++; return null; });
  try {
    const skipped = makeResponse();
    await updateOrderStatus({ body: { status: "delivered" }, params: { id: "order1" } }, skipped);
    assert.equal(skipped.statusCode, 400);
    assert.equal(updates, 0);

    const cancelled = makeResponse();
    await cancelOrder({ userId, body: { reason: "Changed mind" }, params: { id: "order1" } }, cancelled);
    assert.equal(cancelled.statusCode, 409);
    assert.equal(updates, 1);
  } finally {
    mock.restoreAll();
  }
});

test("invalid pagination returns 400 before database query", async () => {
  const response = makeResponse();
  await getMyOrders({ userId: "user1", query: { page: "-1", limit: "10" } }, response);
  assert.equal(response.statusCode, 400);
});

test("repeated checkout returns the original order and creates one notification", async () => {
  const foodId = "507f1f77bcf86cd799439011";
  const userId = "507f1f77bcf86cd799439012";
  const clientRequestId = "123e4567-e89b-42d3-a456-426614174000";
  const request = {
    userId,
    body: {
      clientRequestId,
      items: [{ foodId, quantity: 2, price: 1 }],
      address: { fullName: "Test", phone: "0123456789", address: "Street" },
    },
  };
  let saved = null;
  let creates = 0;
  let notifications = 0;
  mock.method(orderModel, "findOne", async () => saved);
  mock.method(foodModel, "find", async () => [{ _id: foodId, name: "Meal", price: 25000, image: "", isAvailable: true }]);
  mock.method(orderModel, "create", async (data) => {
    creates++;
    saved = { ...data, _id: "order1" };
    return saved;
  });
  mock.method(notificationModel, "create", async () => { notifications++; });
  try {
    const first = makeResponse();
    const replay = makeResponse();
    await placeOrder(request, first);
    await placeOrder(request, replay);
    assert.equal(first.statusCode, 201);
    assert.equal(replay.statusCode, 200);
    assert.equal(first.body.order.amount, 50000);
    assert.equal(replay.body.orderId, "order1");
    assert.equal(creates, 1);
    assert.equal(notifications, 1);
  } finally {
    mock.restoreAll();
  }
});

test("order stats fill missing statuses with zero and sum delivered revenue", async () => {
  mock.method(orderModel, "aggregate", async (pipeline) => {
    // Phan biet 2 loi goi aggregate dua theo $match co trong pipeline hay khong (tong theo trang thai vs 7 ngay)
    const isDailyBreakdown = pipeline.some((stage) => stage.$match);
    if (isDailyBreakdown) {
      return [{ _id: "2026-10-10", revenue: 50000, count: 1 }];
    }
    return [
      { _id: "pending", count: 2, total: 20000 },
      { _id: "delivered", count: 3, total: 150000 },
    ];
  });
  try {
    const response = makeResponse();
    await getOrderStats({}, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.totalOrders, 5);
    assert.equal(response.body.totalRevenue, 150000);
    assert.deepEqual(
      response.body.byStatus.find((item) => item.status === "shipped"),
      { status: "shipped", count: 0, total: 0 }
    );
    assert.deepEqual(response.body.last7Days, [{ date: "2026-10-10", revenue: 50000, count: 1 }]);
  } finally {
    mock.restoreAll();
  }
});

test("concurrent checkout with one request id creates only one order", async () => {
  const foodId = "507f1f77bcf86cd799439011";
  const request = {
    userId: "507f1f77bcf86cd799439012",
    body: {
      clientRequestId: "123e4567-e89b-42d3-a456-426614174000",
      items: [{ foodId, quantity: 1 }],
      address: { fullName: "Test", phone: "0123456789", address: "Street" },
    },
  };
  let saved = null;
  let creates = 0;
  let lookups = 0;
  mock.method(orderModel, "findOne", async () => ++lookups <= 2 ? null : saved);
  mock.method(foodModel, "find", async () => [{ _id: foodId, name: "Meal", price: 25000, image: "", isAvailable: true }]);
  mock.method(orderModel, "create", async (data) => {
    creates++;
    if (creates === 2) throw Object.assign(new Error("duplicate key"), { code: 11000 });
    saved = { ...data, _id: "order1" };
    return saved;
  });
  mock.method(notificationModel, "create", async () => {});
  try {
    const first = makeResponse();
    const second = makeResponse();
    await Promise.all([placeOrder(request, first), placeOrder(request, second)]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 201]);
    assert.equal(first.body.orderId, second.body.orderId);
    assert.equal(creates, 2);
  } finally {
    mock.restoreAll();
  }
});
