import { query, withTransaction } from "../db/index.js";
import { mapAddress } from "../db/mappers.js";
import { isUuid } from "../util/ids.js";
import { HttpError, sendHttpError } from "../util/httpError.js";
import logger from "../util/logger.js";

const ADDRESS_SELECT = `
  SELECT id, full_name, phone, address, note, is_default, created_at, updated_at
  FROM addresses`;

const validateFields = ({ fullName, phone, address }) => {
  if (![fullName, phone, address].every((value) => typeof value === "string" && value.trim().length > 0)) {
    return "Thiếu thông tin địa chỉ";
  }
  if (fullName.length > 100 || phone.length > 30 || address.length > 300) {
    return "Thông tin địa chỉ quá dài";
  }
  return null;
};

export const getMyAddresses = async (req, res) => {
  try {
    const { rows } = await query(
      `${ADDRESS_SELECT} WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json({ success: true, addresses: rows.map(mapAddress) });
  } catch (error) {
    logger.error("Get my addresses error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách địa chỉ" });
  }
};

export const addAddress = async (req, res) => {
  try {
    const { fullName, phone, address, note } = req.body || {};
    const validationError = validateFields({ fullName, phone, address });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    if ((note || "").length > 500) {
      return res.status(400).json({ success: false, message: "Ghi chú quá dài" });
    }

    const created = await withTransaction(async (client) => {
      // Khoa hang users de tuan tu hoa moi thao tac dia chi cua cung mot user:
      // hai request them dia chi dau tien cung luc khong the cung quyet dinh
      // minh la mac dinh. Ban Mongo dem roi quyet dinh ngoai transaction nen
      // tao ra hai dia chi cung isDefault.
      // (Khong the FOR UPDATE truc tiep tren count() - Postgres khong cho dung
      // FOR UPDATE voi ham tong hop.)
      await client.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [req.userId]);
      const existing = await client.query(
        "SELECT count(*)::int AS total FROM addresses WHERE user_id = $1",
        [req.userId]
      );
      const isFirst = existing.rows[0].total === 0;
      const wantDefault = isFirst || req.body?.isDefault === true;

      if (wantDefault && !isFirst) {
        await client.query(
          "UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default",
          [req.userId]
        );
      }

      const { rows } = await client.query(
        `INSERT INTO addresses (user_id, full_name, phone, address, note, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, full_name, phone, address, note, is_default, created_at, updated_at`,
        [req.userId, fullName.trim(), phone.trim(), address.trim(), note || "", wantDefault]
      );
      return rows[0];
    });

    res.status(201).json({
      success: true,
      message: "Đã lưu địa chỉ",
      address: mapAddress(created),
    });
  } catch (error) {
    logger.error("Add address error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lưu địa chỉ" });
  }
};

export const updateAddress = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã địa chỉ không hợp lệ" });
    }

    const { fullName, phone, address: addressText, note } = req.body || {};

    const owner = await query("SELECT user_id FROM addresses WHERE id = $1", [req.params.id]);
    if (owner.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy địa chỉ" });
    }
    if (owner.rows[0].user_id !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền sửa địa chỉ này" });
    }

    const validationError = validateFields({ fullName, phone, address: addressText });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    if ((note || "").length > 500) {
      return res.status(400).json({ success: false, message: "Ghi chú quá dài" });
    }

    const { rows } = await query(
      `UPDATE addresses SET full_name = $2, phone = $3, address = $4, note = $5
       WHERE id = $1
       RETURNING id, full_name, phone, address, note, is_default, created_at, updated_at`,
      [req.params.id, fullName.trim(), phone.trim(), addressText.trim(), note || ""]
    );

    res.json({
      success: true,
      message: "Cập nhật địa chỉ thành công",
      address: mapAddress(rows[0]),
    });
  } catch (error) {
    logger.error("Update address error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật địa chỉ" });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã địa chỉ không hợp lệ" });
    }

    const result = await withTransaction(async (client) => {
      const owner = await client.query(
        "SELECT user_id FROM addresses WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (owner.rowCount === 0) {
        throw new HttpError(404, "Không tìm thấy địa chỉ");
      }
      if (owner.rows[0].user_id !== req.userId) {
        throw new HttpError(403, "Không có quyền sửa địa chỉ này");
      }

      // Hai lenh ghi nay phai cung transaction: ban Mongo chay roi nhau nen
      // crash giua hai lenh la user khong con dia chi mac dinh nao. Phai go
      // mac dinh cu TRUOC vi index addresses_one_default_per_user la UNIQUE.
      await client.query(
        "UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default AND id <> $2",
        [req.userId, req.params.id]
      );
      const { rows } = await client.query(
        `UPDATE addresses SET is_default = true WHERE id = $1
         RETURNING id, full_name, phone, address, note, is_default, created_at, updated_at`,
        [req.params.id]
      );
      return { address: rows[0] };
    });


    res.json({
      success: true,
      message: "Đã đặt làm địa chỉ mặc định",
      address: mapAddress(result.address),
    });
  } catch (error) {
    sendHttpError(res, error, "Lỗi khi đặt địa chỉ mặc định",
      (e) => logger.error("Set default address error:", e));
  }
};

export const deleteAddress = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã địa chỉ không hợp lệ" });
    }

    const result = await withTransaction(async (client) => {
      const owner = await client.query(
        "SELECT user_id, is_default FROM addresses WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (owner.rowCount === 0) {
        throw new HttpError(404, "Không tìm thấy địa chỉ");
      }
      if (owner.rows[0].user_id !== req.userId) {
        throw new HttpError(403, "Không có quyền xóa địa chỉ này");
      }

      await client.query("DELETE FROM addresses WHERE id = $1", [req.params.id]);

      // Xoa dia chi mac dinh ma van con dia chi khac -> tu dong dua 1 dia chi
      // len lam mac dinh, trong cung transaction nen khong co trang thai trung
      // gian "khong co dia chi mac dinh".
      if (owner.rows[0].is_default) {
        await client.query(
          `UPDATE addresses SET is_default = true
           WHERE id = (SELECT id FROM addresses WHERE user_id = $1
                       ORDER BY created_at DESC LIMIT 1)`,
          [req.userId]
        );
      }
      return {};
    });


    res.json({ success: true, message: "Đã xóa địa chỉ" });
  } catch (error) {
    sendHttpError(res, error, "Lỗi khi xóa địa chỉ",
      (e) => logger.error("Delete address error:", e));
  }
};
