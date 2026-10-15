import express from "express";
import {
  addCategory,
  listCategories,
  updateCategory,
  removeCategory,
} from "../controllers/categoryController.js";
import { adminMiddleware } from "../middleware/auth.js";
import { uploadMiddleware, handleUploadError, validateUploadedImage } from "../middleware/upload.js";

const categoryRouter = express.Router();

categoryRouter.get("/", listCategories);
categoryRouter.post("/", adminMiddleware, uploadMiddleware.single("image"), handleUploadError, validateUploadedImage, addCategory);
categoryRouter.put("/:id", adminMiddleware, uploadMiddleware.single("image"), handleUploadError, validateUploadedImage, updateCategory);
categoryRouter.delete("/:id", adminMiddleware, removeCategory);

export default categoryRouter;
