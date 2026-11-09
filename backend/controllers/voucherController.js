// Admin CRUD voucher + preview cho khach hang (xem migration 013).
//
// Check THAT (atomic, chong double-use) khong nam o day - no nam trong
// transaction cua orderController.placeOrder (lockVoucherByCode + dem trong
// cung transaction). validateVoucher o day KHONG lock/KHONG ghi gi, chi la
// UX "xem truoc giam bao nhieu" - co the bi stale nhe do race, chap nhan duoc.
import {
  listVouchersAdmin, findVoucherById, findVoucherByCode, insertVoucher, updateVoucherById,
  deleteVoucherById, countVoucherRedemptions, countVoucherRedemptionsByUser,
} from "../db/vouchers.js";
import { mapVoucher } from "../db/mappers.js";
import {
  calcDiscountAmount, validateVoucherConditions, invalidVoucherBusinessRules, invalidVoucherCode,
} from "../util/voucher.js";
import { invalidText, invalidOptionalText, invalidInt, firstProblem } from "../util/validate.js";
import { parseOptionalPagination, resolveLimits, buildMeta } from "../util/pagination.js";
import { isUuid } from "../util/ids.js";
import logger from "../util/logger.js";

// voucherForCalc: chuyen row snake_case -> camelCase truoc khi dua vao ham
// thuan cua util/voucher.js - giu tang DB va tang logic nghiep vu tach biet,
// cung tinh than util/eta.js nhan { prepTimeMinutes } chu khong nhan row tho.
const toVoucherForCalc = (row) => row && {
  discountType: row.discount_type,
  discountValue: row.discount_value,
  maxDiscountAmount: row.max_discount_amount,
  minOrderValue: row.min_order_value,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  isActive: row.is_active,
};

// Gop + validate body dung chung cho create/update. Tra ve { problem } hoac
// { fields } (chua bao gio ca hai).
const parseVoucherBody = (body) => {
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const discountValue = Number(body?.discountValue);
  const minOrderValue = body?.minOrderValue === undefined ? 0 : Number(body.minOrderValue);
  const maxDiscountAmount = body?.maxDiscountAmount === undefined || body.maxDiscountAmount === null
    ? null : Number(body.maxDiscountAmount);
  const usageLimit = body?.usageLimit === undefined || body.usageLimit === null
    ? null : Number(body.usageLimit);
  const usageLimitPerUser = body?.usageLimitPerUser === undefined || body.usageLimitPerUser === null
    ? null : Number(body.usageLimitPerUser);

  const problem = firstProblem(
    invalidVoucherCode(code),
    invalidOptionalText(body?.description, { label: "Mô tả", max: 500 }),
    invalidInt(discountValue, { label: "Giá trị giảm", min: 1, max: 100_000_000 }),
    invalidInt(minOrderValue, { label: "Đơn hàng tối thiểu", min: 0, max: 100_000_000 }),
  ) || invalidVoucherBusinessRules({
    discountType: body?.discountType,
    discountValue,
    maxDiscountAmount,
    validFrom: body?.validFrom,
    validUntil: body?.validUntil,
  });
  if (problem) return { problem };

  return {
    fields: {
      code,
      description: body?.description || "",
      discountType: body.discountType,
      discountValue,
      maxDiscountAmount,
      minOrderValue,
      usageLimit,
      usageLimitPerUser,
      validFrom: body?.validFrom || null,
      validUntil: body?.validUntil || null,
      isActive: body?.isActive !== false,
    },
  };
};

// ================================================================== Admin CRUD

export const listVouchers = async (req, res) => {
  try {
    const pagination = parseOptionalPagination(req.query);
    if (pagination.invalid) {
      return res.status(400).json({ success: false, message: "Tham số phân trang không hợp lệ" });
    }
    const { limit, skip } = resolveLimits(pagination);
    const { rows, total } = await listVouchersAdmin({ limit, skip });

    res.json({
      success: true,
      vouchers: rows.map(mapVoucher),
      pagination: buildMeta(total, pagination, limit),
    });
  } catch (error) {
    logger.error("List vouchers error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách mã giảm giá" });
  }
};

