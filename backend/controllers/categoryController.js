import { query } from "../db/index.js";
import { mapCategory } from "../db/mappers.js";
import { deleteImageSafe } from "../util/uploadFile.js";
import { buildMeta, parseOptionalPagination, resolveLimits } from "../util/pagination.js";
import { isUuid } from "../util/ids.js";
import logger from "../util/logger.js";

export const addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Vui lòng nhập tên danh mục" });
    }

    const { rows } = await query(
      `INSERT INTO categories (name, image) VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING
       RETURNING id, name, image, created_at, updated_at`,
      [name.trim(), req.file ? req.file.filename : ""]
    );

    if (rows.length === 0) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Danh mục đã tồn tại" });
    }

    res.status(201).json({
      success: true,
      message: "Thêm danh mục thành công",
      category: mapCategory(rows[0]),
    });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    logger.error("Add category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm danh mục" });
  }
};

export const listCategories = async (req, res) => {
  try {
    const pagination = parseOptionalPagination(req.query);
    if (pagination.invalid) {
      return res.status(400).json({ success: false, message: "Tham số phân trang không hợp lệ" });
    }
    const { limit, skip } = resolveLimits(pagination);

    const [list, count] = await Promise.all([
      query(
        `SELECT id, name, image, created_at, updated_at
         FROM categories ORDER BY created_at, id LIMIT $1 OFFSET $2`,
        [limit, skip]
      ),
      query("SELECT count(*)::int AS total FROM categories"),
    ]);

    res.json({
      success: true,
      categories: list.rows.map(mapCategory),
      pagination: buildMeta(count.rows[0].total, pagination, limit),
    });
  } catch (error) {
    logger.error("List categories error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách danh mục" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!isUuid(req.params.id)) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Mã danh mục không hợp lệ" });
    }
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Tên danh mục không hợp lệ" });
    }

    // Doi ten danh muc dang co mon GIO LAM DUOC: foods.category_id la khoa ngoai
    // ON UPDATE CASCADE, nen khong con rang buoc 409 cua ban Mongo (noi
    // foods.category luu TEN nen doi ten la lam mon mo coi).
    const { rows } = await query(
      `UPDATE categories SET
         name  = COALESCE($2, name),
         image = COALESCE($3, image)
       WHERE id = $1
       RETURNING id, name, image, created_at, updated_at,
                 (SELECT image FROM categories WHERE id = $1) AS old_image`,
      [
        req.params.id,
        name === undefined ? null : name.trim(),
        req.file ? req.file.filename : null,
      ]
    );

    if (rows.length === 0) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    }

    const oldImage = rows[0].old_image;
    if (req.file && oldImage && oldImage !== req.file.filename) {
      await deleteImageSafe(oldImage);
    }

    res.json({
      success: true,
      message: "Cập nhật danh mục thành công",
      category: mapCategory(rows[0]),
    });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    // 23505 = unique_violation: doi sang ten da co danh muc khac dung
    if (error.code === "23505") {
      return res.status(400).json({ success: false, message: "Tên danh mục đã tồn tại" });
    }
    logger.error("Update category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật danh mục" });
  }
};

export const removeCategory = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã danh mục không hợp lệ" });
    }

    const { rows } = await query("SELECT id, image FROM categories WHERE id = $1", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    }

    try {
      await query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    } catch (error) {
      // 23503 = foreign_key_violation. foods.category_id la ON DELETE RESTRICT
      // nen chinh DB chan, khong phai mot cau kiem tra co the bi race.
      if (error.code === "23503") {
        return res.status(409).json({ success: false, message: "Không thể xóa danh mục đang có món" });
      }
      throw error;
    }

    await deleteImageSafe(rows[0].image);
    res.json({ success: true, message: "Xóa danh mục thành công" });
  } catch (error) {
    logger.error("Remove category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa danh mục" });
  }
};
