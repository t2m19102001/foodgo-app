import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildAppTransId, computeCreateMac, createOrder, verifyCallbackMac, ZaloPayError } from "../util/zalopay.js";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  global.fetch = originalFetch;
  process.env.ZALOPAY_APP_ID = originalEnv.ZALOPAY_APP_ID;
  process.env.ZALOPAY_KEY1 = originalEnv.ZALOPAY_KEY1;
  process.env.ZALOPAY_KEY2 = originalEnv.ZALOPAY_KEY2;
  process.env.ZALOPAY_ENDPOINT = originalEnv.ZALOPAY_ENDPOINT;
  process.env.ZALOPAY_CALLBACK_URL = originalEnv.ZALOPAY_CALLBACK_URL;
});

test("buildAppTransId: dung dinh dang yymmdd_<16 ky tu cuoi orderId>, theo gio Viet Nam", () => {
  // 17:30 UTC ngay 01/01 = 00:30 ngay 02/01 o Viet Nam (GMT+7) - cung mui gio
  // da dung trong test cua vnpay.js (formatVnpDate) de dong bo quy uoc.
  const createdAt = new Date("2026-01-01T17:30:00Z");
  const orderId = "11111111-2222-3333-4444-5555abcdef01";
  // Bo dau "-" -> "111111112222333344445555abcdef01" (32 ky tu), 16 ky tu
  // cuoi la "44445555abcdef01".
  const appTransId = buildAppTransId(orderId, createdAt);
  assert.equal(appTransId, "260102_44445555abcdef01");
});

test("buildAppTransId: do dai luon <= 40 ky tu (gioi han ZaloPay)", () => {
  const appTransId = buildAppTransId("11111111-2222-3333-4444-555566667777", new Date());
  assert.ok(appTransId.length <= 40, appTransId);
  assert.match(appTransId, /^\d{6}_[0-9a-f]+$/);
});

test("computeCreateMac: dung cong thuc app_id|app_trans_id|app_user|amount|app_time|embed_data|item", () => {
  const params = {
    appId: "2553", appTransId: "260102_abc123", appUser: "foodgo",
    amount: 50000, appTime: 1767312600000, embedData: "{}", item: "[]",
  };
  const key1 = "test-key1";
  const expected = crypto.createHmac("sha256", key1)
    .update(`${params.appId}|${params.appTransId}|${params.appUser}|${params.amount}|${params.appTime}|${params.embedData}|${params.item}`)
    .digest("hex");
  assert.equal(computeCreateMac(params, key1), expected);
});

test("computeCreateMac: doi 1 field la doi mac (chong gia mao)", () => {
  const base = { appId: "2553", appTransId: "260102_abc123", appUser: "foodgo", amount: 50000, appTime: 1, embedData: "{}", item: "[]" };
  const mac1 = computeCreateMac(base, "key1");
  const mac2 = computeCreateMac({ ...base, amount: 50001 }, "key1");
  assert.notEqual(mac1, mac2);
});

test("createOrder: nem ZaloPayError khi thieu APP_ID/KEY1, khong goi fetch", async () => {
  delete process.env.ZALOPAY_APP_ID;
  process.env.ZALOPAY_KEY1 = "key1";
  let fetchCalled = false;
  global.fetch = async () => { fetchCalled = true; return { json: async () => ({}) }; };

  await assert.rejects(() => createOrder({ orderId: "abc", amount: 50000 }), ZaloPayError);
  assert.equal(fetchCalled, false);
});

test("createOrder: goi dung endpoint/content-type, gui dung field, tra ve orderUrl khi return_code=1", async () => {
  process.env.ZALOPAY_APP_ID = "2553";
  process.env.ZALOPAY_KEY1 = "test-key1";
  process.env.ZALOPAY_ENDPOINT = "https://fake-sandbox.zalopay.vn/v2/create";

  let capturedUrl;
  let capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      json: async () => ({
        return_code: 1, return_message: "success",
        order_url: "https://sbgateway.zalopay.vn/pay/abc", zp_trans_token: "tok123",
      }),
    };
  };

  const result = await createOrder({ orderId: "11111111-2222-3333-4444-555566667777", amount: 65000 });

  assert.equal(capturedUrl, "https://fake-sandbox.zalopay.vn/v2/create");
  assert.equal(capturedOptions.headers["Content-Type"], "application/x-www-form-urlencoded");
  const sentParams = new URLSearchParams(capturedOptions.body);
  assert.equal(sentParams.get("app_id"), "2553");
  assert.equal(sentParams.get("amount"), "65000");
  assert.ok(sentParams.get("mac"));
  assert.equal(result.orderUrl, "https://sbgateway.zalopay.vn/pay/abc");
  assert.equal(result.zpTransToken, "tok123");
});

test("createOrder: nem ZaloPayError khi return_code khac 1", async () => {
  process.env.ZALOPAY_APP_ID = "2553";
  process.env.ZALOPAY_KEY1 = "test-key1";
  global.fetch = async () => ({ json: async () => ({ return_code: 2, return_message: "Giao dich loi" }) });

  await assert.rejects(() => createOrder({ orderId: "abc", amount: 1000 }), ZaloPayError);
});

test("createOrder: nem ZaloPayError khi fetch bi reject (mat mang)", async () => {
  process.env.ZALOPAY_APP_ID = "2553";
  process.env.ZALOPAY_KEY1 = "test-key1";
  global.fetch = async () => { throw new Error("network down"); };

  await assert.rejects(() => createOrder({ orderId: "abc", amount: 1000 }), ZaloPayError);
});

test("verifyCallbackMac: mac dung voi key2 thi hop le", () => {
  process.env.ZALOPAY_KEY2 = "test-key2";
  const data = JSON.stringify({ app_trans_id: "260102_abc", amount: 50000 });
  const mac = crypto.createHmac("sha256", "test-key2").update(data).digest("hex");
  assert.equal(verifyCallbackMac(data, mac), true);
});

test("verifyCallbackMac: sai mac hoac sua data thi khong hop le", () => {
  process.env.ZALOPAY_KEY2 = "test-key2";
  const data = JSON.stringify({ amount: 50000 });
  const mac = crypto.createHmac("sha256", "test-key2").update(data).digest("hex");
  assert.equal(verifyCallbackMac(JSON.stringify({ amount: 99999 }), mac), false);
  assert.equal(verifyCallbackMac(data, "deadbeef"), false);
  assert.equal(verifyCallbackMac(data, ""), false);
});
