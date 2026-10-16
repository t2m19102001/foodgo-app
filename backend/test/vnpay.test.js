import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentUrl, verifySignature } from "../util/vnpay.js";

process.env.VNPAY_TMN_CODE = "TEST01";
process.env.VNPAY_HASH_SECRET = "secret-sandbox-chi-dung-trong-test";
process.env.VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
process.env.VNPAY_RETURN_URL = "http://10.0.2.2:5000/api/order/vnpay/return";

const signedQuery = () => {
  const url = new URL(buildPaymentUrl({
    txnRef: "order1-1760000000000",
    amount: 150000,
    orderInfo: "Thanh toan don FoodGo",
    ipAddr: "127.0.0.1",
  }));
  return Object.fromEntries(url.searchParams.entries());
};

test("payment url sends the amount in VND x100 and keeps the merchant code", () => {
  const query = signedQuery();
  assert.equal(query.vnp_Amount, "15000000");
  assert.equal(query.vnp_TmnCode, "TEST01");
  assert.equal(query.vnp_Version, "2.1.0");
  assert.ok(query.vnp_SecureHash.length > 0);
});

test("a signature produced by our own secret verifies", () => {
  assert.equal(verifySignature(signedQuery()), true);
});

test("tampering with the amount or the hash invalidates the signature", () => {
  const tamperedAmount = { ...signedQuery(), vnp_Amount: "100" };
  assert.equal(verifySignature(tamperedAmount), false);

  const tamperedHash = { ...signedQuery(), vnp_SecureHash: "deadbeef" };
  assert.equal(verifySignature(tamperedHash), false);

  const withoutHash = { ...signedQuery() };
  delete withoutHash.vnp_SecureHash;
  assert.equal(verifySignature(withoutHash), false);
});

test("a signature made with a different secret is rejected", () => {
  const query = signedQuery();
  process.env.VNPAY_HASH_SECRET = "mot-secret-khac";
  try {
    assert.equal(verifySignature(query), false);
  } finally {
    process.env.VNPAY_HASH_SECRET = "secret-sandbox-chi-dung-trong-test";
  }
});
