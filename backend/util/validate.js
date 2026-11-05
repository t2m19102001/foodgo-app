// Kiem tra input o tang controller.
//
// Moi ham tra ve null khi hop le, hoac THONG DIEP LOI tieng Viet khi khong.
// Khong ham nao cham vao req/res: nho the chung kiem duoc ca truong trong body,
// trong params va trong query bang cung mot cach, va test duoc rieng.
//
// Thong diep la mot phan hop dong voi app Android (va voi cac check trong
// scripts/e2e-smoke.mjs) nen giu nguyen van dang "<Ten truong> khong hop le".
// Cho nao can cau khac thi truyen `message`.
import { isUuid } from "./ids.js";

const invalidMessage = (label, message) => message || `${label} không hợp lệ`;

// Khoa chinh la uuid. Chan id sai ngay o tang controller thay vi de query nem
// loi roi tra 500 - client phai phan biet duoc "id sai" voi "server chet".
export const invalidUuid = (value, label, message) =>
  (isUuid(value) ? null : invalidMessage(label, message));

// Chuoi BAT BUOC: phai la chuoi, khong rong sau khi trim, khong qua max ky tu.
// Do dai do bang do dai THO (truoc trim) de 500 dau cach khong di qua duoc.
export const invalidText = (value, { label, max, message } = {}) => {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    return invalidMessage(label, message);
  }
  return null;
};

// Chuoi TUY CHON: thieu han (undefined) la hop le. Co thi phai la chuoi khong
// qua max ky tu - KHONG doi hoi khac rong, vi "" la cach client xoa noi dung cu.
export const invalidOptionalText = (value, { label, max, message } = {}) => {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length > max) return invalidMessage(label, message);
  return null;
};

// So nguyen trong khoang [min, max]. Nhan ca chuoi so ("3") vi app gui form-data:
// Number("3") = 3. Luu y Number(null) = 0 va Number("") = 0, nen khoang co
// min >= 1 tu dong loai duoc hai gia tri do.
export const invalidInt = (value, { label, min, max, message } = {}) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    return invalidMessage(label, message);
  }
  return null;
};

// Thong diep DAU TIEN trong danh sach, hoac null khi tat ca hop le. Thu tu
// tham so la thu tu bao loi, nen giu dung thu tu kiem cu khi go lai mot
// controller - doi thu tu la doi thong diep ma client nhan duoc.
//
// CAN THAN: day la ham thuong, nen MOI tham so da duoc tinh xong truoc khi than
// ham chay - khong co short-circuit nhu chuoi if. Dung no khi cac bieu thuc deu
// an toan. Cho nao kiem sau phai doc field cua mot gia tri ma kiem truoc vua
// chung minh la hop le (vi du item.quantity sau khi da biet item khong null) thi
// phai viet tung if roi nhau, neu khong mot item null se nem TypeError va bien
// 400 thanh 500.
export const firstProblem = (...problems) => problems.find((problem) => problem !== null) ?? null;

export default {
  invalidUuid, invalidText, invalidOptionalText, invalidInt, firstProblem,
};
