import express from "express";
import {
  addFood,
  listFood,
  getFoodById,
  getFoodByCategory,
  updateFood,
  removeFood,
} from "../controllers/foodController.js";
import { adminMiddleware } from "../middleware/auth.js";
import { uploadMiddleware, handleUploadError, validateUploadedImage } from "../middleware/upload.js";

const foodRouter = express.Router();

foodRouter.get("/", listFood);
foodRouter.get("/category/:category", getFoodByCategory);
foodRouter.get("/:id", getFoodById);
foodRouter.post("/", adminMiddleware, uploadMiddleware.single("image"), handleUploadError, validateUploadedImage, addFood);
foodRouter.put("/:id", adminMiddleware, uploadMiddleware.single("image"), handleUploadError, validateUploadedImage, updateFood);
foodRouter.delete("/:id", adminMiddleware, removeFood);

export default foodRouter;
