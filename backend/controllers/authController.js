import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import { randomUUID, randomInt, createHash } from "node:crypto";
import { query, withTransaction } from "../db/index.js";
import { HttpError, sendHttpError } from "../util/httpError.js";
import { mapUser } from "../db/mappers.js";
import { deleteImageSafe } from "../util/uploadFile.js";
import { listDriverUsers } from "../db/orders.js";
import { isUuid } from "../util/ids.js";
import logger from "../util/logger.js";
import { sendPasswordResetEmail } from "../util/mailer.js";

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
       RETURNING id, name, is_admin, is_driver, token_version`,
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
      isDriver: user.is_driver,
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
      `SELECT id, name, password, image, is_admin, is_driver, is_active, token_version
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
      isDriver: user.is_driver,
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
      `SELECT id, name, email, phone, address, image, is_admin, is_driver, is_active,
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
       RETURNING id, name, email, phone, address, image, is_admin, is_driver, is_active,
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

// Xoa tai khoan (yeu cau cua Google Play / App Store voi app cho tao tai khoan).
//
// Don hang phai giu lai de doi soat va ke toan (orders.user_id la ON DELETE
// RESTRICT), nen "xoa" o day la AN DANH HOA trong mot transaction:
//   - xoa dia chi, thong bao, danh gia; xoa thong tin giao hang trong don cu
//   - huy cac don VNPay dang cho thanh toan va hoan kho
//   - dong users con lai khong con du lieu ca nhan, email doi thanh dia chi
//     gia nen email cu dang ky lai duoc, token cu het hieu luc ngay
// Tu choi khi con don dang giao hoac con tien cho hoan: khach can nhan hang /
// nhan tien truoc, sau khi xoa thi khong con kenh nao lien he duoc ho.
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu để xác nhận" });
    }

    // Hash ngau nhien thay cho mat khau cu: khong ai biet chuoi goc, va van la
    // mot bcrypt hash hop le nen bcrypt.compare khong nem loi.
    const unusableHash = await bcrypt.hash(randomUUID(), 10);

    const oldImage = await withTransaction(async (client) => {
      const { rows } = await client.query(
        "SELECT password, image FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
        [req.userId]
      );
      const user = rows[0];
      if (!user) throw new HttpError(404, "Không tìm thấy người dùng");
      if (!(await bcrypt.compare(password, user.password))) {
        throw new HttpError(400, "Mật khẩu không chính xác");
      }

      // Don dang xu ly that (COD, hoac VNPay/ZaloPay da tra tien) va don cho hoan tien
      const blocking = await client.query(
        `SELECT count(*)::int AS n FROM orders
         WHERE user_id = $1
           AND ((status IN ('pending', 'confirmed', 'shipped')
                 AND (payment_method NOT IN ('vnpay', 'zalopay') OR payment_status = 'paid'))
                OR (refund_required AND payment_status <> 'refunded'))`,
        [req.userId]
      );
      if (blocking.rows[0].n > 0) {
        throw new HttpError(409,
          "Bạn còn đơn hàng đang xử lý hoặc khoản tiền chờ hoàn. Vui lòng đợi hoàn tất rồi xóa tài khoản.");
      }

      // Don VNPay/ZaloPay chua thanh toan: huy va tra lai ton kho. Gop so luong
      // theo mon truoc khi cong: UPDATE ... FROM chi cap nhat moi dong foods
      // MOT lan du khop nhieu dong order_items.
      const abandoned = await client.query(
        `UPDATE orders SET status = 'cancelled', cancel_reason = 'Tài khoản đã bị xóa'
         WHERE user_id = $1 AND payment_method IN ('vnpay', 'zalopay') AND status = 'pending'
           AND payment_status <> 'paid'
         RETURNING id`,
        [req.userId]
      );
      const abandonedIds = abandoned.rows.map((row) => row.id);
      if (abandonedIds.length > 0) {
        await client.query(
          `UPDATE foods f SET stock = f.stock + i.quantity
           FROM (SELECT food_id, sum(quantity)::int AS quantity FROM order_items
                 WHERE order_id = ANY($1::uuid[]) GROUP BY food_id) i
           WHERE f.id = i.food_id AND f.track_stock`,
          [abandonedIds]
        );
        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_role, changed_by, note)
           SELECT id, 'pending', 'cancelled', 'customer', $2, 'Xoa tai khoan'
           FROM unnest($1::uuid[]) AS id`,
          [abandonedIds, req.userId]
        );
      }

      await client.query(
        `UPDATE orders SET ship_full_name = 'Đã xóa', ship_phone = '', ship_address = '', ship_note = ''
         WHERE user_id = $1`,
        [req.userId]
      );
      await client.query("DELETE FROM addresses WHERE user_id = $1", [req.userId]);
      await client.query("DELETE FROM notifications WHERE user_id = $1", [req.userId]);
      await client.query("DELETE FROM reviews WHERE user_id = $1", [req.userId]);
      await client.query(
        `UPDATE users SET
           name = 'Người dùng đã xóa',
           email = 'deleted-' || id::text || '@deleted.invalid',
           password = $2,
           phone = '', address = '', image = '',
           is_active = false, is_admin = false,
           token_version = token_version + 1,
           deleted_at = now()
         WHERE id = $1`,
        [req.userId, unusableHash]
      );
      return user.image;
    });

    // Xoa file anh dai dien sau khi transaction da commit
    if (oldImage) await deleteImageSafe(oldImage);
    res.json({ success: true, message: "Tài khoản của bạn đã được xóa" });
  } catch (error) {
    sendHttpError(res, error, "Lỗi hệ thống khi xóa tài khoản",
      (e) => logger.error("Delete account error:", e));
  }
};

