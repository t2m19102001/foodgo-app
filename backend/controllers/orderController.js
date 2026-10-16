import mongoose from "mongoose";
import { createHash } from "node:crypto";
import orderModel from "../models/orderModel.js";
import foodModel from "../models/foodModel.js";
import notificationModel from "../models/notificationModel.js";
import { buildPaymentUrl, verifySignature } from "../util/vnpay.js";
import logger from "../util/logger.js";

const VALID_PAYMENT_METHODS = ["cod", "vnpay"];
const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const NEXT_STATUSES = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 50;

const parsePagination = (query) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) return null;
  return { page, limit, skip: (page - 1) * limit };
};

export const canTransition = (from, to) => (NEXT_STATUSES[from] || []).includes(to);

const fingerprintOf = (quantities, address) => createHash("sha256")
  .update(JSON.stringify({
    items: [...quantities].sort(([a], [b]) => a.localeCompare(b)),
    address: [address.fullName, address.phone, address.address, address.note || ""]
      .map((value) => String(value).trim()),
  }))
  .digest("hex");

const existingOrderResponse = (res, order, fingerprint) => {
  if (order.requestFingerprint !== fingerprint) {
    return res.status(409).json({ success: false, message: "Mã yêu cầu đã dùng cho đơn hàng khác" });
  }
  return res.json({ success: true, message: "Đơn hàng đã được tạo", orderId: order._id, order });
};

const statusMessages = {
  confirmed: "Đơn hàng của bạn đã được xác nhận",
  shipped: "Đơn hàng của bạn đang được giao",
  delivered: "Đơn hàng của bạn đã được giao thành công",
  cancelled: "Đơn hàng của bạn đã bị hủy",
};

// Ma don rut gon 8 ky tu cuoi, giong cach app hien thi "Don hang #xxxxxxxx"
const shortCode = (orderId) => String(orderId).slice(-8);

const notifyOrderStatus = async (userId, orderId, status) => {
  const message = statusMessages[status];
  if (!message) return;
  try {
    await notificationModel.create({
      userId,
      title: "Cập nhật đơn hàng",
      message: `${message} (#${shortCode(orderId)})`,
    });
  } catch (error) {
    logger.error("Notify order status error:", error);
  }
};

const notifyOrderPlaced = async (userId, orderId, amount) => {
  try {
    await notificationModel.create({
      userId,
      title: "Đặt hàng thành công",
      message: `Đơn hàng #${shortCode(orderId)} đã được tạo, tổng tiền ${amount.toLocaleString(
        "vi-VN"
      )}đ. Chúng tôi sẽ xác nhận trong thời gian sớm nhất.`,
    });
  } catch (error) {
    logger.error("Notify order placed error:", error);
  }
};

const notifyPaymentResult = async (userId, orderId, success) => {
  try {
    await notificationModel.create({
      userId,
      title: success ? "Thanh toán VNPay thành công" : "Thanh toán VNPay thất bại",
      message: success
        ? `Đơn hàng #${shortCode(orderId)} đã được thanh toán qua VNPay.`
        : `Thanh toán VNPay cho đơn hàng #${shortCode(orderId)} không thành công. Vui lòng thử lại.`,
    });
  } catch (error) {
    logger.error("Notify payment result error:", error);
  }
};

