// Test thuan, khong can database: moi truong hop duoi day deu bi chan o tang
// validate truoc khi cham vao SQL.
//
// Vi sao khoa tung THONG DIEP mot: thong diep 400 la hop dong voi app Android -
// man dat hang doc message de hien toast, nen doi chu la doi hanh vi nguoi dung
// thay. Khi gom validate vao util/validate.js, test nay la cho duy nhat chung
// minh duoc 35 duong 400 van tra ve dung chu nhu truoc khi gom.
import test from "node:test";
import assert from "node:assert/strict";
import * as order from "../controllers/orderController.js";
import * as review from "../controllers/reviewController.js";
import {
  invalidUuid, invalidText, invalidOptionalText, invalidInt, firstProblem,
} from "../util/validate.js";

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  send(body) { this.body = body; return this; },
  set() { return this; },
});

const UUID = "11111111-1111-4111-8111-111111111111";
const address = { fullName: "Khach", phone: "0900000000", address: "1 Duong ABC", note: "" };

const expect400 = async (handler, req, message) => {
  const res = makeResponse();
  await handler({ query: {}, params: {}, body: {}, ...req }, res);
  assert.equal(res.statusCode, 400, `mong doi 400, nhan ${res.statusCode}`);
  assert.equal(res.body?.message, message);
};

test("placeOrder chan input sai voi dung thong diep", async () => {
  await expect400(order.placeOrder,
    { body: { items: [], address }, userId: UUID }, "Mã yêu cầu không hợp lệ");
  await expect400(order.placeOrder,
    { body: { clientRequestId: 12345, items: [], address }, userId: UUID }, "Mã yêu cầu không hợp lệ");
  await expect400(order.placeOrder,
    { body: { clientRequestId: UUID, items: [], address }, userId: UUID }, "Giỏ hàng trống");
  await expect400(order.placeOrder,
    { body: { clientRequestId: UUID, items: Array(51).fill({ foodId: UUID, quantity: 1 }), address }, userId: UUID },
    "Giỏ hàng có quá nhiều món");
  await expect400(order.placeOrder,
    { body: { clientRequestId: UUID, items: [{ foodId: UUID, quantity: 1 }] }, userId: UUID },
    "Thiếu địa chỉ giao hàng");
  await expect400(order.placeOrder,
    { body: { clientRequestId: UUID, items: [{ foodId: "abc", quantity: 1 }], address }, userId: UUID },
    "Món ăn không hợp lệ");
  await expect400(order.placeOrder,
    { body: { clientRequestId: UUID, items: [{ foodId: UUID, quantity: 0 }], address }, userId: UUID },
    "Số lượng món không hợp lệ");
  await expect400(order.placeOrder,
    { body: { clientRequestId: UUID, items: [{ foodId: UUID, quantity: 101 }], address }, userId: UUID },
    "Số lượng món không hợp lệ");
});

// Hai truong hop nay la ly do khong gop cac kiem o placeOrder vao firstProblem:
// firstProblem la ham thuong nen tinh het moi tham so, trong khi o day kiem sau
// chi an toan khi kiem truoc da di qua.
test("placeOrder: item = null tra 400 chu khong nem TypeError thanh 500", async () => {
  await expect400(order.placeOrder,
    { body: { clientRequestId: UUID, items: [null], address }, userId: UUID },
    "Món ăn không hợp lệ");
});

test("placeOrder: note = null van la dia chi hop le", async () => {
  // Di qua duoc validate dia chi thi loi bao tiep theo phai la loi cua mon an
  await expect400(order.placeOrder,
    {
      body: {
        clientRequestId: UUID,
        items: [{ foodId: "khong-phai-uuid", quantity: 1 }],
        address: { ...address, note: null },
      },
      userId: UUID,
    },
    "Món ăn không hợp lệ");
});

