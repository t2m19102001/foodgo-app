import test, { mock } from "node:test";
import assert from "node:assert/strict";
import reviewModel from "../models/reviewModel.js";
import orderModel from "../models/orderModel.js";
import notificationModel from "../models/notificationModel.js";
import { addReview, updateReview } from "../controllers/reviewController.js";
import { getMyNotifications, markAsRead, markAllAsRead } from "../controllers/notificationController.js";

const FOOD_ID = "507f1f77bcf86cd799439011";

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("a rating outside 1..5 is rejected before any database query", async () => {
  mock.method(orderModel, "exists", async () => { throw new Error("should not reach DB"); });
  try {
    for (const rating of [0, 6, 2.5]) {
      const response = makeResponse();
      await addReview({ userId: "user1", body: { foodId: FOOD_ID, rating } }, response);
      assert.equal(response.statusCode, 400);
    }
  } finally {
    mock.restoreAll();
  }
});

test("a food never received in a delivered order cannot be reviewed", async () => {
  let creates = 0;
  mock.method(orderModel, "exists", async () => null);
  mock.method(reviewModel, "create", async () => { creates++; });
  try {
    const response = makeResponse();
    await addReview({ userId: "user1", body: { foodId: FOOD_ID, rating: 5 } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(creates, 0);
  } finally {
    mock.restoreAll();
  }
});

test("the delivered-order check is scoped to the signed-in user and that food", async () => {
  let filter = null;
  mock.method(orderModel, "exists", async (query) => { filter = query; return null; });
  try {
    await addReview({ userId: "user1", body: { foodId: FOOD_ID, rating: 4 } }, makeResponse());
    assert.deepEqual(filter, { userId: "user1", status: "delivered", "items.foodId": FOOD_ID });
  } finally {
    mock.restoreAll();
  }
});

test("a second review for the same food is rejected", async () => {
  let creates = 0;
  mock.method(orderModel, "exists", async () => ({ _id: "order1" }));
  mock.method(reviewModel, "findOne", async () => ({ _id: "review1" }));
  mock.method(reviewModel, "create", async () => { creates++; });
  try {
    const response = makeResponse();
    await addReview({ userId: "user1", body: { foodId: FOOD_ID, rating: 5 } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(creates, 0);
  } finally {
    mock.restoreAll();
  }
});

test("a user cannot edit someone else's review", async () => {
  let saved = false;
  mock.method(reviewModel, "findById", async () => ({
    userId: { toString: () => "user2" },
    rating: 5,
    save: async () => { saved = true; },
  }));
  try {
    const response = makeResponse();
    await updateReview({ userId: "user1", params: { id: "review1" }, body: { rating: 1 } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(saved, false);
  } finally {
    mock.restoreAll();
  }
});

test("notifications are scoped to the signed-in user and carry the unread count", async () => {
  let findFilter = null;
  let countFilter = null;
  mock.method(notificationModel, "find", (filter) => {
    findFilter = filter;
    return { sort: async () => [{ _id: "notification1" }] };
  });
  mock.method(notificationModel, "countDocuments", async (filter) => {
    countFilter = filter;
    return 2;
  });
  try {
    const response = makeResponse();
    await getMyNotifications({ userId: "user1" }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.unreadCount, 2);
    assert.deepEqual(findFilter, { userId: "user1" });
    assert.deepEqual(countFilter, { userId: "user1", isRead: false });
  } finally {
    mock.restoreAll();
  }
});

test("marking a notification that belongs to another user returns 404", async () => {
  let filter = null;
  mock.method(notificationModel, "findOne", async (query) => { filter = query; return null; });
  try {
    const response = makeResponse();
    await markAsRead({ userId: "user1", params: { id: "notification1" } }, response);

    assert.equal(response.statusCode, 404);
    assert.deepEqual(filter, { _id: "notification1", userId: "user1" });
  } finally {
    mock.restoreAll();
  }
});

test("mark-all-as-read only touches the signed-in user's unread notifications", async () => {
  let filter = null;
  let update = null;
  mock.method(notificationModel, "updateMany", async (query, changes) => {
    filter = query;
    update = changes;
  });
  try {
    const response = makeResponse();
    await markAllAsRead({ userId: "user1" }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(filter, { userId: "user1", isRead: false });
    assert.deepEqual(update, { isRead: true });
  } finally {
    mock.restoreAll();
  }
});
