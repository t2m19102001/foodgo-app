import express from "express";
import rateLimit from "express-rate-limit";
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  getOrderByRequestId,
  abandonPendingPayment,
  cancelOrder,
  listAllOrders,
  getOrderStats,
  updateOrderStatus,
  handleVnpayReturn,
  handleVnpayIpn,
} from "../controllers/orderController.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const orderRouter = express.Router();

// Moi don tao them mot thong bao, nen khong gioi han la spam duoc vo han.
// Nguong dat cao de nguoi dung that khong bao gio cham toi.
const placeOrderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn đặt hàng quá nhiều lần, vui lòng thử lại sau" },
});

orderRouter.post("/", placeOrderLimiter, authMiddleware, placeOrder);
orderRouter.get("/my", authMiddleware, getMyOrders);
orderRouter.get("/list", adminMiddleware, listAllOrders);
orderRouter.get("/stats", adminMiddleware, getOrderStats);
orderRouter.get("/request/:clientRequestId", authMiddleware, getOrderByRequestId);
// Khach bo thanh toan VNPay dang cho de doi phuong thuc / doi gio hang
orderRouter.post("/request/:clientRequestId/abandon", authMiddleware, abandonPendingPayment);
orderRouter.get("/vnpay/return", handleVnpayReturn);
orderRouter.get("/vnpay/ipn", handleVnpayIpn);
orderRouter.put("/:id/status", adminMiddleware, updateOrderStatus);
orderRouter.put("/:id/cancel", authMiddleware, cancelOrder);
orderRouter.get("/:id", authMiddleware, getOrderById);

export default orderRouter;
