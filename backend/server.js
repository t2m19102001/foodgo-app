import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

import { connectDB } from "./config/db.js";
import logger from "./util/logger.js";
import authRouter from "./routers/authRouter.js";
import foodRouter from "./routers/foodRouter.js";
import categoryRouter from "./routers/categoryRouter.js";
import orderRouter from "./routers/orderRouter.js";
import reviewRouter from "./routers/reviewRouter.js";
import notificationRouter from "./routers/notificationRouter.js";
import addressRouter from "./routers/addressRouter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token ky bang secret rong van tao ra JWT hop le, nen phai chet ngay luc khoi dong thay vi chay tiep
if ((process.env.JWT_SECRET || "").length < 32) {
  logger.error("JWT_SECRET chua duoc dat hoac ngan hon 32 ky tu. Dung server de tranh token bi gia mao.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`);
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

await connectDB();

app.use("/api/auth", authRouter);
app.use("/api/food", foodRouter);
app.use("/api/category", categoryRouter);
app.use("/api/order", orderRouter);
app.use("/api/review", reviewRouter);
app.use("/api/notification", notificationRouter);
app.use("/api/address", addressRouter);

app.get("/", (req, res) => {
  res.send("Delivery App API Working");
});

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    database: databaseConnected ? "connected" : "disconnected",
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.use((err, req, res, next) => {
  logger.error("Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Lỗi server nội bộ" });
});

app.listen(port, () => {
  logger.info(`Server is running on http://localhost:${port}`);
});
