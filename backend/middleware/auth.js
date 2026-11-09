import jwt from "jsonwebtoken";
import db from "../db/index.js";
import { isUuid } from "../util/ids.js";
import logger from "../util/logger.js";

const getTokenFromHeader = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }
  return req.headers.token || null;
};

const unauthorized = (res, message) => res.status(401).json({ success: false, message });

export const authMiddleware = async (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return unauthorized(res, "Bạn chưa đăng nhập");
  }

  // Buoc 1: chi loi cua chinh token (sai chu ky, het han, sai dinh dang) moi
  // la 401. App xoa phien dang nhap khi gap 401, nen khong duoc de loi khac
  // roi vao day.
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return unauthorized(res, "Token không hợp lệ hoặc đã hết hạn");
  }
  if (!decoded || !isUuid(decoded.id)) {
    return unauthorized(res, "Token không hợp lệ hoặc đã hết hạn");
  }

  // Buoc 2: doc is_admin / is_active / token_version tu DB chu khong tin
  // payload token, nen thu quyen admin hoac khoa tai khoan co hieu luc tuc thi.
  // Truoc day loi DB (mat ket noi, pool day) cung tra 401 nen moi lan DB chap
  // chon la nguoi dung bi dang xuat. Gio tra 503: app bao loi tam thoi va giu
  // nguyen phien.
  let user;
  try {
    // Goi qua object db (khong import { query }) de test thay duoc ham query
    const { rows } = await db.query(
      "SELECT is_active, is_admin, is_driver, token_version, deleted_at FROM users WHERE id = $1",
      [decoded.id]
    );
    user = rows[0];
  } catch (error) {
    logger.error("Auth DB error:", error.message);
    res.set("Retry-After", "5");
    return res.status(503).json({
      success: false,
      message: "Hệ thống đang bận, vui lòng thử lại sau ít phút",
    });
  }

  if (!user || user.deleted_at) {
    return unauthorized(res, "Người dùng không tồn tại");
  }
  if (!user.is_active) {
    return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
  }
  if ((decoded.tokenVersion || 0) !== (user.token_version || 0)) {
    return unauthorized(res, "Phiên đăng nhập đã hết hiệu lực");
  }

  req.userId = decoded.id;
  req.user = { id: decoded.id, isAdmin: user.is_admin, isDriver: user.is_driver };
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: "Yêu cầu quyền Admin" });
  }
  next();
};

// Location Sharing (ban nhe) - xem migration 011_driver_location.sql
export const requireDriver = (req, res, next) => {
  if (!req.user?.isDriver) {
    return res.status(403).json({ success: false, message: "Yêu cầu quyền tài xế" });
  }
  next();
};

// Giu lai ten cu de router khong phai doi: ban Mongo goi long authMiddleware roi
// truyen callback lam next. Gio tach thanh hai middleware chay noi tiep.
export const adminMiddleware = [authMiddleware, requireAdmin];
export const driverMiddleware = [authMiddleware, requireDriver];
