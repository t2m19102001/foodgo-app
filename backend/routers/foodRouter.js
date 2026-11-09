import express from "express";
import rateLimit from "express-rate-limit";
import {
  addFood,
  listFood,
  getFoodById,
  getFoodByCategory,
  updateFood,
  removeFood,
  aiSearchFood,
} from "../controllers/foodController.js";
import { adminMiddleware } from "../middleware/auth.js";
import { uploadMiddleware, handleUploadError, validateUploadedImage } from "../middleware/upload.js";

const foodRouter = express.Router();

// AI Search co the goi LLM (khi rule khong khop) nen gioi han de kiem soat
// chi phi, giong tinh than chatMessageLimiter trong chatRouter.js.
const aiSearchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.AI_SEARCH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn tìm kiếm quá nhiều lần, vui lòng thử lại sau" },
});

foodRouter.get("/", listFood);
foodRouter.post("/ai-search", aiSearchLimiter, aiSearchFood);
foodRouter.get("/category/:category", getFoodByCategory);
foodRouter.get("/:id", getFoodById);
foodRouter.post("/", adminMiddleware, uploadMiddleware.single("image"), handleUploadError, validateUploadedImage, addFood);
foodRouter.put("/:id", adminMiddleware, uploadMiddleware.single("image"), handleUploadError, validateUploadedImage, updateFood);
foodRouter.delete("/:id", adminMiddleware, removeFood);

export default foodRouter;
