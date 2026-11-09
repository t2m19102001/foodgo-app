import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

import { connectDB, isDbReady } from "./config/db.js";
import logger from "./util/logger.js";
import authRouter from "./routers/authRouter.js";
import foodRouter from "./routers/foodRouter.js";
import categoryRouter from "./routers/categoryRouter.js";
import orderRouter from "./routers/orderRouter.js";
import reviewRouter from "./routers/reviewRouter.js";
import notificationRouter from "./routers/notificationRouter.js";
import addressRouter from "./routers/addressRouter.js";
import chatRouter from "./routers/chatRouter.js";
import recommendationRouter from "./routers/recommendationRouter.js";
import restaurantRouter from "./routers/restaurantRouter.js";
import driverRouter from "./routers/driverRouter.js";
import voucherRouter from "./routers/voucherRouter.js";
import { expireStaleVnpayOrders } from "./controllers/orderController.js";
import { findPaymentDiscrepancies } from "./util/reconciliation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token ky bang secret rong van tao ra JWT hop le, nen phai chet ngay luc khoi dong thay vi chay tiep
if ((process.env.JWT_SECRET || "").length < 32) {
  logger.error("JWT_SECRET chua duoc dat hoac ngan hon 32 ky tu. Dung server de tranh token bi gia mao.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

// Khong co dong nay thi sau nginx/Render, req.ip la IP cua proxy nen
// express-rate-limit dem chung mot bo dem cho MOI nguoi dung: 10 lan dang nhap
// sai cua mot ke tan cong se khoa dang nhap cua toan bo user. O local khong bao
// gio thay loi nay.
app.set("trust proxy", 1);

app.use(helmet());
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // Query string cua VNPay chua vnp_SecureHash va so tien, khong ghi ra log
    const url = req.path.startsWith("/api/order/vnpay/") ? req.path : req.originalUrl;
    logger.info(`${req.method} ${url} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`);
  });
  next();
});
app.use(express.json());

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
app.use(cors({
  origin(origin, callback) {
    // Khong co header Origin: app Android, curl, Postman — khong phai request tu browser nen CORS khong ap dung
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production"
        && isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
}));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Trang cong khai bat buoc cho Google Play: /privacy (Privacy Policy) va
// /account-deletion (URL yeu cau xoa tai khoan khai bao trong Play Console)
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], index: false }));

await connectDB();

app.use("/api/auth", authRouter);
app.use("/api/food", foodRouter);
app.use("/api/category", categoryRouter);
app.use("/api/order", orderRouter);
app.use("/api/review", reviewRouter);
app.use("/api/notification", notificationRouter);
app.use("/api/address", addressRouter);
app.use("/api/chat", chatRouter);
app.use("/api/recommendations", recommendationRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/driver", driverRouter);
app.use("/api/voucher", voucherRouter);

app.get("/", (req, res) => {
  res.send("Delivery App API Working");
});

app.get("/api/health", async (req, res) => {
  const databaseConnected = await isDbReady();
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    database: databaseConnected ? "connected" : "disconnected",
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Khong co handler nay thi goi sai duong dan tra ve trang HTML "Cannot GET
// /api/xxx", trai voi cam ket "moi phan hoi la JSON {success, message}".
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Không tìm thấy endpoint" });
});

app.use((err, req, res, next) => {
  logger.error("Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Lỗi server nội bộ" });
});

app.listen(port, () => {
  logger.info(`Server is running on http://localhost:${port}`);
});

// Huy don VNPay qua han thanh toan va hoan ton kho. SKIP LOCKED trong
// expireStaleVnpayOrders nen chay nhieu instance cung luc van an toan.
const EXPIRY_INTERVAL_MS = 60 * 1000;
const expiryTimer = setInterval(async () => {
  try {
    const expired = await expireStaleVnpayOrders();
    if (expired > 0) logger.info(`Da huy ${expired} don VNPay het han thanh toan`);
  } catch (error) {
    logger.error("Expire VNPay orders error:", error.message);
  }
}, EXPIRY_INTERVAL_MS);
expiryTimer.unref();

// Doi soat thanh toan dinh ky - thay cho viec phai nho chay "npm run
// reconcile" bang tay (scripts/reconcile-payments.mjs). Chi CANH BAO qua log,
// khong tu sua: moi truong hop (hoan tien, tra hai lan...) can nguoi kiem tra
// tay truoc khi dong tien.
const RECONCILE_INTERVAL_MS = 60 * 60 * 1000; // 1 gio
const reconcileTimer = setInterval(async () => {
  try {
    const { paidButNotRecorded, refundPending, paidTwice } = await findPaymentDiscrepancies();
    const total = paidButNotRecorded.length + refundPending.length + paidTwice.length;
    if (total > 0) {
      logger.warn(
        `Doi soat thanh toan: ${total} muc can kiem tra (chua ghi paid: `
        + `${paidButNotRecorded.length}, cho hoan tien: ${refundPending.length}, `
        + `tra hai lan: ${paidTwice.length}) - chay "npm run reconcile" de xem chi tiet`
      );
    }
  } catch (error) {
    logger.error("Reconcile payments error:", error.message);
  }
}, RECONCILE_INTERVAL_MS);
reconcileTimer.unref();
