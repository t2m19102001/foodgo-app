import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { makeResponse } from "./helpers/db.mjs";
import { getRestaurantLocation } from "../controllers/restaurantController.js";

const original = {
  RESTAURANT_LAT: process.env.RESTAURANT_LAT,
  RESTAURANT_LNG: process.env.RESTAURANT_LNG,
  RESTAURANT_NAME: process.env.RESTAURANT_NAME,
};
afterEach(() => {
  process.env.RESTAURANT_LAT = original.RESTAURANT_LAT;
  process.env.RESTAURANT_LNG = original.RESTAURANT_LNG;
  process.env.RESTAURANT_NAME = original.RESTAURANT_NAME;
});

test("tra dung toa do khi da cau hinh", () => {
  process.env.RESTAURANT_LAT = "10.7769";
  process.env.RESTAURANT_LNG = "106.7009";
  process.env.RESTAURANT_NAME = "FoodGo Quan 1";

  const response = makeResponse();
  getRestaurantLocation({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.lat, 10.7769);
  assert.equal(response.body.lng, 106.7009);
  assert.equal(response.body.name, "FoodGo Quan 1");
});

test("tra 503 khi chua cau hinh toa do (khong tra toa do bia)", () => {
  delete process.env.RESTAURANT_LAT;
  delete process.env.RESTAURANT_LNG;

  const response = makeResponse();
  getRestaurantLocation({}, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
});

test("mac dinh ten 'FoodGo' khi khong dat RESTAURANT_NAME", () => {
  process.env.RESTAURANT_LAT = "10";
  process.env.RESTAURANT_LNG = "106";
  delete process.env.RESTAURANT_NAME;

  const response = makeResponse();
  getRestaurantLocation({}, response);
  assert.equal(response.body.name, "FoodGo");
});
