import { query } from "../db/index.js";
import { mapNotification } from "../db/mappers.js";
import { isUuid } from "../util/ids.js";
import logger from "../util/logger.js";

export const getMyNotifications = async (req, res) => {
  try {
    // Co LIMIT: moi lan don doi trang thai lai sinh them mot thong bao, nen ban
    // Mongo (khong limit) cho ra response phinh vo han voi user dung lau.
    const [list, unread] = await Promise.all([
      query(
        `SELECT id, title, message, is_read, created_at
         FROM notifications WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 200`,
        [req.userId]
      ),
      query(
        "SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND NOT is_read",
        [req.userId]
      ),
    ]);

    res.json({
      success: true,
      notifications: list.rows.map(mapNotification),
      unreadCount: unread.rows[0].unread,
    });
  } catch (error) {
    logger.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông báo" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã thông báo không hợp lệ" });
    }
    // user_id nam trong chinh cau UPDATE: thong bao cua nguoi khac tra ve 404
    // chu khong phai 403, va khong co khe nao doc duoc noi dung cua ho.
    const { rowCount } = await query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }
    res.json({ success: true, message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    logger.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật thông báo" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await query(
      "UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read",
      [req.userId]
    );
    res.json({ success: true, message: "Đã đánh dấu tất cả đã đọc" });
  } catch (error) {
    logger.error("Mark all as read error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật thông báo" });
  }
};