// =============================================== Quen mat khau
//
// Ma OTP 6 so gui qua email, het han 15 phut, dung duoc 1 lan. Khong tiet lo
// email co ton tai hay khong (cung tinh than voi loginUser): luon tra ve cung
// thong bao, chi gui mail THAT khi tai khoan ton tai.
const RESET_CODE_TTL_MINUTES = 15;
const hashResetCode = (code) => createHash("sha256").update(code).digest("hex");
const generateResetCode = () => String(randomInt(0, 1000000)).padStart(6, "0");

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (typeof email !== "string" || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ" });
    }
    const normalizedEmail = email.toLowerCase().trim();

    const { rows } = await query(
      "SELECT id, name FROM users WHERE email = $1 AND deleted_at IS NULL",
      [normalizedEmail]
    );
    const user = rows[0];

    if (user) {
      const code = generateResetCode();
      await query(
        `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
         VALUES ($1, $2, now() + interval '${RESET_CODE_TTL_MINUTES} minutes')`,
        [user.id, hashResetCode(code)]
      );
      try {
        await sendPasswordResetEmail(normalizedEmail, user.name, code);
      } catch (mailError) {
        // Khong tra loi cho client o day - se lo email nao gui that duoc.
        // Loi gui mail duoc ghi log de admin biet SMTP co van de.
        logger.error("Send password reset email error:", mailError.message);
      }
    }

    res.json({
      success: true,
      message: "Nếu email tồn tại trong hệ thống, mã xác nhận đã được gửi tới email của bạn",
    });
  } catch (error) {
    logger.error("Request password reset error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi yêu cầu đặt lại mật khẩu" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (typeof email !== "string" || !validator.isEmail(email)
        || typeof code !== "string" || !/^\d{6}$/.test(code)
        || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Thông tin không hợp lệ" });
    }
    const normalizedEmail = email.toLowerCase().trim();

    await withTransaction(async (client) => {
      const { rows: userRows } = await client.query(
        "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
        [normalizedEmail]
      );
      const user = userRows[0];
      // Thong bao chung cho "khong co tai khoan" va "ma sai/het han" - khong
      // tiet lo email nao da dang ky.
      if (!user) throw new HttpError(400, "Mã xác nhận không đúng hoặc đã hết hạn");

      const { rows: codeRows } = await client.query(
        `SELECT id FROM password_reset_codes
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [user.id, hashResetCode(code)]
      );
      const resetCode = codeRows[0];
      if (!resetCode) throw new HttpError(400, "Mã xác nhận không đúng hoặc đã hết hạn");

      const hashed = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
      // token_version tang len lam moi token da phat truoc do het hieu luc,
      // giong luc doi mat khau binh thuong
      await client.query(
        "UPDATE users SET password = $2, token_version = token_version + 1 WHERE id = $1",
        [user.id, hashed]
      );
      await client.query("UPDATE password_reset_codes SET used_at = now() WHERE id = $1", [resetCode.id]);
    });

    res.json({ success: true, message: "Đặt lại mật khẩu thành công, vui lòng đăng nhập lại" });
  } catch (error) {
    sendHttpError(res, error, "Lỗi hệ thống khi đặt lại mật khẩu",
      (e) => logger.error("Reset password error:", e));
  }
};

// =============================================== Location Sharing (admin)
//
// Khong co luong "dang ky lam tai xe" rieng (ban nhe) - tai xe la 1 user
// THUONG da dang ky, admin "thang cap" bang cach bat is_driver. Dung lai
// endpoint dang ky/dang nhap hien co, khong them luong auth moi.

// Danh sach cho dropdown "Gan tai xe" trong admin (OrderDetailActivity)
export const listDrivers = async (req, res) => {
  try {
    const { rows } = await listDriverUsers();
    res.json({ success: true, drivers: rows.map((row) => ({ _id: row.id, name: row.name, email: row.email })) });
  } catch (error) {
    logger.error("List drivers error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách tài xế" });
  }
};

export const setDriverFlag = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã người dùng không hợp lệ" });
    }
    const { isDriver } = req.body || {};
    if (typeof isDriver !== "boolean") {
      return res.status(400).json({ success: false, message: "Thiếu trường isDriver" });
    }

    const { rows } = await query(
      "UPDATE users SET is_driver = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id, name, is_driver",
      [req.params.id, isDriver]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    res.json({
      success: true,
      message: isDriver ? "Đã cấp quyền tài xế" : "Đã thu hồi quyền tài xế",
      user: { _id: rows[0].id, name: rows[0].name, isDriver: rows[0].is_driver },
    });
  } catch (error) {
    logger.error("Set driver flag error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật quyền tài xế" });
  }
};
