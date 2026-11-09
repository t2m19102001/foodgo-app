import test from "node:test";
import assert from "node:assert/strict";
import {
  calcDiscountAmount, validateVoucherConditions, invalidVoucherCode, invalidVoucherBusinessRules,
} from "../util/voucher.js";

// ---- calcDiscountAmount ----

test("calcDiscountAmount: percent khong tran, lam tron xuong", () => {
  // 100000 * 10% = 10000
  assert.equal(calcDiscountAmount({ discountType: "percent", discountValue: 10 }, 100000), 10000);
  // 99999 * 10% = 9999.9 -> floor 9999
  assert.equal(calcDiscountAmount({ discountType: "percent", discountValue: 10 }, 99999), 9999);
});

test("calcDiscountAmount: percent co tran se bi kep lai bang tran", () => {
  const voucher = { discountType: "percent", discountValue: 50, maxDiscountAmount: 20000 };
  // 100000 * 50% = 50000, nhung tran la 20000
  assert.equal(calcDiscountAmount(voucher, 100000), 20000);
  // 30000 * 50% = 15000, duoi tran -> khong bi kep
  assert.equal(calcDiscountAmount(voucher, 30000), 15000);
});

test("calcDiscountAmount: fixed tra dung so tien, khong phu thuoc orderAmount", () => {
  assert.equal(calcDiscountAmount({ discountType: "fixed", discountValue: 20000 }, 100000), 20000);
});

test("calcDiscountAmount: khong bao gio am va khong bao gio vuot orderAmount", () => {
  // fixed lon hon don -> kep lai bang orderAmount, khong am tien
  assert.equal(calcDiscountAmount({ discountType: "fixed", discountValue: 50000 }, 30000), 30000);
  assert.equal(calcDiscountAmount({ discountType: "percent", discountValue: 100 }, 10000), 10000);
});

// ---- validateVoucherConditions ----

test("validateVoucherConditions: voucher khong ton tai", () => {
  assert.equal(validateVoucherConditions(null, 100000), "Mã giảm giá không tồn tại");
});

test("validateVoucherConditions: bi khoa (isActive = false)", () => {
  const voucher = { isActive: false, minOrderValue: 0 };
  assert.equal(validateVoucherConditions(voucher, 100000), "Mã giảm giá đã bị khóa");
});

test("validateVoucherConditions: chua den thoi gian ap dung", () => {
  const voucher = { isActive: true, minOrderValue: 0, validFrom: "2999-01-01T00:00:00Z" };
  assert.equal(validateVoucherConditions(voucher, 100000), "Mã giảm giá chưa đến thời gian áp dụng");
});

test("validateVoucherConditions: da het han", () => {
  const voucher = { isActive: true, minOrderValue: 0, validUntil: "2000-01-01T00:00:00Z" };
  assert.equal(validateVoucherConditions(voucher, 100000), "Mã giảm giá đã hết hạn");
});

test("validateVoucherConditions: don chua dat toi thieu", () => {
  const voucher = { isActive: true, minOrderValue: 200000 };
  assert.match(validateVoucherConditions(voucher, 100000), /tối thiểu/);
});

test("validateVoucherConditions: hop le tra ve null", () => {
  const voucher = {
    isActive: true, minOrderValue: 50000,
    validFrom: "2000-01-01T00:00:00Z", validUntil: "2999-01-01T00:00:00Z",
  };
  assert.equal(validateVoucherConditions(voucher, 100000), null);
});

// ---- invalidVoucherCode ----

test("invalidVoucherCode: hop le", () => {
  assert.equal(invalidVoucherCode("SALE10"), null);
  assert.equal(invalidVoucherCode("sale_10-off"), null);
});

test("invalidVoucherCode: khong hop le", () => {
  assert.notEqual(invalidVoucherCode("AB"), null); // qua ngan
  assert.notEqual(invalidVoucherCode("có dấu"), null); // co dau, co khoang trang
  assert.notEqual(invalidVoucherCode(""), null);
  assert.notEqual(invalidVoucherCode(123), null);
});

// ---- invalidVoucherBusinessRules ----

test("invalidVoucherBusinessRules: loai giam gia khong hop le", () => {
  assert.notEqual(invalidVoucherBusinessRules({ discountType: "percentage", discountValue: 10 }), null);
});

test("invalidVoucherBusinessRules: percent ngoai khoang 1-100", () => {
  assert.notEqual(invalidVoucherBusinessRules({ discountType: "percent", discountValue: 0 }), null);
  assert.notEqual(invalidVoucherBusinessRules({ discountType: "percent", discountValue: 101 }), null);
  assert.equal(invalidVoucherBusinessRules({ discountType: "percent", discountValue: 100 }), null);
});

test("invalidVoucherBusinessRules: fixed khong duoc kem tran giam toi da", () => {
  assert.notEqual(
    invalidVoucherBusinessRules({ discountType: "fixed", discountValue: 20000, maxDiscountAmount: 5000 }),
    null
  );
  assert.equal(
    invalidVoucherBusinessRules({ discountType: "fixed", discountValue: 20000, maxDiscountAmount: null }),
    null
  );
});

test("invalidVoucherBusinessRules: ngay bat dau phai truoc ngay ket thuc", () => {
  assert.notEqual(
    invalidVoucherBusinessRules({
      discountType: "fixed", discountValue: 1000,
      validFrom: "2026-02-01T00:00:00Z", validUntil: "2026-01-01T00:00:00Z",
    }),
    null
  );
});
