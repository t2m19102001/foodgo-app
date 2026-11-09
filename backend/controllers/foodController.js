import { query } from "../db/index.js";
import { mapFood } from "../db/mappers.js";
import { deleteImageSafe } from "../util/uploadFile.js";
import { buildMeta, parseOptionalPagination, resolveLimits } from "../util/pagination.js";
import { isUuid } from "../util/ids.js";
import { parseSearchIntent } from "../util/searchIntent.js";
import { searchFoods } from "../db/foodSearch.js";
import { callOpenAi, extractText } from "../util/openai.js";
import logger from "../util/logger.js";

const validPrice = (price) => price !== null && price !== undefined
  && String(price).trim() !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;

// Gia luu bang bigint (VND, so nguyen) nen phai lam tron, khong nhan so thuc
const toVnd = (price) => Math.round(Number(price));

// 1-180 phut, khop CHECK constraint cua cot foods.prep_time_minutes (migration 006)
const validPrepTime = (value) => Number.isSafeInteger(Number(value))
  && Number(value) > 0 && Number(value) <= 180;

// App doc Food.category la TEN danh muc, nen moi truy van doc deu phai JOIN
const FOOD_SELECT = `
  SELECT f.id, f.name, f.description, f.price, f.image, f.is_available, f.stock,
         f.prep_time_minutes, f.created_at, f.updated_at, c.name AS category_name
  FROM foods f JOIN categories c ON c.id = f.category_id`;

const findCategoryIdByName = async (name) => {
  const { rows } = await query("SELECT id FROM categories WHERE name = $1", [name.trim()]);
  return rows[0]?.id || null;
};

export const addFood = async (req, res) => {
  try {
    const { name, description, price, category, stock, prepTimeMinutes } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng upload ảnh món ăn" });
    }
    if (typeof name !== "string" || !name.trim()
        || typeof category !== "string" || !category.trim()
        || !validPrice(price)) {
      await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }
    if (stock !== undefined && (!Number.isSafeInteger(Number(stock)) || Number(stock) < 0)) {
      await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Số lượng tồn kho không hợp lệ" });
    }
    if (prepTimeMinutes !== undefined && !validPrepTime(prepTimeMinutes)) {
      await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Thời gian chuẩn bị không hợp lệ" });
    }

    const categoryId = await findCategoryIdByName(category);
    if (!categoryId) {
      await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Danh mục không tồn tại" });
    }

    const { rows } = await query(
      `INSERT INTO foods (name, description, price, image, category_id, stock, prep_time_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 15))
       RETURNING id, name, description, price, image, is_available, stock, prep_time_minutes,
                 created_at, updated_at,
                 (SELECT name FROM categories WHERE id = $5) AS category_name`,
      [
        name.trim(),
        (description || "").trim(),
        toVnd(price),
        req.file.filename,
        categoryId,
        stock === undefined ? 0 : Number(stock),
        prepTimeMinutes === undefined ? null : Number(prepTimeMinutes),
      ]
    );

    res.status(201).json({
      success: true,
      message: "Thêm món ăn thành công",
      food: mapFood(rows[0]),
    });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    logger.error("Add food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm món ăn" });
  }
};

