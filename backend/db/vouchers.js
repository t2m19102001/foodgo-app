// Tang truy cap du lieu cho voucher/ma giam gia (xem migration 013).
//
// Nguyen tac giong db/orders.js: khong biet gi ve req/res, khong tra ma HTTP.
// Cac ham dung trong transaction dat hang (lockVoucherByCode, count*,
// insertVoucherRedemption, applyOrderVoucher) nhan `client` BAT BUOC vi phai
// chay trong CUNG transaction voi placeOrder de khoa/dem co hieu luc.
import { query } from "./index.js";

// client tuy chon: cho goi duoc trong transaction dang mo, giong run() cua
// db/orders.js
const run = (client, text, params) => (client ? client.query(text, params) : query(text, params));

// used_count: dem so dong voucher_redemptions - chi can cho man Admin xem
// nhanh, KHONG dung de kiem usage_limit luc dat hang (xem countVoucherRedemptions
// chay TRONG transaction, sau khi da lockVoucherByCode).
const VOUCHER_SELECT = `
  SELECT v.*,
         (SELECT count(*)::int FROM voucher_redemptions r WHERE r.voucher_id = v.id) AS used_count
  FROM vouchers v`;

// ---------------------------------------------------------------- doc (admin)

export const listVouchersAdmin = async ({ limit, skip }) => {
  const [list, count] = await Promise.all([
    query(`${VOUCHER_SELECT} ORDER BY v.created_at DESC, v.id LIMIT $1 OFFSET $2`, [limit, skip]),
    query("SELECT count(*)::int AS total FROM vouchers"),
  ]);
  return { rows: list.rows, total: count.rows[0].total };
};

export const findVoucherById = async (id) => {
  const { rows } = await query(`${VOUCHER_SELECT} WHERE v.id = $1`, [id]);
  return rows[0];
};

// Dung cho preview (khong lock) - code la citext nen khong phan biet hoa/thuong
export const findVoucherByCode = async (code) => {
  const { rows } = await query(`${VOUCHER_SELECT} WHERE v.code = $1`, [code]);
  return rows[0];
};

// --------------------------------------------------------------- ghi (admin)

export const insertVoucher = async (fields) => {
  const { rows } = await query(
    `INSERT INTO vouchers (code, description, discount_type, discount_value, max_discount_amount,
                           min_order_value, usage_limit, usage_limit_per_user, valid_from, valid_until, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [fields.code, fields.description, fields.discountType, fields.discountValue, fields.maxDiscountAmount,
      fields.minOrderValue, fields.usageLimit, fields.usageLimitPerUser, fields.validFrom, fields.validUntil,
      fields.isActive]
  );
  return rows[0].id;
};

export const updateVoucherById = async (id, fields) => {
  const { rowCount } = await query(
    `UPDATE vouchers SET code=$2, description=$3, discount_type=$4, discount_value=$5,
            max_discount_amount=$6, min_order_value=$7, usage_limit=$8, usage_limit_per_user=$9,
            valid_from=$10, valid_until=$11, is_active=$12
     WHERE id = $1`,
    [id, fields.code, fields.description, fields.discountType, fields.discountValue, fields.maxDiscountAmount,
      fields.minOrderValue, fields.usageLimit, fields.usageLimitPerUser, fields.validFrom, fields.validUntil,
      fields.isActive]
  );
  return rowCount > 0;
};

// Co the nem 23503 (FK voucher_redemptions.voucher_id ON DELETE RESTRICT) -
// controller bat va tra 409, giong categoryController.removeCategory.
export const deleteVoucherById = (id) => query("DELETE FROM vouchers WHERE id = $1", [id]);

// ----------------------------------------------- dung trong transaction dat hang

// Khoa dong voucher theo code: MOI giao dich dat hang dung cung ma nay deu
// phai doi o day -> serialize hoa, nen dem-roi-ghi (countVoucherRedemptions +
// insertVoucherRedemption) ben duoi, trong CUNG transaction, la an toan tuyet
// doi truoc race condition - khong can SKIP LOCKED vi o day ta MUON cho, khong
// muon bo qua giao dich dang cho khoa.
export const lockVoucherByCode = async (client, code) => {
  const { rows } = await client.query(
    `SELECT id, code, discount_type, discount_value, max_discount_amount, min_order_value,
            usage_limit, usage_limit_per_user, valid_from, valid_until, is_active
     FROM vouchers WHERE code = $1 FOR UPDATE`,
    [code]
  );
  return rows[0];
};

export const countVoucherRedemptions = async (client, voucherId) => {
  const { rows } = await run(client,
    "SELECT count(*)::int AS n FROM voucher_redemptions WHERE voucher_id = $1", [voucherId]);
  return rows[0].n;
};

export const countVoucherRedemptionsByUser = async (client, voucherId, userId) => {
  const { rows } = await run(client,
    "SELECT count(*)::int AS n FROM voucher_redemptions WHERE voucher_id = $1 AND user_id = $2",
    [voucherId, userId]);
  return rows[0].n;
};

export const insertVoucherRedemption = (client, { voucherId, userId, orderId, discountAmount }) =>
  client.query(
    `INSERT INTO voucher_redemptions (voucher_id, user_id, order_id, discount_amount)
     VALUES ($1, $2, $3, $4)`,
    [voucherId, userId, orderId, discountAmount]
  );

// Ghi discount vao chinh don - dung THAY CHO setOrderAmount (db/orders.js)
// khi don co ap voucher.
export const applyOrderVoucher = (client, orderId, { amount, discountAmount, voucherId }) =>
  client.query(
    "UPDATE orders SET amount = $2, discount_amount = $3, voucher_id = $4 WHERE id = $1",
    [orderId, amount, discountAmount, voucherId]
  );
