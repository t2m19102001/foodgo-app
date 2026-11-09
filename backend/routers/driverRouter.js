import express from "express";
import rateLimit from "express-rate-limit";
import { getMyDeliveries, updateMyLocation } from "../controllers/driverController.js";
import { driverMiddleware } from "../middleware/auth.js";

const driverRouter = express.Router();

// Foreground-only, moi 10s theo thiet ke Android (xem plan) - gioi han cao
// hon han, chi de chan loi vong lap/bug client, khong phai chong lam dung
const updateLocationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Cập nhật vị trí quá thường xuyên" },
});

driverRouter.get("/orders", driverMiddleware, getMyDeliveries);
driverRouter.put("/location", updateLocationLimiter, driverMiddleware, updateMyLocation);

export default driverRouter;
