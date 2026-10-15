import express from "express";
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

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
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
