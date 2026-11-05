import { query } from "../db/index.js";
import { mapReview } from "../db/mappers.js";
import { badRequest } from "../util/httpError.js";
import { invalidUuid, invalidOptionalText, invalidInt, firstProblem } from "../util/validate.js";
import logger from "../util/logger.js";

// Gom o mot cho de bon endpoint duoi day khong con moi cho mot cach kiem khac
const invalidRating = (rating) =>
  invalidInt(rating, { min: 1, max: 5, message: "Số sao phải từ 1 đến 5" });
const invalidComment = (comment) =>
  invalidOptionalText(comment, { label: "Nhận xét", max: 500 });

const REVIEW_SELECT = `
  SELECT r.id, r.user_id, r.food_id, r.rating, r.comment, r.created_at, r.updated_at,
         u.name AS user_name, u.image AS user_image
  FROM reviews r JOIN users u ON u.id = r.user_id`;

export const addReview = async (req, res) => {
  try {
    const { foodId, rating, comment } = req.body;

    if (!foodId || !rating) {
      return badRequest(res, "Thiếu thông tin đánh giá");
    }
    const problem = firstProblem(
      invalidUuid(foodId, "Món ăn"),
      invalidRating(rating),
      invalidComment(comment),
    );
    if (problem) return badRequest(res, problem);

    // Chi cho danh gia mon da thuc su nhan duoc trong mot don da giao. Dieu kien
    // user_id nam ngay trong query nen khong the xem/danh gia nho don nguoi khac.
    const delivered = await query(
      `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = $1 AND o.status = 'delivered' AND i.food_id = $2
       LIMIT 1`,
      [req.userId, foodId]
    );
    if (delivered.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: "Bạn chỉ có thể đánh giá món đã nhận từ đơn hàng đã giao",
      });
    }

    // UNIQUE (user_id, food_id) chan danh gia trung ngay o DB
    const inserted = await query(
      `INSERT INTO reviews (user_id, food_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, food_id) DO NOTHING
       RETURNING id`,
      [req.userId, foodId, Number(rating), comment || ""]
    );
    if (inserted.rowCount === 0) {
      return badRequest(res, "Bạn đã đánh giá món này rồi");
    }

    const { rows } = await query(`${REVIEW_SELECT} WHERE r.id = $1`, [inserted.rows[0].id]);
    res.status(201).json({
      success: true,
      message: "Đánh giá thành công",
      review: mapReview(rows[0]),
    });
  } catch (error) {
    logger.error("Add review error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm đánh giá" });
  }
};

export const getFoodReviews = async (req, res) => {
  try {
    const problem = invalidUuid(req.params.foodId, "Món ăn");
    if (problem) return badRequest(res, problem);
    // Co LIMIT: ban Mongo tra ve toan bo review cua mot mon khong gioi han, mot
    // mon nhieu danh gia la mot response rat lon.
    const { rows } = await query(
      `${REVIEW_SELECT} WHERE r.food_id = $1 ORDER BY r.created_at DESC LIMIT 200`,
      [req.params.foodId]
    );
    res.json({ success: true, reviews: rows.map(mapReview) });
  } catch (error) {
    logger.error("Get food reviews error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy đánh giá" });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    // Khac addReview: ca rating va comment deu TUY CHON o day - COALESCE ben
    // duoi giu lai gia tri cu cho truong khong gui len.
    const problem = firstProblem(
      invalidUuid(req.params.id, "Mã đánh giá"),
      rating === undefined ? null : invalidRating(rating),
      invalidComment(comment),
    );
    if (problem) return badRequest(res, problem);

    const owner = await query("SELECT user_id FROM reviews WHERE id = $1", [req.params.id]);
    if (owner.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
    }
    if (owner.rows[0].user_id !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền sửa đánh giá này" });
    }

    const updated = await query(
      `UPDATE reviews SET
         rating  = COALESCE($2, rating),
         comment = COALESCE($3, comment)
       WHERE id = $1 RETURNING id`,
      [
        req.params.id,
        rating === undefined ? null : Number(rating),
        comment === undefined ? null : comment,
      ]
    );

    const { rows } = await query(`${REVIEW_SELECT} WHERE r.id = $1`, [updated.rows[0].id]);
    res.json({
      success: true,
      message: "Cập nhật đánh giá thành công",
      review: mapReview(rows[0]),
    });
  } catch (error) {
    logger.error("Update review error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật đánh giá" });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const problem = invalidUuid(req.params.id, "Mã đánh giá");
    if (problem) return badRequest(res, problem);

    const owner = await query("SELECT user_id FROM reviews WHERE id = $1", [req.params.id]);
    if (owner.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
    }
    if (owner.rows[0].user_id !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền xóa đánh giá này" });
    }

    await query("DELETE FROM reviews WHERE id = $1", [req.params.id]);
    res.json({ success: true, message: "Xóa đánh giá thành công" });
  } catch (error) {
    logger.error("Delete review error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa đánh giá" });
  }
};