export const getVoucherDetail = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã không hợp lệ" });
    }
    const row = await findVoucherById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá" });
    res.json({ success: true, voucher: mapVoucher(row) });
  } catch (error) {
    logger.error("Get voucher detail error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông tin mã giảm giá" });
  }
};

export const addVoucher = async (req, res) => {
  try {
    const { problem, fields } = parseVoucherBody(req.body);
    if (problem) return res.status(400).json({ success: false, message: problem });

    const id = await insertVoucher(fields);
    res.status(201).json({
      success: true,
      message: "Thêm mã giảm giá thành công",
      voucher: mapVoucher(await findVoucherById(id)),
    });
  } catch (error) {
    // 23505 = unique_violation (code da ton tai)
    if (error.code === "23505") {
      return res.status(400).json({ success: false, message: "Mã giảm giá đã tồn tại" });
    }
    logger.error("Add voucher error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm mã giảm giá" });
  }
};

export const updateVoucher = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã không hợp lệ" });
    }
    const { problem, fields } = parseVoucherBody(req.body);
    if (problem) return res.status(400).json({ success: false, message: problem });

    const updated = await updateVoucherById(req.params.id, fields);
    if (!updated) return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá" });

    res.json({
      success: true,
      message: "Cập nhật mã giảm giá thành công",
      voucher: mapVoucher(await findVoucherById(req.params.id)),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ success: false, message: "Mã giảm giá đã tồn tại" });
    }
    logger.error("Update voucher error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật mã giảm giá" });
  }
};

export const removeVoucher = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã không hợp lệ" });
    }
    const existing = await findVoucherById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá" });

    try {
      await deleteVoucherById(req.params.id);
    } catch (error) {
      // 23503 = foreign_key_violation: voucher_redemptions.voucher_id la
      // ON DELETE RESTRICT, nen chinh DB chan - khong phai mot cau kiem tra
      // co the bi race.
      if (error.code === "23503") {
        return res.status(409).json({
          success: false,
          message: "Không thể xóa mã đã được sử dụng, hãy khóa (vô hiệu hóa) thay vì xóa",
        });
      }
      throw error;
    }

    res.json({ success: true, message: "Đã xóa mã giảm giá" });
  } catch (error) {
    logger.error("Remove voucher error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa mã giảm giá" });
  }
};

// ============================================== Khach hang: validate & preview

export const validateVoucher = async (req, res) => {
  try {
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const orderAmount = Number(req.body?.orderAmount);
    const problem = firstProblem(
      invalidText(code, { label: "Mã giảm giá", max: 50 }),
      invalidInt(orderAmount, { label: "Tổng tiền", min: 0, max: 100_000_000 }),
    );
    if (problem) return res.status(400).json({ success: false, message: problem });

    const row = await findVoucherByCode(code);
    const voucherForCalc = toVoucherForCalc(row);
    const conditionProblem = validateVoucherConditions(voucherForCalc, orderAmount);
    if (conditionProblem) return res.status(400).json({ success: false, message: conditionProblem });

    const totalUsed = await countVoucherRedemptions(undefined, row.id);
    if (row.usage_limit != null && totalUsed >= row.usage_limit) {
      return res.status(400).json({ success: false, message: "Mã giảm giá đã hết lượt sử dụng" });
    }
    const usedByUser = await countVoucherRedemptionsByUser(undefined, row.id, req.userId);
    if (row.usage_limit_per_user != null && usedByUser >= row.usage_limit_per_user) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã dùng hết số lần được phép áp dụng mã này",
      });
    }

    const discountAmount = calcDiscountAmount(voucherForCalc, orderAmount);
    res.json({
      success: true,
      message: "Áp dụng mã giảm giá thành công",
      discountAmount,
      finalAmount: orderAmount - discountAmount,
    });
  } catch (error) {
    logger.error("Validate voucher error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi kiểm tra mã giảm giá" });
  }
};
