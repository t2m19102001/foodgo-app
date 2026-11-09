import express from "express";
import {
  listVouchers,
  getVoucherDetail,
  addVoucher,
  updateVoucher,
  removeVoucher,
  validateVoucher,
} from "../controllers/voucherController.js";
import { adminMiddleware, authMiddleware } from "../middleware/auth.js";

const voucherRouter = express.Router();

// Khach hang da dang nhap (khong can admin) duoc kiem/preview ma giam gia
// truoc khi dat hang - dat TRUOC "/:id" de khong bi nham voi GET /:id.
voucherRouter.post("/validate", authMiddleware, validateVoucher);

voucherRouter.get("/", adminMiddleware, listVouchers);
voucherRouter.get("/:id", adminMiddleware, getVoucherDetail);
voucherRouter.post("/", adminMiddleware, addVoucher);
voucherRouter.put("/:id", adminMiddleware, updateVoucher);
voucherRouter.delete("/:id", adminMiddleware, removeVoucher);

export default voucherRouter;
