import express from "express";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";
import { authMiddleware } from "../middleware/auth.js";

const notificationRouter = express.Router();

notificationRouter.get("/", authMiddleware, getMyNotifications);
notificationRouter.put("/read-all", authMiddleware, markAllAsRead);
notificationRouter.put("/:id/read", authMiddleware, markAsRead);

export default notificationRouter;
