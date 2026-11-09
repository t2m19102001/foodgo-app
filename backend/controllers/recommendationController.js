// AI Recommendation (module 4 trong spec) - chi lam 2 khu vuc co DU LIEU
// THAT chong duoc: "Danh rieng cho ban" (lich su mua cua chinh user, fallback
// ve mon pho bien he thong khi chua co lich su) va "Duoc danh gia cao" (view
// food_ratings da co tu migration 001 nhung chua tung duoc dung o API nao).
// "reason" la chuoi dung TU SO LIEU THAT bang template, KHONG goi LLM - tranh
// ton phi/rui ro bia ly do moi lan mo Home. Xem gioi han da cat trong plan:
// khong lam "Nha hang gan ban" (khong multi-restaurant/GPS), khong tao bang
// UserPreferences/RecommendationHistory (chua co tinh nang nao can doc lai).
import { query } from "../db/index.js";
import { mapFood } from "../db/mappers.js";
import logger from "../util/logger.js";

const SECTION_LIMIT = 10;
const MIN_REVIEWS_FOR_TOP_RATED = 2;

// Mon khach da dat NHIEU LAN NHAT (goi y "dat lai mon yeu thich"). JOIN foods
// nen tu dong bo qua mon da bi xoa (food_id null hoac khong con trong bang).
const forYouQuery = (userId) => query(
  `SELECT f.id, f.name, f.description, f.price, f.image, f.is_available, f.stock, f.prep_time_minutes,
          c.name AS category_name, r.avg_rating, r.review_count,
          count(*)::int AS times_ordered
   FROM order_items i
   JOIN orders o ON o.id = i.order_id
   JOIN foods f ON f.id = i.food_id
   JOIN categories c ON c.id = f.category_id
   LEFT JOIN food_ratings r ON r.food_id = f.id
   WHERE o.user_id = $1 AND o.status = 'delivered' AND f.is_available
   GROUP BY f.id, f.name, f.description, f.price, f.image, f.is_available, f.stock,
            f.prep_time_minutes, c.name, r.avg_rating, r.review_count
   ORDER BY times_ordered DESC, f.name
   LIMIT $2`,
  [userId, SECTION_LIMIT]
);

// Mon ban nhieu nhat TOAN HE THONG - dung lam fallback cho user chua co lich
// su, va cung la noi dung cua khu vuc "pho bien" khi can.
const popularQuery = () => query(
  `SELECT f.id, f.name, f.description, f.price, f.image, f.is_available, f.stock, f.prep_time_minutes,
          c.name AS category_name, r.avg_rating, r.review_count,
          count(*)::int AS times_ordered
   FROM order_items i
   JOIN orders o ON o.id = i.order_id
   JOIN foods f ON f.id = i.food_id
   JOIN categories c ON c.id = f.category_id
   LEFT JOIN food_ratings r ON r.food_id = f.id
   WHERE o.status = 'delivered' AND f.is_available
   GROUP BY f.id, f.name, f.description, f.price, f.image, f.is_available, f.stock,
            f.prep_time_minutes, c.name, r.avg_rating, r.review_count
   ORDER BY times_ordered DESC, f.name
   LIMIT $1`,
  [SECTION_LIMIT]
);

const topRatedQuery = () => query(
  `SELECT f.id, f.name, f.description, f.price, f.image, f.is_available, f.stock, f.prep_time_minutes,
          c.name AS category_name, r.avg_rating, r.review_count
   FROM foods f
   JOIN categories c ON c.id = f.category_id
   JOIN food_ratings r ON r.food_id = f.id
   WHERE f.is_available AND r.review_count >= $1
   ORDER BY r.avg_rating DESC, r.review_count DESC, f.name
   LIMIT $2`,
  [MIN_REVIEWS_FOR_TOP_RATED, SECTION_LIMIT]
);

const toForYouItem = (row) => ({
  food: mapFood(row),
  reason: `Bạn đã đặt món này ${row.times_ordered} lần`,
});
const toPopularItem = (row) => ({ food: mapFood(row), reason: "Món phổ biến tại FoodGo" });
const toTopRatedItem = (row) => ({
  food: mapFood(row),
  reason: `${Number(row.avg_rating).toFixed(1)}/5 từ ${row.review_count} lượt đánh giá`,
});

export const getHomeRecommendations = async (req, res) => {
  try {
    const [forYouResult, topRatedResult] = await Promise.all([
      forYouQuery(req.userId),
      topRatedQuery(),
    ]);

    let forYou = forYouResult.rows.map(toForYouItem);
    if (forYou.length === 0) {
      const popularResult = await popularQuery();
      forYou = popularResult.rows.map(toPopularItem);
    }

    res.json({
      success: true,
      forYou,
      topRated: topRatedResult.rows.map(toTopRatedItem),
    });
  } catch (error) {
    logger.error("Get home recommendations error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy gợi ý món ăn" });
  }
};