test("placeOrder: tran 100 tinh tren TONG cac dong trung cung mon", async () => {
  await expect400(order.placeOrder,
    {
      body: {
        clientRequestId: UUID,
        items: [{ foodId: UUID, quantity: 60 }, { foodId: UUID, quantity: 60 }],
        address,
      },
      userId: UUID,
    },
    "Số lượng món không hợp lệ");
});

test("cac endpoint don hang chan id va tham so sai", async () => {
  await expect400(order.getOrderById,
    { params: { id: "abc" }, userId: UUID, user: {} }, "Mã đơn hàng không hợp lệ");
  await expect400(order.getOrderByRequestId,
    { params: { clientRequestId: "abc" }, userId: UUID }, "Mã yêu cầu không hợp lệ");
  await expect400(order.abandonPendingPayment,
    { params: { clientRequestId: "abc" }, userId: UUID }, "Mã yêu cầu không hợp lệ");
  await expect400(order.cancelOrder,
    { params: { id: "abc" }, body: {}, userId: UUID }, "Mã đơn hàng không hợp lệ");
  await expect400(order.cancelOrder,
    { params: { id: UUID }, body: { reason: "x".repeat(501) }, userId: UUID }, "Lý do hủy không hợp lệ");
  await expect400(order.cancelOrder,
    { params: { id: UUID }, body: { reason: 5 }, userId: UUID }, "Lý do hủy không hợp lệ");
  await expect400(order.getMyOrders,
    { query: { page: 0 }, userId: UUID }, "Trang hoặc giới hạn không hợp lệ");
  await expect400(order.getMyOrders,
    { query: { status: "xyz" }, userId: UUID }, "Trạng thái không hợp lệ");
  await expect400(order.listAllOrders,
    { query: { status: "xyz" }, userId: UUID }, "Trạng thái không hợp lệ");
  await expect400(order.updateOrderStatus,
    { params: { id: "abc" }, body: { status: "shipped" }, userId: UUID }, "Mã đơn hàng không hợp lệ");
});

// Thu tu kiem quyet dinh thong diep nao client nhan duoc. Khoa lai de lan go
// sau khong lang le doi thu tu.
test("thu tu bao loi giu nguyen khi nhieu truong cung sai", async () => {
  await expect400(order.cancelOrder,
    { params: { id: "abc" }, body: { reason: 5 }, userId: UUID }, "Mã đơn hàng không hợp lệ");
  await expect400(order.updateOrderStatus,
    { params: { id: "abc" }, body: { status: "xyz" }, userId: UUID }, "Trạng thái không hợp lệ");
});

test("cac endpoint danh gia chan input sai", async () => {
  await expect400(review.addReview, { body: {}, userId: UUID }, "Thiếu thông tin đánh giá");
  await expect400(review.addReview,
    { body: { foodId: "abc", rating: 5 }, userId: UUID }, "Món ăn không hợp lệ");
  await expect400(review.addReview,
    { body: { foodId: UUID, rating: 6 }, userId: UUID }, "Số sao phải từ 1 đến 5");
  await expect400(review.addReview,
    { body: { foodId: UUID, rating: 2.5 }, userId: UUID }, "Số sao phải từ 1 đến 5");
  await expect400(review.addReview,
    { body: { foodId: UUID, rating: 5, comment: "x".repeat(501) }, userId: UUID }, "Nhận xét không hợp lệ");
  await expect400(review.addReview,
    { body: { foodId: UUID, rating: 5, comment: 5 }, userId: UUID }, "Nhận xét không hợp lệ");
  await expect400(review.getFoodReviews, { params: { foodId: "abc" } }, "Món ăn không hợp lệ");
  await expect400(review.updateReview,
    { params: { id: "abc" }, body: {}, userId: UUID }, "Mã đánh giá không hợp lệ");
  await expect400(review.updateReview,
    { params: { id: UUID }, body: { rating: 0 }, userId: UUID }, "Số sao phải từ 1 đến 5");
  await expect400(review.updateReview,
    { params: { id: UUID }, body: { comment: "x".repeat(501) }, userId: UUID }, "Nhận xét không hợp lệ");
  await expect400(review.deleteReview,
    { params: { id: "abc" }, userId: UUID }, "Mã đánh giá không hợp lệ");
});

