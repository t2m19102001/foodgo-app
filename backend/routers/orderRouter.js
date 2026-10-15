import express from "express";
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  getOrderByRequestId,
  cancelOrder,
  listAllOrders,
  getOrderStats,
  updateOrderStatus,
  createVnpayPayment,
  handleVnpayReturn,
  handleVnpayIpn,
} from "../controllers/orderController.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const orderRouter = express.Router();

orderRouter.post("/", authMiddleware, placeOrder);
orderRouter.get("/my", authMiddleware, getMyOrders);
orderRouter.get("/list", adminMiddleware, listAllOrders);
orderRouter.get("/stats", adminMiddleware, getOrderStats);
orderRouter.get("/request/:clientRequestId", authMiddleware, getOrderByRequestId);
orderRouter.post("/:id/vnpay/create-payment", authMiddleware, createVnpayPayment);
orderRouter.get("/vnpay/return", handleVnpayReturn);
orderRouter.get("/vnpay/ipn", handleVnpayIpn);
orderRouter.put("/:id/status", adminMiddleware, updateOrderStatus);
orderRouter.put("/:id/cancel", authMiddleware, cancelOrder);
orderRouter.get("/:id", authMiddleware, getOrderById);

export default orderRouter;
