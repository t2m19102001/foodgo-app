import express from "express";
import rateLimit from "express-rate-limit";
import { sendMessage, getHistory } from "../controllers/chatController.js";
import { authMiddleware } from "../middleware/auth.js";

const chatRouter = express.Router();

// Moi tin nhan goi it nhat 1 lan OpenAI (co the 2 lan neu co tool-call) -
// gioi han de kiem soat chi phi API, khac voi cac rate limit khac trong app
// chi de chong spam.
const chatMessageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.CHAT_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Bạn gửi tin nhắn quá nhiều, vui lòng thử lại sau" },
});

chatRouter.post("/message", chatMessageLimiter, authMiddleware, sendMessage);
chatRouter.get("/history", authMiddleware, getHistory);

export default chatRouter;
