import notificationModel from "../models/notificationModel.js";

export const getMyNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      notificationModel.find({ userId: req.userId }).sort({ createdAt: -1 }),
      notificationModel.countDocuments({ userId: req.userId, isRead: false }),
    ]);

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông báo" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notification = await notificationModel.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ success: true, message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật thông báo" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await notificationModel.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
    res.json({ success: true, message: "Đã đánh dấu tất cả đã đọc" });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật thông báo" });
  }
};