// ------------------------------------------------------- util/validate.js thuan

test("invalidUuid", () => {
  assert.equal(invalidUuid(UUID, "Mã đơn hàng"), null);
  assert.equal(invalidUuid("abc", "Mã đơn hàng"), "Mã đơn hàng không hợp lệ");
  assert.equal(invalidUuid(undefined, "Mã đơn hàng"), "Mã đơn hàng không hợp lệ");
  assert.equal(invalidUuid(null, "Mã đơn hàng"), "Mã đơn hàng không hợp lệ");
  assert.equal(invalidUuid(12345, "Mã đơn hàng"), "Mã đơn hàng không hợp lệ");
  assert.equal(invalidUuid("abc", "X", "Cau rieng"), "Cau rieng");
});

test("invalidText: bat buoc, khong rong sau trim", () => {
  assert.equal(invalidText("Khach", { label: "Tên", max: 100 }), null);
  assert.equal(invalidText("   ", { label: "Tên", max: 100 }), "Tên không hợp lệ");
  assert.equal(invalidText("", { label: "Tên", max: 100 }), "Tên không hợp lệ");
  assert.equal(invalidText(undefined, { label: "Tên", max: 100 }), "Tên không hợp lệ");
  // Do dai do tren chuoi THO: 500 dau cach khong di qua duoc tran
  assert.equal(invalidText(" ".repeat(101), { label: "Tên", max: 100 }), "Tên không hợp lệ");
});

test("invalidOptionalText: thieu han la hop le, rong cung hop le", () => {
  assert.equal(invalidOptionalText(undefined, { label: "Nhận xét", max: 500 }), null);
  assert.equal(invalidOptionalText("", { label: "Nhận xét", max: 500 }), null);
  assert.equal(invalidOptionalText("ngon", { label: "Nhận xét", max: 500 }), null);
  assert.equal(invalidOptionalText("x".repeat(501), { label: "Nhận xét", max: 500 }), "Nhận xét không hợp lệ");
  assert.equal(invalidOptionalText(5, { label: "Nhận xét", max: 500 }), "Nhận xét không hợp lệ");
  // null KHONG phai "thieu han": cho nao coi null la hop le phai tu doi sang undefined
  assert.equal(invalidOptionalText(null, { label: "Nhận xét", max: 500 }), "Nhận xét không hợp lệ");
});

test("invalidInt: nhan chuoi so, chan so thuc va ngoai khoang", () => {
  const rule = { label: "Số lượng món", min: 1, max: 100 };
  assert.equal(invalidInt(1, rule), null);
  assert.equal(invalidInt(100, rule), null);
  assert.equal(invalidInt("2", rule), null);
  assert.equal(invalidInt(0, rule), "Số lượng món không hợp lệ");
  assert.equal(invalidInt(101, rule), "Số lượng món không hợp lệ");
  assert.equal(invalidInt(2.5, rule), "Số lượng món không hợp lệ");
  assert.equal(invalidInt("hai", rule), "Số lượng món không hợp lệ");
  assert.equal(invalidInt(undefined, rule), "Số lượng món không hợp lệ");
  // Number(null) = 0 va Number("") = 0, nen min >= 1 tu loai duoc ca hai
  assert.equal(invalidInt(null, rule), "Số lượng món không hợp lệ");
  assert.equal(invalidInt("", rule), "Số lượng món không hợp lệ");
});

test("firstProblem tra thong diep dau tien theo thu tu tham so", () => {
  assert.equal(firstProblem(null, null), null);
  assert.equal(firstProblem(), null);
  assert.equal(firstProblem(null, "loi B", "loi C"), "loi B");
  assert.equal(firstProblem("loi A", "loi B"), "loi A");
});
