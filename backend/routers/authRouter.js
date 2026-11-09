import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  listDrivers,
  setDriverFlag,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
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

// Khong co gioi han thi oldPassword bi thu vo han, va moi lan thu la mot
// bcrypt.compare - vua la lo hong be mat khau vua la DoS CPU gia re.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn đã thử sai quá nhiều lần, vui lòng thử lại sau 15 phút" },
});

// Email thi khong bi gioi han theo email cu the (se cho phep ke tan cong lam
// ngap hop thu nguoi khac) - gioi han theo IP la du cho quy mo nay.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn đã yêu cầu quá nhiều lần, vui lòng thử lại sau 1 giờ" },
});

// Dung chung kieu voi changePasswordLimiter: chi dem lan thu MA sai, doan
// dung ngay lan dau khong bi tinh.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn đã thử sai quá nhiều lần, vui lòng thử lại sau 15 phút" },
});

authRouter.post("/register", registerLimiter, registerUser);
authRouter.post("/login", loginLimiter, loginUser);
authRouter.post("/forgot-password", forgotPasswordLimiter, requestPasswordReset);
authRouter.post("/reset-password", resetPasswordLimiter, resetPassword);
authRouter.get("/profile", authMiddleware, getProfile);
authRouter.put(
  "/profile",
  authMiddleware,
  uploadMiddleware.single("image"),
  handleUploadError,
  validateUploadedImage,
  updateProfile
);
authRouter.put("/change-password", changePasswordLimiter, authMiddleware, changePassword);
// Can mat khau de xac nhan nen dung chung bo dem thu sai voi doi mat khau
authRouter.delete("/account", changePasswordLimiter, authMiddleware, deleteAccount);

// Location Sharing (ban nhe) - admin "thang cap" user thuong thanh tai xe
authRouter.get("/drivers", adminMiddleware, listDrivers);
authRouter.put("/users/:id/driver", adminMiddleware, setDriverFlag);

export default authRouter;
