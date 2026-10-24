import jwt from "jsonwebtoken";
import { query } from "../db/index.js";

const getTokenFromHeader = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }
  return req.headers.token || null;
};

export const authMiddleware = async (req, res, next) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({ success: false, message: "Bạn chưa đăng nhập" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Doc is_admin / is_active / token_version tu DB chu khong tin payload token,
    // nen thu quyen admin hoac khoa tai khoan co hieu luc tuc thi.
    const { rows } = await query(
      "SELECT is_active, is_admin, token_version FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: "Người dùng không tồn tại" });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    }
    if ((decoded.tokenVersion || 0) !== (user.token_version || 0)) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập đã hết hiệu lực" });
    }

    req.userId = decoded.id;
    req.user = { id: decoded.id, isAdmin: user.is_admin };
    next();
  } catch (error) {
    // jwt.verify nem loi khi token sai/het han. Loi DB cung roi vao day va cung
    // tra 401 - giu nguyen hanh vi cua ban Mongo.
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: "Yêu cầu quyền Admin" });
  }
  next();
};

// Giu lai ten cu de router khong phai doi: ban Mongo goi long authMiddleware roi
// truyen callback lam next. Gio tach thanh hai middleware chay noi tiep.
export const adminMiddleware = [authMiddleware, requireAdmin];
