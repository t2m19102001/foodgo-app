// Tang truy cap du lieu cho don hang.
//
// Vi sao co file nay ma KHONG co models/: schema da duoc khai bao mot lan duy
// nhat trong migrations/*.sql (citext unique, partial unique index cho dat hang
// idempotent, GIN trigram, view food_ratings) - mot tang model JS chi lap lai
// nhung khai bao do va luon la ban bi lech. Cai thieu thuc su la cho de DAT
// cau SQL, khong phai cho de khai bao field.
//
// Nguyen tac cua module nay:
//   - Khong biet gi ve req/res. Khong tra ve ma HTTP, khong nem HttpError.
//   - MOI ham nhan `client` tuy chon, de goi duoc BEN TRONG mot transaction
//     dang mo (xem `run`). Ranh gioi transaction va cac lenh khoa (FOR UPDATE)
//     van do controller quyet dinh, nen van nhin thay duoc ngay tai cho xu ly
//     nghiep vu.
//   - Cau SQL giu nguyen van nhu khi con nam trong controller.
import { query } from "./index.js";
import { mapOrder } from "./mappers.js";

// Don VNPay chua thanh toan coi nhu CHUA TON TAI voi nguoi dung: khong hien
// trong "Don hang cua toi", danh sach admin, thong ke, hay duoc tra ve boi
// getOrderByRequestId. Day la cho sua bug "bam Dat hang la da thay don xuat
// hien roi moi den man thanh toan" - server van giu cho don (xem placeOrder)
// nhung client khong duoc biet no ton tai cho den khi thanh toan xong.
//
// Ngoai le: don co refund_required (tien VNPay ve sau khi don da het han/huy)
// PHAI hien - admin can thay de hoan tien, khach can thay don cho hoan.
export const VISIBLE_ORDER_FILTER =
  "(payment_method <> 'vnpay' OR payment_status = 'paid' OR refund_required)";

// client la pg client trong transaction, hoac undefined de dung pool
export const run = (client, text, params) => (client ? client.query(text, params) : query(text, params));

// items lay bang json_agg trong cung mot query - khong bao gio lap vong goi
// query cho tung don (N+1)
export const ORDER_SELECT = `
  SELECT o.*,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'food_id', i.food_id, 'name', i.name, 'price', i.price,
                    'quantity', i.quantity, 'image', i.image) ORDER BY i.id)
           FROM order_items i WHERE i.order_id = o.id
         ), '[]'::json) AS items
  FROM orders o`;

// Thong tin khach nam o field "customer": app Android doc "userId" la chuoi.
const ADMIN_ORDER_SELECT = `
  SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'food_id', i.food_id, 'name', i.name, 'price', i.price,
                    'quantity', i.quantity, 'image', i.image) ORDER BY i.id)
           FROM order_items i WHERE i.order_id = o.id
         ), '[]'::json) AS items
  FROM orders o JOIN users u ON u.id = o.user_id`;

// Row thuan cua Postgres -> JSON dung hinh ma app Android cho doi. Cac ham doc
// ben duoi tra ve ROW THO chu khong goi san ham nay, vi nhieu cho con can
// request_fingerprint / client_request_id / payment_expires_at - nhung cot ma
// mapOrder khong phoi ra.
export const toOrder = (row) => mapOrder(row, row.items || []);

// ------------------------------------------------------------------ doc: 1 don

export const findOrderById = async (orderId, client) => {
  const { rows } = await run(client, `${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  return rows[0];
};

export const findOrderByRequestId = async (userId, clientRequestId, client) => {
  const { rows } = await run(
    client,
    `${ORDER_SELECT} WHERE o.user_id = $1 AND o.client_request_id = $2`,
    [userId, clientRequestId]
  );
  return rows[0];
};

// ---------------------------------------------------------------- doc: danh sach

// Dung chung cho danh sach cua khach va cua admin: cung dieu kien loc, cung
// cach phan trang, chi khac cau SELECT va cot loc dau tien.
const listPage = async ({ select, where, params, limit, skip }) => {
  const [list, count] = await Promise.all([
    query(
      `${select} ${where} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, skip]
    ),
    query(`SELECT count(*)::int AS total FROM orders o ${where}`, params),
  ]);
  return { rows: list.rows, total: count.rows[0].total };
};

export const listOrdersForUser = ({ userId, status, limit, skip }) => {
  const params = [userId];
  let where = `WHERE o.user_id = $1 AND ${VISIBLE_ORDER_FILTER}`;
  if (status) {
    params.push(status);
    where += ` AND o.status = $${params.length}`;
  }
  return listPage({ select: ORDER_SELECT, where, params, limit, skip });
};

export const listOrdersForAdmin = ({ status, limit, skip }) => {
  const params = [];
  let where = `WHERE ${VISIBLE_ORDER_FILTER}`;
  if (status) {
    params.push(status);
    where += ` AND o.status = $${params.length}`;
  }
  return listPage({ select: ADMIN_ORDER_SELECT, where, params, limit, skip });
};

// ----------------------------------------------------------------- doc: thong ke

// Mot query cho toan bo thong ke theo trang thai, thay cho $group tren toan bo
// collection. generate_series dam bao 7 ngay deu co mat ke ca ngay khong co don
// - ban Mongo chi tra ve nhung ngay co du lieu.
export const readOrderStats = async () => {
  const [statusRows, dayRows] = await Promise.all([
    query(
      `SELECT status, count(*)::int AS count, COALESCE(sum(amount), 0)::bigint AS total
       FROM orders WHERE ${VISIBLE_ORDER_FILTER} GROUP BY status`
    ),
    query(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
              COALESCE(sum(o.amount), 0)::bigint AS revenue,
              count(o.id)::int AS count
       FROM generate_series(
              (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - interval '6 days',
              (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
              interval '1 day') AS d(day)
       LEFT JOIN orders o
              ON o.status = 'delivered'
             AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.day
             AND (o.payment_method <> 'vnpay' OR o.payment_status = 'paid')
       GROUP BY d.day ORDER BY d.day`
    ),
  ]);
  return { statusRows: statusRows.rows, dayRows: dayRows.rows };
};

// ------------------------------------------------------------- doc: lan thanh toan

// payUrl con du han de GUI LAI cho khach: tru them 2 phut de khach khong nhan
// duoc mot URL sap het han ngay giua luc dang tra tien.
export const findReusablePayUrl = async (orderId) => {
  const { rows } = await query(
    `SELECT pay_url FROM payment_attempts
     WHERE order_id = $1 AND pay_url <> '' AND expires_at > now() + interval '2 minutes'
     ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  return rows[0]?.pay_url;
};

// payUrl con hieu luc de BAO CAO trang thai cho app (khong co bien 2 phut: day
// chi la thong tin "dang cho thanh toan", khong phai URL vua cap moi)
export const findActivePayUrl = async (orderId) => {
  const { rows } = await query(
    `SELECT pay_url FROM payment_attempts
     WHERE order_id = $1 AND pay_url <> '' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  return rows[0]?.pay_url;
};
