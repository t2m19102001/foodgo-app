import mongoose from "mongoose";
import reviewModel from "../models/reviewModel.js";
import orderModel from "../models/orderModel.js";

const isValidRating = (rating) => Number.isInteger(Number(rating)) && rating >= 1 && rating <= 5;

export const addReview = async (req, res) => {
  try {
    const { foodId, rating, comment } = req.body;

    if (!foodId || !rating) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin đánh giá" });
    }
    if (!mongoose.isValidObjectId(foodId)) {
      return res.status(400).json({ success: false, message: "Món ăn không hợp lệ" });
    }
    if (!isValidRating(rating)) {
      return res.status(400).json({ success: false, message: "Số sao phải từ 1 đến 5" });
    }

    // Chi cho danh gia mon da thuc su nhan duoc trong mot don da giao
    const deliveredOrder = await orderModel.exists({
      userId: req.userId,
      status: "delivered",
      "items.foodId": foodId,
    });
    if (!deliveredOrder) {
      return res.status(403).json({
        success: false,
        message: "Bạn chỉ có thể đánh giá món đã nhận từ đơn hàng đã giao",
      });
    }

    const existing = await reviewModel.findOne({ userId: req.userId, foodId });
    if (existing) {
      return res.status(400).json({ success: false, message: "Bạn đã đánh giá món này rồi" });
    }

    const review = await reviewModel.create({
      userId: req.userId,
      foodId,
      rating,
      comment: comment || "",
    });

    res.status(201).json({ success: true, message: "Đánh giá thành công", review });
  } catch (error) {
    console.error("Add review error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm đánh giá" });
  }
};

export const getFoodReviews = async (req, res) => {
  try {
    const reviews = await reviewModel
      .find({ foodId: req.params.foodId })
      .populate("userId", "name image")
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    console.error("Get food reviews error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy đánh giá" });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await reviewModel.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
    }
    if (review.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền sửa đánh giá này" });
    }
    if (rating !== undefined && !isValidRating(rating)) {
      return res.status(400).json({ success: false, message: "Số sao phải từ 1 đến 5" });
    }

    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    await review.save();

    res.json({ success: true, message: "Cập nhật đánh giá thành công", review });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật đánh giá" });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const review = await reviewModel.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
    }
    if (review.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền xóa đánh giá này" });
    }

    await reviewModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Xóa đánh giá thành công" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa đánh giá" });
  }
};
