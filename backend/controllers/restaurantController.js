// FoodGo chi co 1 "nha hang" (xem project memory) - khong can bang DB cho 1
// ban ghi tinh, dung env la du. Public (khong can dang nhap): ca man hinh
// chua dang nhap van can hien pin nha hang/tinh khoang cach.
export const getRestaurantLocation = (req, res) => {
  const lat = Number(process.env.RESTAURANT_LAT);
  const lng = Number(process.env.RESTAURANT_LNG);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(503).json({
      success: false,
      message: "Vị trí nhà hàng chưa được cấu hình (RESTAURANT_LAT/RESTAURANT_LNG)",
    });
  }
  res.json({
    success: true,
    lat,
    lng,
    name: process.env.RESTAURANT_NAME || "FoodGo",
  });
};
