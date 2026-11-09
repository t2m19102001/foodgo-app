// Tim mon theo bo loc (tu khoa, gia, danh muc, danh gia toi thieu) - dung
// CHUNG cho ca endpoint AI Search (foodController.aiSearchFood) va cac tool
// cua chatbot (util/chatTools.js), de tranh viet lai cung mot cau SQL o hai
// noi. Luon chi doc du lieu THAT tu bang foods/categories/view food_ratings -
// AI (rule hoac LLM) chi duoc quyet dinh CAC THAM SO loc, khong bao gio
// tu tra ket qua mon an.
import { query } from "./index.js";

export const searchFoods = async ({ keyword, categoryName, minPrice, maxPrice, minRating, limit = 10 } = {}) => {
  const clauses = ["f.is_available = true"];
  const params = [];

  if (keyword) {
    params.push(keyword);
    const idx = params.length;
    // Tim ca ten va mo ta: cau tu nhien nhu "cay" thuong nam trong mo ta
    // mon hon la ten mon.
    clauses.push(
      `(vn_unaccent(f.name) LIKE '%' || vn_unaccent($${idx}) || '%'
        OR vn_unaccent(f.description) LIKE '%' || vn_unaccent($${idx}) || '%')`
    );
  }
  if (categoryName) {
    params.push(categoryName);
    clauses.push(`c.name = $${params.length}`);
  }
  if (minPrice != null) {
    params.push(minPrice);
    clauses.push(`f.price >= $${params.length}`);
  }
  if (maxPrice != null) {
    params.push(maxPrice);
    clauses.push(`f.price <= $${params.length}`);
  }
  if (minRating != null) {
    params.push(minRating);
    clauses.push(`r.avg_rating >= $${params.length}`);
  }

  params.push(Math.min(Number(limit) || 10, 50));
  const limitIdx = params.length;

  const { rows } = await query(
    `SELECT f.id, f.name, f.description, f.price, f.image, f.is_available, f.stock, f.prep_time_minutes,
            c.name AS category_name, r.avg_rating, r.review_count
     FROM foods f
     JOIN categories c ON c.id = f.category_id
     LEFT JOIN food_ratings r ON r.food_id = f.id
     WHERE ${clauses.join(" AND ")}
     ORDER BY f.name
     LIMIT $${limitIdx}`,
    params
  );
  return rows;
};
