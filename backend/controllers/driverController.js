import { toOrder, listOrdersForDriver, upsertDriverLocation } from "../db/orders.js";
import { badRequest } from "../util/httpError.js";
import logger from "../util/logger.js";

const validLat = (value) => Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90;
const validLng = (value) => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;

// Don dang giao duoc GAN CHO CHINH tai xe dang goi (req.userId, qua
// driverMiddleware) - khong nhan driverId tu client nen khong the xem don
// cua tai xe khac.
export const getMyDeliveries = async (req, res) => {
  try {
    const { rows } = await listOrdersForDriver(req.userId);
    res.json({ success: true, orders: rows.map(toOrder) });
  } catch (error) {
    logger.error("Get my deliveries error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đơn đang giao" });
  }
};

// Chi luu vi tri MOI NHAT cua CHINH tai xe (req.userId) - khong nhan driverId
// tu body, nen khong the gia mao vi tri cho tai xe khac.
export const updateMyLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body || {};
    if (!validLat(lat) || !validLng(lng)) {
      return badRequest(res, "Toạ độ không hợp lệ");
    }
    await upsertDriverLocation(req.userId, Number(lat), Number(lng));
    res.json({ success: true, message: "Đã cập nhật vị trí" });
  } catch (error) {
    logger.error("Update driver location error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật vị trí" });
  }
};