// Dung chung cho listFood va getFoodByCategory
const respondFoodList = async (res, where, params, pagination) => {
  const { limit, skip } = resolveLimits(pagination);
  const [list, count] = await Promise.all([
    query(
      `${FOOD_SELECT} ${where} ORDER BY f.created_at, f.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, skip]
    ),
    query(
      `SELECT count(*)::int AS total FROM foods f JOIN categories c ON c.id = f.category_id ${where}`,
      params
    ),
  ]);

  res.json({
    success: true,
    foods: list.rows.map(mapFood),
    pagination: buildMeta(count.rows[0].total, pagination, limit),
  });
};

export const listFood = async (req, res) => {
  try {
    const pagination = parseOptionalPagination(req.query);
    if (pagination.invalid) {
      return res.status(400).json({ success: false, message: "Tham số phân trang không hợp lệ" });
    }

    // Tim kiem phia server - ban Mongo khong co endpoint nay nen app phai loc
    // tren toi da 200 mon tai client, go ten mon thu 201 la khong bao gio ra.
    // vn_unaccent cho phep go khong dau: "pho bo" ra "Phở bò".
    const keyword = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (keyword.length > 100) {
      return res.status(400).json({ success: false, message: "Từ khóa tìm kiếm quá dài" });
    }
    if (keyword) {
      return await respondFoodList(
        res,
        "WHERE vn_unaccent(f.name) LIKE '%' || vn_unaccent($1) || '%'",
        [keyword],
        pagination
      );
    }

    await respondFoodList(res, "", [], pagination);
  } catch (error) {
    logger.error("List food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách món ăn" });
  }
};

export const getFoodById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã món ăn không hợp lệ" });
    }
    const { rows } = await query(`${FOOD_SELECT} WHERE f.id = $1`, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
    }
    res.json({ success: true, food: mapFood(rows[0]) });
  } catch (error) {
    logger.error("Get food by id error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông tin món ăn" });
  }
};

export const getFoodByCategory = async (req, res) => {
  try {
    const pagination = parseOptionalPagination(req.query);
    if (pagination.invalid) {
      return res.status(400).json({ success: false, message: "Tham số phân trang không hợp lệ" });
    }
    await respondFoodList(res, "WHERE c.name = $1", [req.params.category], pagination);
  } catch (error) {
    logger.error("Get food by category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy món ăn theo danh mục" });
  }
};

export const updateFood = async (req, res) => {
  try {
    const { name, description, price, category, isAvailable, stock, prepTimeMinutes } = req.body;

    if (!isUuid(req.params.id)) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Mã món ăn không hợp lệ" });
    }
    if ((name !== undefined && (typeof name !== "string" || !name.trim()))
        || (category !== undefined && (typeof category !== "string" || !category.trim()))
        || (price !== undefined && !validPrice(price))
        || (description !== undefined && typeof description !== "string")
        || (stock !== undefined && (!Number.isSafeInteger(Number(stock)) || Number(stock) < 0))
        || (prepTimeMinutes !== undefined && !validPrepTime(prepTimeMinutes))
        || (isAvailable !== undefined && !["true", "false"].includes(String(isAvailable)))) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Thông tin món ăn không hợp lệ" });
    }

    let categoryId = null;
    if (category !== undefined) {
      categoryId = await findCategoryIdByName(category);
      if (!categoryId) {
        if (req.file) await deleteImageSafe(req.file.filename);
        return res.status(400).json({ success: false, message: "Danh mục không tồn tại" });
      }
    }

    const { rows } = await query(
      `UPDATE foods SET
         name              = COALESCE($2, name),
         description       = COALESCE($3, description),
         price             = COALESCE($4, price),
         image             = COALESCE($5, image),
         category_id       = COALESCE($6, category_id),
         is_available      = COALESCE($7, is_available),
         stock             = COALESCE($8, stock),
         prep_time_minutes = COALESCE($9, prep_time_minutes)
       WHERE id = $1
       RETURNING id, name, description, price, image, is_available, stock, prep_time_minutes,
                 created_at, updated_at,
                 (SELECT name FROM categories WHERE id = foods.category_id) AS category_name,
                 (SELECT image FROM foods WHERE id = $1) AS old_image`,
      [
        req.params.id,
        name === undefined ? null : name.trim(),
        description === undefined ? null : description.trim(),
        price === undefined ? null : toVnd(price),
        req.file ? req.file.filename : null,
        categoryId,
        isAvailable === undefined ? null : String(isAvailable) === "true",
        stock === undefined ? null : Number(stock),
        prepTimeMinutes === undefined ? null : Number(prepTimeMinutes),
      ]
    );

    if (rows.length === 0) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
    }

    const oldImage = rows[0].old_image;
    if (req.file && oldImage && oldImage !== req.file.filename) {
      await deleteImageSafe(oldImage);
    }

    res.json({
      success: true,
      message: "Cập nhật món ăn thành công",
      food: mapFood(rows[0]),
    });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    logger.error("Update food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật món ăn" });
  }
};

export const removeFood = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã món ăn không hợp lệ" });
    }
    // reviews.food_id la ON DELETE CASCADE nen review cua mon bi xoa theo, khong
    // con mo coi nhu ban Mongo. order_items.food_id la ON DELETE SET NULL nen
    // don cu van giu snapshot ten/gia/anh.
    const { rows } = await query(
      "DELETE FROM foods WHERE id = $1 RETURNING image", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
    }

    await deleteImageSafe(rows[0].image);
    res.json({ success: true, message: "Xóa món ăn thành công" });
  } catch (error) {
    logger.error("Remove food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa món ăn" });
  }
};

// ======================================================= AI Search (module 4)
//
// Rule-based TRUOC (parseSearchIntent, mien phi, tuc thi). Chi goi LLM khi
// rule bao needsLlmFallback - va LLM CHI duoc quyet dinh THAM SO loc (JSON),
// khong bao gio tu tra ve mon an: cau SQL that (searchFoods) luon la nguon du
// lieu cuoi cung, nen khong the "bia" ket qua du LLM noi gi.
const MAX_QUERY_LENGTH = 200;

const buildExtractionPrompt = (text, categoryNames) => `Trích xuất bộ lọc tìm kiếm món ăn từ câu sau. Chỉ trả về DUY NHẤT một JSON object, không giải thích gì thêm, đúng khung:
{"keyword": string hoặc null, "minPrice": number hoặc null, "maxPrice": number hoặc null, "categoryName": string hoặc null, "minRating": number hoặc null}

Câu của khách: "${text}"

categoryName chỉ được là một trong các giá trị sau (hoặc null nếu không khớp): ${categoryNames.join(", ")}.
Giá tính bằng VND. Nếu không chắc một trường, để null.`;

// Loi LLM (het quota, mang, JSON khong doc duoc...) -> quay ve ket qua
// rule-based da co san, KHONG lam hong ca request tim kiem.
const refineWithLlm = async (text, categoryNames, fallbackIntent) => {
  try {
    const response = await callOpenAi({
      messages: [{ role: "user", content: buildExtractionPrompt(text, categoryNames) }],
    });
    const match = extractText(response).match(/\{[\s\S]*\}/);
    if (!match) return fallbackIntent;
    const parsed = JSON.parse(match[0]);

    // QUAN TRONG: field = null (LLM CHU DONG noi "khong can loc theo tieu
    // chi nay") phai duoc TON TRONG, khac voi field bi THIEU hoan toan (JSON
    // khong day du) moi quay ve doan rule-based da doan truoc do. Gop chung
    // hai truong hop (vd dung `?? fallback`) se lam "keyword: null" bi hieu
    // nham thanh "giu lai keyword rule" - chinh la nguyen nhan AI Search tra
    // rong du LLM da noi dung la khong can loc keyword.
    const pick = (key, isValid) => (key in parsed
      ? (isValid(parsed[key]) ? parsed[key] : undefined)
      : fallbackIntent[key]);

    return {
      keyword: pick("keyword", (v) => typeof v === "string" && v.trim().length > 0),
      minPrice: pick("minPrice", Number.isFinite),
      maxPrice: pick("maxPrice", Number.isFinite),
      categoryName: pick("categoryName", (v) => categoryNames.includes(v)),
      minRating: pick("minRating", Number.isFinite),
      unsupported: fallbackIntent.unsupported,
    };
  } catch (error) {
    logger.error("AI search refine error:", error.message);
    return fallbackIntent;
  }
};

export const aiSearchFood = async (req, res) => {
  try {
    const { q } = req.body || {};
    if (typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ success: false, message: "Thiếu câu tìm kiếm" });
    }
    if (q.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({ success: false, message: "Câu tìm kiếm quá dài" });
    }

    const { rows: categoryRows } = await query("SELECT name FROM categories ORDER BY name");
    const categoryNames = categoryRows.map((row) => row.name);

    let intent = parseSearchIntent(q, categoryNames);
    if (intent.needsLlmFallback) {
      intent = await refineWithLlm(q, categoryNames, intent);
    }

    const foods = await searchFoods({
      keyword: intent.keyword,
      categoryName: intent.categoryName,
      minPrice: intent.minPrice,
      maxPrice: intent.maxPrice,
      minRating: intent.minRating,
      limit: 20,
    });

    res.json({
      success: true,
      foods: foods.map(mapFood),
      unsupported: intent.unsupported || [],
    });
  } catch (error) {
    logger.error("AI search food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi tìm kiếm bằng AI" });
  }
};