export const placeOrder = async (req, res) => {
  try {
    const { items, address, clientRequestId, paymentMethod } = req.body || {};

    if (typeof clientRequestId !== "string" || !REQUEST_ID_PATTERN.test(clientRequestId)) {
      return res.status(400).json({ success: false, message: "Mã yêu cầu không hợp lệ" });
    }

    const normalizedPaymentMethod = VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : "cod";

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Giỏ hàng trống" });
    }
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ success: false, message: "Giỏ hàng có quá nhiều món" });
    }
    if (!address || typeof address !== "object" || Array.isArray(address)
        || ![address.fullName, address.phone, address.address].every((value) =>
          typeof value === "string" && value.trim().length > 0)
        || typeof (address.note ?? "") !== "string"
        || address.fullName.length > 100 || address.phone.length > 30
        || address.address.length > 300 || (address.note || "").length > 500) {
      return res.status(400).json({ success: false, message: "Thiếu địa chỉ giao hàng" });
    }

    // Gop cac dong trung foodId va chuan hoa so luong truoc khi doi chieu voi DB
    const quantityByFoodId = new Map();
    for (const item of items) {
      const foodId = item && item.foodId;
      if (!foodId || !mongoose.isValidObjectId(foodId)) {
        return res.status(400).json({ success: false, message: "Món ăn không hợp lệ" });
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ success: false, message: "Số lượng món không hợp lệ" });
      }
      const key = String(foodId).toLowerCase();
      const totalQuantity = (quantityByFoodId.get(key) || 0) + quantity;
      if (totalQuantity > 100) {
        return res.status(400).json({ success: false, message: "Số lượng món không hợp lệ" });
      }
      quantityByFoodId.set(key, totalQuantity);
    }

    const requestFingerprint = fingerprintOf(quantityByFoodId, address);
    const existing = await orderModel.findOne({ userId: req.userId, clientRequestId });
    if (existing) return existingOrderResponse(res, existing, requestFingerprint);

    const foodIds = [...quantityByFoodId.keys()];
    const foods = await foodModel.find({ _id: { $in: foodIds } });

    if (foods.length !== foodIds.length) {
      return res.status(400).json({ success: false, message: "Có món ăn không còn tồn tại" });
    }

    const soldOut = foods.find((food) => !food.isAvailable);
    if (soldOut) {
      return res
        .status(400)
        .json({ success: false, message: `Món "${soldOut.name}" hiện đã hết hàng` });
    }

    // Ten, gia, anh luon lay tu DB - khong tin du lieu client gui len
    const orderItems = foods.map((food) => ({
      foodId: food._id,
      name: food.name,
      price: food.price,
      quantity: quantityByFoodId.get(String(food._id)),
      image: food.image,
    }));

    // Tong tien do server tu cong lai, bo qua "amount" trong request
    const amount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await orderModel.create({
      userId: req.userId,
      clientRequestId,
      requestFingerprint,
      items: orderItems,
      amount,
      address,
      paymentMethod: normalizedPaymentMethod,
      status: "pending",
    });

    await notifyOrderPlaced(order.userId, order._id, amount);

    res
      .status(201)
      .json({ success: true, message: "Đặt hàng thành công", orderId: order._id, order });
  } catch (error) {
    if (error.code === 11000 && req.body?.clientRequestId) {
      const existing = await orderModel.findOne({ userId: req.userId, clientRequestId: req.body.clientRequestId });
      if (existing) {
        const quantities = new Map();
        for (const item of req.body.items || []) {
          const key = String(item.foodId).toLowerCase();
          quantities.set(key, (quantities.get(key) || 0) + Number(item.quantity));
        }
        return existingOrderResponse(res, existing, fingerprintOf(quantities, req.body.address));
      }
    }
    logger.error("Place order error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi đặt hàng" });
  }
};

export const createVnpayPayment = async (req, res) => {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (order.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền thanh toán đơn hàng này" });
    }
    if (order.paymentMethod !== "vnpay") {
      return res.status(400).json({ success: false, message: "Đơn hàng không sử dụng phương thức VNPay" });
    }
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Đơn hàng đã được thanh toán" });
    }

    const txnRef = `${order._id}-${Date.now()}`;
    order.vnpTxnRef = txnRef;
    await order.save();

    const payUrl = buildPaymentUrl({
      txnRef,
      amount: order.amount,
      orderInfo: `Thanh toan don hang ${shortCode(order._id)}`,
      ipAddr: req.ip,
    });

    res.json({ success: true, payUrl });
  } catch (error) {
    logger.error("Create VNPay payment error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi tạo thanh toán VNPay" });
  }
};

// Dung chung cho ca Return URL (browser redirect) va IPN (goi server-to-server tu VNPay)
const processVnpayResult = async (query) => {
  if (!verifySignature(query)) {
    return { ok: false, code: "97" };
  }

  const txnRef = query.vnp_TxnRef || "";
  const orderId = txnRef.slice(0, txnRef.lastIndexOf("-"));
  if (!orderId || !mongoose.isValidObjectId(orderId)) {
    return { ok: false, code: "01" };
  }

  const order = await orderModel.findById(orderId);
  if (!order) {
    return { ok: false, code: "02" };
  }

  // Da xu ly tu truoc (vi du Return URL va IPN cung bao ve mot giao dich) - coi nhu thanh cong, tranh xu ly trung
  if (order.paymentStatus === "paid") {
    return { ok: true, code: "00", order };
  }

  const success = query.vnp_ResponseCode === "00";
  order.paymentStatus = success ? "paid" : "failed";
  if (success && order.status === "pending") {
    order.status = "confirmed";
  }
  await order.save();
  await notifyPaymentResult(order.userId, order._id, success);

  return { ok: true, code: "00", order, success };
};

export const handleVnpayReturn = async (req, res) => {
  try {
    const result = await processVnpayResult(req.query);
    res.set("Content-Type", "text/html; charset=utf-8");
    if (!result.ok) {
      return res.send("<h3>Xac thuc thanh toan khong hop le. Vui long quay lai ung dung.</h3>");
    }
    const message = result.success === false
      ? "Thanh toan khong thanh cong. Vui long quay lai ung dung de thu lai."
      : "Thanh toan thanh cong! Vui long quay lai ung dung.";
    res.send(`<h3>${message}</h3>`);
  } catch (error) {
    logger.error("Handle VNPay return error:", error);
    res.status(500).send("<h3>Loi xu ly ket qua thanh toan.</h3>");
  }
};

