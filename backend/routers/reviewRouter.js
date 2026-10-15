import express from "express";
import {
  addReview,
  getFoodReviews,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { authMiddleware } from "../middleware/auth.js";

const reviewRouter = express.Router();

reviewRouter.get("/food/:foodId", getFoodReviews);
reviewRouter.post("/", authMiddleware, addReview);
reviewRouter.put("/:id", authMiddleware, updateReview);
reviewRouter.delete("/:id", authMiddleware, deleteReview);

export default reviewRouter;
