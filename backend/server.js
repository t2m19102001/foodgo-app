import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

import { connectDB } from "./config/db.js";
import authRouter from "./routers/authRouter.js";
import foodRouter from "./routers/foodRouter.js";
import categoryRouter from "./routers/categoryRouter.js";
import orderRouter from "./routers/orderRouter.js";
import reviewRouter from "./routers/reviewRouter.js";
import notificationRouter from "./routers/notificationRouter.js";
import addressRouter from "./routers/addressRouter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)
        || (process.env.NODE_ENV !== "production" && allowedOrigins.length === 0)) {
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

app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Lỗi server nội bộ" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