export const handleVnpayIpn = async (req, res) => {
  try {
    const result = await processVnpayResult(req.query);
    if (!result.ok) {
      return res.json({ RspCode: result.code, Message: "Invalid checksum or order" });
    }
    res.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    logger.error("Handle VNPay IPN error:", error);
    res.json({ RspCode: "99", Message: "Unknown error" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Trang hoặc giới hạn không hợp lệ" });
    const { page, limit, skip } = pagination;

    const filter = { userId: req.userId };
    if (req.query.status) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
      }
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      orderModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      orderModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
      },
    });
  } catch (error) {
    logger.error("Get my orders error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đơn hàng" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    // Khong populate items.foodId: app Android doc foodId la chuoi, ten/gia/anh da luu san trong tung item
    const order = await orderModel.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (order.userId.toString() !== req.userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Không có quyền xem đơn hàng này" });
    }

    res.json({ success: true, order });
  } catch (error) {
    logger.error("Get order by id error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông tin đơn hàng" });
  }
};

export const getOrderByRequestId = async (req, res) => {
  try {
    if (!REQUEST_ID_PATTERN.test(req.params.clientRequestId)) {
      return res.status(400).json({ success: false, message: "Mã yêu cầu không hợp lệ" });
    }
    const order = await orderModel.findOne({
      userId: req.userId,
      clientRequestId: req.params.clientRequestId,
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Chưa tìm thấy đơn hàng" });
    }
    res.json({ success: true, orderId: order._id, order });
  } catch (error) {
    logger.error("Get order by request id error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi kiểm tra đơn hàng" });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const order = await orderModel.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (order.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền hủy đơn hàng này" });
    }
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({ success: false, message: "Đơn hàng không thể hủy vào lúc này" });
    }

    const updated = await orderModel.findOneAndUpdate(
      { _id: order._id, userId: req.userId, status: order.status },
      { $set: { status: "cancelled", cancelReason: reason || "" } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: "Đơn hàng đã thay đổi, vui lòng tải lại" });
    }

    await notifyOrderStatus(updated.userId, updated._id, "cancelled");

    res.json({ success: true, message: "Đã hủy đơn hàng thành công", order: updated });
  } catch (error) {
    logger.error("Cancel order error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi hủy đơn hàng" });
  }
};

export const listAllOrders = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Trang hoặc giới hạn không hợp lệ" });
    const { page, limit, skip } = pagination;

    const filter = {};
    if (req.query.status) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
      }
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      orderModel
        .find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email phone")
        .lean(),
      orderModel.countDocuments(filter),
    ]);

    // Tach thong tin khach sang field "customer": app Android doc "userId" la chuoi.
    // Dung .lean() nen phai tu tinh isCancellable (virtual khong con)
    const data = orders.map((order) => {
      const user = order.userId;
      const isPopulated = user && typeof user === "object";
      return {
        ...order,
        userId: isPopulated ? String(user._id) : String(user || ""),
        customer: isPopulated
          ? { name: user.name || "", email: user.email || "", phone: user.phone || "" }
          : null,
        isCancellable: ["pending", "confirmed"].includes(order.status),
      };
    });

    res.json({
      success: true,
      orders: data,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalOrders: total },
    });
  } catch (error) {
    logger.error("List all orders error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đơn hàng" });
  }
};

export const getOrderStats = async (req, res) => {
  try {
    const byStatusRaw = await orderModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]);
    const byStatus = VALID_STATUSES.map((status) => {
      const found = byStatusRaw.find((item) => item._id === status);
      return { status, count: found ? found.count : 0, total: found ? found.total : 0 };
    });

    const totalOrders = byStatus.reduce((sum, item) => sum + item.count, 0);
    const totalRevenue = byStatus.find((item) => item.status === "delivered")?.total || 0;

    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const last7DaysRaw = await orderModel.aggregate([
      { $match: { status: "delivered", createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const last7Days = last7DaysRaw.map((item) => ({
      date: item._id,
      revenue: item.revenue,
      count: item.count,
    }));

    res.json({ success: true, totalRevenue, totalOrders, byStatus, last7Days });
  } catch (error) {
    logger.error("Get order stats error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thống kê đơn hàng" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    if (!canTransition(order.status, status)) {
      return res
        .status(400)
        .json({ success: false, message: "Chuyển trạng thái không hợp lệ" });
    }

    const updated = await orderModel.findOneAndUpdate(
      { _id: order._id, status: order.status },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: "Đơn hàng đã thay đổi, vui lòng tải lại" });
    }

    await notifyOrderStatus(updated.userId, updated._id, status);

    res.json({ success: true, message: "Cập nhật trạng thái thành công", order: updated });
  } catch (error) {
    logger.error("Update order status error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật trạng thái đơn hàng" });
  }
};
