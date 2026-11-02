import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentUrl, formatVnpDate, verifySignature } from "../util/vnpay.js";

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

test("ngay gui VNPay luon theo gio Viet Nam, khong phu thuoc mui gio may chu", () => {
  // 17:30 UTC ngay 01/01 = 00:30 ngay 02/01 o Viet Nam (GMT+7)
  assert.equal(formatVnpDate(new Date("2026-01-01T17:30:00Z")), "20260102003000");
  assert.equal(formatVnpDate(new Date("2026-06-30T23:59:59+07:00")), "20260630235959");
});

test("payUrl co vnp_ExpireDate dung bang han truyen vao va nam trong chu ky", () => {
  const createdAt = new Date("2026-11-02T03:00:00Z");
  const expiresAt = new Date("2026-11-02T03:15:00Z");
  const url = new URL(buildPaymentUrl({
    txnRef: "order1-1760000000000", amount: 150000, orderInfo: "x", createdAt, expiresAt,
  }));
  assert.equal(url.searchParams.get("vnp_CreateDate"), "20261102100000");
  assert.equal(url.searchParams.get("vnp_ExpireDate"), "20261102101500");
  const query = Object.fromEntries(url.searchParams.entries());
  assert.equal(verifySignature(query), true);
  assert.equal(verifySignature({ ...query, vnp_ExpireDate: "20991231235959" }), false,
    "sua han thanh toan phai lam hong chu ky");
});
