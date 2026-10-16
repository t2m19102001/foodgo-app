import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";
import { uploadMiddleware, handleUploadError, validateUploadedImage } from "../middleware/upload.js";

const authRouter = express.Router();

// Chi dem cac lan dang nhap that bai: demo dang nhap nhieu lan van thoai mai, nhung do mat khau thi bi chan
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn đã thử sai quá nhiều lần, vui lòng thử lại sau 15 phút" },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn đã đăng ký quá nhiều lần, vui lòng thử lại sau 1 giờ" },
});

authRouter.post("/register", registerLimiter, registerUser);
authRouter.post("/login", loginLimiter, loginUser);
authRouter.get("/profile", authMiddleware, getProfile);
authRouter.put(
  "/profile",
  authMiddleware,
  uploadMiddleware.single("image"),
  handleUploadError,
  validateUploadedImage,
  updateProfile
);
authRouter.put("/change-password", authMiddleware, changePassword);

export default authRouter;
