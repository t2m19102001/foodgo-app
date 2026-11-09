// Logic thuan cho voucher: khong doc DB, khong req/res - test duoc bang
// `node --test` khong can TEST_DATABASE_URL (xem test/voucher.test.js).
//
// Viec dem so lan da dung (usage_limit/usage_limit_per_user) BAT BUOC doc DB
// nen nam o db/vouchers.js + controller/orderController.js, khong o day.

export const DISCOUNT_TYPES = ["percent", "fixed"];

// voucher: { discountType, discountValue, maxDiscountAmount }
// orderAmount: subtotal TRUOC giam gia (VND, so nguyen)
// Tra ve so tien duoc giam, khong bao gio am va khong bao gio vuot orderAmount.
export const calcDiscountAmount = (voucher, orderAmount) => {
  let discount;
  if (voucher.discountType === "percent") {
    discount = Math.floor((orderAmount * voucher.discountValue) / 100);
    if (voucher.maxDiscountAmount != null) {
      discount = Math.min(discount, voucher.maxDiscountAmount);
    }
  } else {
    discount = voucher.discountValue;
  }
  return Math.max(0, Math.min(discount, orderAmount));
};

// Kiem cac dieu kien THUAN (khong can DB): active, thoi han, don toi thieu.
// Tra ve thong diep loi tieng Viet, hoac null khi hop le.
export const validateVoucherConditions = (voucher, orderAmount, now = new Date()) => {
  if (!voucher) return "Mã giảm giá không tồn tại";
  if (!voucher.isActive) return "Mã giảm giá đã bị khóa";
  if (voucher.validFrom && now < new Date(voucher.validFrom)) {
    return "Mã giảm giá chưa đến thời gian áp dụng";
  }
  if (voucher.validUntil && now > new Date(voucher.validUntil)) {
    return "Mã giảm giá đã hết hạn";
  }
  if (orderAmount < voucher.minOrderValue) {
    return `Đơn hàng cần tối thiểu ${Number(voucher.minOrderValue).toLocaleString("vi-VN")}đ để dùng mã này`;
  }
  return null;
};

// Regex ma voucher: chu/so/'-'/'_', 3-30 ky tu. Khong phan biet hoa thuong
// (cot code la citext) nen khong can tu lowercase/uppercase o day.
const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/i;

export const invalidVoucherCode = (code) =>
  (typeof code === "string" && CODE_PATTERN.test(code.trim())
    ? null
    : "Mã giảm giá chỉ gồm chữ, số, '-', '_' (3-30 ký tự)");

// Validate cac quy tac nghiep vu dac thu cua voucher (dung o controller admin
// khi tao/sua) - KHONG kiem cac truong co the kiem bang util/validate.js
// chung (do, kieu chuoi...), chi kiem rang buoc rieng cua voucher.
export const invalidVoucherBusinessRules = ({
  discountType, discountValue, maxDiscountAmount, validFrom, validUntil,
}) => {
  if (!DISCOUNT_TYPES.includes(discountType)) return "Loại giảm giá không hợp lệ";
  if (discountType === "percent" && (discountValue < 1 || discountValue > 100)) {
    return "Giảm theo % phải trong khoảng 1-100";
  }
  if (discountType === "fixed" && maxDiscountAmount != null) {
    return "Trần giảm tối đa chỉ áp dụng cho loại giảm theo %";
  }
  if (validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)) {
    return "Ngày bắt đầu phải trước ngày kết thúc";
  }
  return null;
};
