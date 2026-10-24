import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import { query } from "../db/index.js";
import { mapUser } from "../db/mappers.js";
import { deleteImageSafe } from "../util/uploadFile.js";
import logger from "../util/logger.js";

const createToken = (id, isAdmin = false, tokenVersion = 0) => {
  return jwt.sign({ id, isAdmin, tokenVersion }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }
    if (typeof email !== "string" || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu tối thiểu 6 ký tự" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // email la citext UNIQUE, nen de DB tu chan trung thay vi doc-roi-ghi (co
    // khe cua race giua hai request dang ky cung email).
    const { rows } = await query(
      `INSERT INTO users (name, email, password, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, is_admin, token_version`,
      [String(name).trim(), email.toLowerCase().trim(), hashedPassword, phone || ""]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "Email đã được sử dụng" });
    }

    const user = rows[0];
    const token = createToken(user.id, user.is_admin, user.token_version);

    res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      token,
      userId: user.id,
      name: user.name,
      isAdmin: user.is_admin,
    });
  } catch (error) {
    logger.error("Register error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi đăng ký" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập email và mật khẩu" });
    }

    const { rows } = await query(
      `SELECT id, name, password, image, is_admin, is_active, token_version
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];

    // Khong tiet lo email co ton tai hay khong, va luon chay bcrypt.compare mot
    // lan de thoi gian phan hoi khong khac nhau giua "email sai" va "mat khau
    // sai". Ban Mongo tra hai thong bao khac nhau va return truoc khi compare,
    // nen vua liet ke duoc tai khoan vua con timing oracle.
    const DUMMY_HASH = "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const isMatch = await bcrypt.compare(password, user?.password || DUMMY_HASH);

    if (!user || !isMatch) {
      return res.status(401).json({ success: false, message: "Email hoặc mật khẩu không đúng" });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    }

    const token = createToken(user.id, user.is_admin, user.token_version);

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      userId: user.id,
      isAdmin: user.is_admin,
      name: user.name,
      image: user.image || "",
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi đăng nhập" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, phone, address, image, is_admin, is_active,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.json({ success: true, user: mapUser(rows[0]) });
  } catch (error) {
    logger.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi tải thông tin cá nhân" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    // COALESCE($n, cot): tham so null nghia la "khong doi", nen moi field deu
    // optional ma chi can mot cau UPDATE.
    const { rows } = await query(
      `UPDATE users SET
         name    = COALESCE($2, name),
         phone   = COALESCE($3, phone),
         address = COALESCE($4, address),
         image   = COALESCE($5, image)
       WHERE id = $1
       RETURNING id, name, email, phone, address, image, is_admin, is_active,
                 created_at, updated_at,
                 (SELECT image FROM users WHERE id = $1) AS old_image`,
      [
        req.userId,
        name === undefined ? null : String(name).trim(),
        phone === undefined ? null : phone,
        address === undefined ? null : address,
        req.file ? req.file.filename : null,
      ]
    );

    if (rows.length === 0) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const oldImage = rows[0].old_image;
    if (req.file && oldImage && oldImage !== req.file.filename) {
      await deleteImageSafe(oldImage);
    }

    res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      user: mapUser(rows[0]),
    });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    logger.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật thông tin" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (typeof oldPassword !== "string" || typeof newPassword !== "string"
        || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới tối thiểu 6 ký tự" });
    }

    const { rows } = await query("SELECT password FROM users WHERE id = $1", [req.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Mật khẩu cũ không chính xác" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    // token_version tang len lam moi token da phat truoc do het hieu luc
    await query(
      "UPDATE users SET password = $2, token_version = token_version + 1 WHERE id = $1",
      [req.userId, hashed]
    );

    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error) {
    logger.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi đổi mật khẩu" });
  }
};
