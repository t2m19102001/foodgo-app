import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

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
    const user = await userModel.findById(decoded.id).select("isActive isAdmin tokenVersion");

    if (!user) {
      return res.status(401).json({ success: false, message: "Người dùng không tồn tại" });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    }
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập đã hết hiệu lực" });
    }

    req.userId = decoded.id;
    req.user = { id: decoded.id, isAdmin: user.isAdmin };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

export const adminMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: "Yêu cầu quyền Admin" });
    }
    next();
  });
};
