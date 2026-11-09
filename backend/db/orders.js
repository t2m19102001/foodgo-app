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
import logger from "../util/logger.js";

// Don VNPay chua thanh toan coi nhu CHUA TON TAI voi nguoi dung: khong hien
// trong "Don hang cua toi", danh sach admin, thong ke, hay duoc tra ve boi
// getOrderByRequestId. Day la cho sua bug "bam Dat hang la da thay don xuat
// hien roi moi den man thanh toan" - server van giu cho don (xem placeOrder)
// nhung client khong duoc biet no ton tai cho den khi thanh toan xong.
//
// Ngoai le: don co refund_required (tien VNPay ve sau khi don da het han/huy)
// PHAI hien - admin can thay de hoan tien, khach can thay don cho hoan.
// Moi payment_method can "giu cho" truoc khi thanh toan xong (vnpay, zalopay)
// phai liet ke o day - KHONG dung "<> 'vnpay'" (truoc day chi loai vnpay nen
// zalopay vo tinh roi vao nhanh "luon hien", lo don chua tra tien - da bat
// qua test zalopay.db.test.js, khong phai suy doan).
export const VISIBLE_ORDER_FILTER =
  "(payment_method NOT IN ('vnpay', 'zalopay') OR payment_status = 'paid' OR refund_required)";

// client la pg client trong transaction, hoac undefined de dung pool
export const run = (client, text, params) => (client ? client.query(text, params) : query(text, params));

// Cot cua delivery_estimates (xem migration 006), alias thanh "eta_*" vi
// "o.*" da chiem het ten cot cua orders va delivery_estimates cung co
// created_at/updated_at - khong alias se de ghi de nham cot.
const ETA_SELECT = `
         de.prep_base_minutes        AS eta_prep_base_minutes,
         de.confirm_minutes          AS eta_confirm_minutes,
         de.prep_minutes             AS eta_prep_minutes,
         de.delivery_minutes         AS eta_delivery_minutes,
         de.total_minutes            AS eta_total_minutes,
         de.estimated_ready_at       AS eta_estimated_ready_at,
         de.estimated_delivered_at   AS eta_estimated_delivered_at,
         de.actual_confirmed_at      AS eta_actual_confirmed_at,
         de.actual_shipped_at        AS eta_actual_shipped_at,
         de.actual_delivered_at      AS eta_actual_delivered_at`;

// Vi tri tai xe (migration 011) - chi co nghia khi don dang 'shipped', nhung
// join vo dieu kien cho moi trang thai: mapOrder() (xem db/mappers.js) la
// noi quyet dinh an/hien theo status, khong loc o day de giu SQL don gian.
const DRIVER_LOCATION_SELECT = `
         dl.lat                      AS driver_lat,
         dl.lng                      AS driver_lng,
         dl.updated_at               AS driver_location_updated_at`;

// items lay bang json_agg trong cung mot query - khong bao gio lap vong goi
// query cho tung don (N+1)
export const ORDER_SELECT = `
  SELECT o.*,
${ETA_SELECT},
${DRIVER_LOCATION_SELECT},
         COALESCE((
           SELECT json_agg(json_build_object(
                    'food_id', i.food_id, 'name', i.name, 'price', i.price,
                    'quantity', i.quantity, 'image', i.image) ORDER BY i.id)
           FROM order_items i WHERE i.order_id = o.id
         ), '[]'::json) AS items
  FROM orders o
  LEFT JOIN delivery_estimates de ON de.order_id = o.id
  LEFT JOIN driver_locations dl ON dl.driver_id = o.driver_id`;

// Thong tin khach nam o field "customer": app Android doc "userId" la chuoi.
const ADMIN_ORDER_SELECT = `
  SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
${ETA_SELECT},
${DRIVER_LOCATION_SELECT},
         COALESCE((
           SELECT json_agg(json_build_object(
                    'food_id', i.food_id, 'name', i.name, 'price', i.price,
                    'quantity', i.quantity, 'image', i.image) ORDER BY i.id)
           FROM order_items i WHERE i.order_id = o.id
         ), '[]'::json) AS items
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN delivery_estimates de ON de.order_id = o.id
  LEFT JOIN driver_locations dl ON dl.driver_id = o.driver_id`;

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

// Ngay lam moc deu tinh theo gio Viet Nam, khong theo UTC: 23h ngay 5/11 gio VN
// la 16h ngay 5/11 UTC, nen group theo UTC se day don buoi toi sang ngay hom sau
// va bao cao doanh thu lech ngay.
const VN_TZ = "Asia/Ho_Chi_Minh";
const VN_TODAY = `(now() AT TIME ZONE '${VN_TZ}')::date`;

// Khoang [00:00 ngay dau, 00:00 ngay sau ngay cuoi) cua 7 ngay gan nhat, doi ve
// timestamptz de so SANH TRUC TIEP voi cot created_at.
const LAST_7_DAYS_START = `(((${VN_TODAY}) - interval '6 days') AT TIME ZONE '${VN_TZ}')`;
const LAST_7_DAYS_END = `(((${VN_TODAY}) + interval '1 day') AT TIME ZONE '${VN_TZ}')`;

export const STATS_BY_STATUS_SQL =
  `SELECT status, count(*)::int AS count, COALESCE(sum(amount), 0)::bigint AS total
   FROM orders WHERE ${VISIBLE_ORDER_FILTER} GROUP BY status`;

// Doanh thu 7 ngay gan nhat theo ngay dia phuong Viet Nam.
//
// Tong theo ngay duoc tinh trong mot subquery co dieu kien KHOANG tren
// created_at, roi moi LEFT JOIN vao day du 7 ngay (generate_series dam bao ngay
// khong co don van xuat hien voi so 0 - ban Mongo chi tra ve nhung ngay co du
// lieu).
//
// Ban truoc loc bang `(o.created_at AT TIME ZONE ...)::date = d.day`. Boc ham
// quanh cot nen khong index duoc: Postgres quet toan bang orders roi sort tran
// ra dia. Tren 100.000 don: 100.8 ms -> 9.3 ms.
//
// MOI moc thoi gian deu duoc doi tuong minh bang `AT TIME ZONE 'Asia/Ho_Chi_Minh'`.
// Day KHONG phai cho dep ma la bat buoc: neu de moc la timestamp khong mui gio
// thi Postgres tu suy ra theo TimeZone cua SESSION, va cua so 7 ngay se lech.
// Postgres tren may dev thua TimeZone cua may (Asia/Ho_Chi_Minh, +07) con Neon
// chay UTC - nghia la bo moc tuong minh di thi may dev van dung trong khi
// production lech 7 tieng. test/orderStats.db.test.js ep session sang nhieu mui
// gio khac nhau de chan dung loi nay.
//
// Cach chan khoang va cach boc ham cho KET QUA GIONG HET NHAU vi
// Asia/Ho_Chi_Minh la UTC+7 co dinh, khong co gio mua he - moi nua dem dia
// phuong ung voi dung mot thoi diem. O mui gio co DST thi phai tinh lai.
export const REVENUE_LAST_7_DAYS_SQL =
  `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
          COALESCE(p.revenue, 0)::bigint AS revenue,
          COALESCE(p.count, 0)::int AS count
   FROM generate_series(
          (${VN_TODAY}) - interval '6 days',
          (${VN_TODAY}),
          interval '1 day') AS d(day)
   LEFT JOIN (
     SELECT (o.created_at AT TIME ZONE '${VN_TZ}')::date AS day,
            sum(o.amount)::bigint AS revenue,
            count(*)::int AS count
     FROM orders o
     WHERE o.status = 'delivered'
       AND (o.payment_method NOT IN ('vnpay', 'zalopay') OR o.payment_status = 'paid')
       AND o.created_at >= ${LAST_7_DAYS_START}
       AND o.created_at <  ${LAST_7_DAYS_END}
     GROUP BY 1
   ) p ON p.day = d.day::date
   ORDER BY d.day`;

// Hai query doc lap nhau nen chay song song.
export const readOrderStats = async () => {
  const [statusRows, dayRows] = await Promise.all([
    query(STATS_BY_STATUS_SQL),
    query(REVENUE_LAST_7_DAYS_SQL),
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

// =========================================================== khoa ban ghi (doc)
//
// Cac ham duoi day BAT BUOC chay trong transaction: FOR UPDATE ngoai transaction
// nha khoa ngay khi cau lenh ket thuc, nen `client` la tham so bat buoc, khong
// phai tuy chon.

export const lockOrderById = async (client, orderId) => {
  const { rows } = await client.query(
    `SELECT id, user_id, amount, status, payment_status
     FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  return rows[0];
};

export const lockOrderByRequestId = async (client, userId, clientRequestId) => {
  const { rows } = await client.query(
    `SELECT id, status, payment_method, payment_status FROM orders
     WHERE user_id = $1 AND client_request_id = $2 FOR UPDATE`,
    [userId, clientRequestId]
  );
  return rows[0];
};

// Khoa cac mon theo thu tu id de hai don dat cung luc khong deadlock
export const lockFoodsForOrder = async (client, foodIds) => {
  const { rows } = await client.query(
    `SELECT id, name, price, image, is_available, stock, track_stock, prep_time_minutes
     FROM foods WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [foodIds]
  );
  return rows;
};

// So don dang "tai" he thong (pending/confirmed) dung lam he so tre cho Smart
// ETA - dung VISIBLE_ORDER_FILTER de don VNPay chua tra tien (nha hang chua
// biet don do ton tai) khong tinh vao tai. excludeOrderId de khong tu tinh
// chinh don vua tao vao tai cua no khi doc lai sau nay.
export const countActiveOrders = async (client, excludeOrderId) => {
  const params = excludeOrderId ? [excludeOrderId] : [];
  const excludeClause = excludeOrderId ? "AND o.id <> $1" : "";
  const { rows } = await run(client,
    `SELECT count(*)::int AS n FROM orders o
     WHERE o.status IN ('pending', 'confirmed') AND ${VISIBLE_ORDER_FILTER} ${excludeClause}`,
    params);
  return rows[0].n;
};

// Don VNPay/ZaloPay qua han thanh toan (+ an han cho callback den tre). SKIP
// LOCKED: nhieu instance chay cung luc khong xu ly trung, va khong cho
// callback dang giu khoa. Ten ham giu "Vnpay" vi ly do lich su nhung xu ly
// ca ZaloPay - ca hai deu dat payment_expires_at khi dat hang (xem insertOrder).
export const lockStaleVnpayOrders = async (client, graceMinutes, batchSize) => {
  const { rows } = await client.query(
    `SELECT id, status FROM orders
     WHERE payment_method IN ('vnpay', 'zalopay') AND status = 'pending'
       AND payment_status IN ('unpaid', 'failed')
       AND payment_expires_at < now() - make_interval(mins => $1::int)
     ORDER BY payment_expires_at
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [graceMinutes, batchSize]
  );
  return rows;
};

// ============================================================== ghi: dat hang

// Dat hang idempotent: INSERT ... ON CONFLICT DO NOTHING tren partial unique
// index (user_id, client_request_id). Khong con canh doc-truoc roi bat
// duplicate-key o catch nhu ban Mongo (noi logic fingerprint bi viet lai lan
// hai trong khoi catch).
//
// Tra ve id cua don vua tao, hoac undefined khi ma yeu cau da duoc dung -
// nguoi goi tu quyet dinh doi xu voi truong hop trung.
export const insertOrder = async (client, {
  userId, clientRequestId, requestFingerprint, address, paymentMethod, paymentTtlMinutes,
}) => {
  const { rows } = await client.query(
    `INSERT INTO orders (user_id, client_request_id, request_fingerprint, amount,
                         ship_full_name, ship_phone, ship_address, ship_note,
                         payment_method, status, payment_expires_at, ship_lat, ship_lng)
     VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, 'pending',
             CASE WHEN $8 IN ('vnpay', 'zalopay') THEN now() + make_interval(mins => $9::int) END,
             $10, $11)
     ON CONFLICT (user_id, client_request_id) WHERE client_request_id IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [
      userId, clientRequestId, requestFingerprint,
      address.fullName.trim(), address.phone.trim(), address.address.trim(),
      (address.note || "").trim(), paymentMethod, paymentTtlMinutes,
      address.lat != null ? Number(address.lat) : null,
      address.lng != null ? Number(address.lng) : null,
    ]
  );
  return rows[0]?.id;
};

// Dieu kien stock >= quantity nam trong CHINH cau UPDATE, nen hai don song song
// khong the cung di qua. Tra ve false khi khong con du hang.
export const takeStock = async (client, foodId, quantity) => {
  const { rowCount } = await client.query(
    "UPDATE foods SET stock = stock - $2 WHERE id = $1 AND stock >= $2",
    [foodId, quantity]
  );
  return rowCount > 0;
};

// Ten, gia, anh luon lay tu DB - khong tin du lieu client gui len
export const insertOrderItem = (client, orderId, food, quantity) => client.query(
  `INSERT INTO order_items (order_id, food_id, name, price, quantity, image)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [orderId, food.id, food.name, food.price, quantity, food.image]
);

// Tong tien do server tu cong lai, bo qua "amount" trong request
export const setOrderAmount = (client, orderId, amount) => client.query(
  "UPDATE orders SET amount = $2 WHERE id = $1",
  [orderId, amount]
);

// Hoan lai ton kho cho cac mon co track_stock khi don bi huy
export const restoreStock = (client, orderId) => client.query(
  `UPDATE foods f SET stock = f.stock + i.quantity
   FROM order_items i
   WHERE i.order_id = $1 AND f.id = i.food_id AND f.track_stock`,
  [orderId]
);

// ========================================================= ghi: trang thai don

// Doi trang thai co dieu kien: chi doi khi don VAN dang o `from`. Tra ve false
// khi don da bi thay doi boi mot request khac - nguoi goi tra 409.
export const changeOrderStatus = async (client, orderId, { from, to }) => {
  const { rowCount } = await client.query(
    "UPDATE orders SET status = $2 WHERE id = $1 AND status = $3 RETURNING id",
    [orderId, to, from]
  );
  return rowCount > 0;
};

export const cancelOrderIfStatus = async (client, orderId, { from, reason }) => {
  const { rowCount } = await client.query(
    `UPDATE orders SET status = 'cancelled', cancel_reason = $2
     WHERE id = $1 AND status = $3
     RETURNING id`,
    [orderId, reason, from]
  );
  return rowCount > 0;
};

// Huy khong dieu kien: dung sau khi da khoa don bang FOR UPDATE va da tu kiem
// trang thai, nen khong can dieu kien lap lai trong cau UPDATE.
export const cancelOrderNow = (client, orderId, reason) => client.query(
  "UPDATE orders SET status = 'cancelled', cancel_reason = $2 WHERE id = $1",
  [orderId, reason]
);

export const setOrderStatus = (client, orderId, status) => client.query(
  "UPDATE orders SET status = $2 WHERE id = $1",
  [orderId, status]
);

export const recordStatusChange = (client, orderId, fromStatus, toStatus, actorRole, changedBy, note = "") =>
  run(client,
    `INSERT INTO order_status_history (order_id, from_status, to_status, actor_role, changed_by, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orderId, fromStatus, toStatus, actorRole, changedBy, note]);

// ============================================================= ghi: Smart ETA

// Baseline Smart ETA, luu dung mot lan luc dat hang (xem placeOrder). eta la
// ket qua cua calcEta() (util/eta.js) cong hai moc gio da tinh san.
export const insertDeliveryEstimate = (client, orderId, eta) => client.query(
  `INSERT INTO delivery_estimates (
     order_id, distinct_items_count, active_orders_at_creation, prep_base_minutes, load_factor,
     confirm_minutes, prep_minutes, delivery_minutes, total_minutes,
     estimated_ready_at, estimated_delivered_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [orderId, eta.distinctItemsCount, eta.activeOrdersCount, eta.prepBaseMinutes, eta.loadFactor,
   eta.confirmMinutes, eta.prepMinutes, eta.deliveryMinutes, eta.totalMinutes,
   eta.estimatedReadyAt, eta.estimatedDeliveredAt]
);

// Whitelist noi bo status -> cot actual_*_at, KHONG nhan ten cot tu input
// nguoi dung. status da duoc VALID_STATUSES kiem truoc o controller, ham nay
// tu gioi han lai; status khong khop (vd 'cancelled') thi bo qua, khong loi.
const ETA_ACTUAL_COLUMN = {
  confirmed: "actual_confirmed_at",
  shipped: "actual_shipped_at",
  delivered: "actual_delivered_at",
};
export const recordEstimateActual = (client, orderId, status) => {
  const column = ETA_ACTUAL_COLUMN[status];
  if (!column) return Promise.resolve();
  return run(client, `UPDATE delivery_estimates SET ${column} = now() WHERE order_id = $1`, [orderId]);
};

// ============================================================ ghi: thanh toan

// Chi cap lan thanh toan moi cho don con dang cho: job het han hoac khach huy
// co the vua chay xong giua luc doc va luc ghi. Tra ve so tien cua don, hoac
// undefined khi don khong con nhan thanh toan - nguoi goi tra 410.
export const claimPaymentAttempt = async (client, orderId, txnRef, expiresAt) => {
  const { rows } = await client.query(
    `UPDATE orders
     SET vnp_txn_ref = $2,
         payment_expires_at = GREATEST(COALESCE(payment_expires_at, $3), $3)
     WHERE id = $1 AND status = 'pending' AND payment_status <> 'paid'
     RETURNING amount`,
    [orderId, txnRef, expiresAt]
  );
  return rows[0]?.amount;
};

export const insertPaymentAttempt = (client, { txnRef, orderId, amount, payUrl, expiresAt }) =>
  client.query(
    `INSERT INTO payment_attempts (txn_ref, order_id, amount, pay_url, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [txnRef, orderId, amount, payUrl, expiresAt]
  );

// txnRef phai la mot lan thanh toan server THUC SU da cap cho dung don nay
// (khong chi la txnRef moi nhat - xem getOrIssuePayUrl)
export const findPaymentAttempt = async (client, txnRef, orderId) => {
  const { rows } = await client.query(
    "SELECT amount FROM payment_attempts WHERE txn_ref = $1 AND order_id = $2",
    [txnRef, orderId]
  );
  return rows[0];
};

// ============================================================ ghi: ZaloPay
//
// Bang rieng zalopay_transactions (xem migration 008) - khong dung chung
// payment_attempts/payments vi hai bang do gan chat ten cot VNPay.

// order_url con han (>2 phut) va chua tung that bai -> tai su dung, giong
// tinh than findReusablePayUrl cua VNPay (tranh cap qua nhieu app_trans_id
// cho cung 1 don khi khach bam lai nhieu lan).
export const findReusableZalopayOrderUrl = async (orderId) => {
  const { rows } = await query(
    `SELECT order_url FROM zalopay_transactions
     WHERE order_id = $1 AND status = 'pending' AND expires_at > now() + interval '2 minutes'
     ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  return rows[0]?.order_url;
};

// Khong co bien 2 phut (khac findReusableZalopayOrderUrl o tren): day chi la
// thong tin "dang cho thanh toan" bao cho app, khong phai URL vua cap moi -
// cung tinh than findActivePayUrl cua VNPay.
export const findActiveZalopayOrderUrl = async (orderId) => {
  const { rows } = await query(
    `SELECT order_url FROM zalopay_transactions
     WHERE order_id = $1 AND status = 'pending' AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  return rows[0]?.order_url;
};

export const insertZalopayTransaction = (client, { orderId, appTransId, orderUrl, expiresAt }) =>
  client.query(
    `INSERT INTO zalopay_transactions (order_id, app_trans_id, order_url, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [orderId, appTransId, orderUrl, expiresAt]
  );

// FOR UPDATE: callback co the den nhieu lan/song song cho cung app_trans_id,
// khoa dong ghi de serialize - giong tinh than lockOrderById cho VNPay.
export const lockZalopayTransaction = async (client, appTransId) => {
  const { rows } = await client.query(
    "SELECT * FROM zalopay_transactions WHERE app_trans_id = $1 FOR UPDATE",
    [appTransId]
  );
  return rows[0];
};

export const markZalopayTransactionResult = (client, appTransId, { status, zpTransId, raw }) =>
  client.query(
    `UPDATE zalopay_transactions SET status = $2, zp_trans_id = $3, raw_callback = $4::jsonb
     WHERE app_trans_id = $1`,
    [appTransId, status, zpTransId || null, JSON.stringify(raw)]
  );

// Ledger append-only. UNIQUE (vnp_transaction_no) lam idempotency nam o tang DB:
// Return URL va IPN cung bao ve mot giao dich thi chi mot ban ghi duoc tao, va
// tra ve false nghia la da xu ly truoc do.
export const insertPaymentLedger = async (client, {
  orderId, txnRef, transactionNo, responseCode, transactionStatus,
  bankCode, cardType, amount, payDate, source, raw,
}) => {
  const { rowCount } = await client.query(
    `INSERT INTO payments (order_id, vnp_txn_ref, vnp_transaction_no, vnp_response_code,
                           vnp_transaction_status, vnp_bank_code, vnp_card_type,
                           vnp_amount, vnp_pay_date, source, signature_valid, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11::jsonb)
     ON CONFLICT (vnp_transaction_no) WHERE vnp_transaction_no IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [
      orderId, txnRef, transactionNo, responseCode, transactionStatus,
      bankCode, cardType, amount, payDate, source, JSON.stringify(raw),
    ]
  );
  return rowCount > 0;
};

// Khong bao gio ha 'paid' xuong 'failed'; don da huy cung khong doi
export const markPaymentFailed = async (client, orderId) => {
  const { rowCount } = await client.query(
    `UPDATE orders SET payment_status = 'failed'
     WHERE id = $1 AND payment_status = 'unpaid' AND status <> 'cancelled'
     RETURNING id`,
    [orderId]
  );
  return rowCount > 0;
};

// Chap nhan ca 'failed' -> 'paid': sua loi "that bai mot lan thi lan tra tien
// sau bi nuot". Truoc day dieu kien chi la payment_status = 'unpaid' nen sau mot
// lan that bai, lan tra tien thanh cong khong doi duoc gi ma server van tra
// RspCode 00 cho VNPay.
//
// Tra ve trang thai don sau khi ghi nhan, hoac undefined khi khong ghi nhan
// duoc - nguoi goi PHAI danh dau hoan tien de khong nuot tien.
export const markPaymentPaid = async (client, orderId) => {
  const { rows } = await client.query(
    `UPDATE orders SET payment_status = 'paid'
     WHERE id = $1 AND payment_status IN ('unpaid', 'failed')
     RETURNING status`,
    [orderId]
  );
  return rows[0]?.status;
};

// Tien DA ve nhung khong the ghi nhan cho don: don da het han/huy (constraint
// orders_paid_not_cancelled), hoac don da paid tu mot giao dich khac (khach tra
// hai lan). Ban ghi payments da luu nen doi soat va hoan tien duoc;
// scripts/reconcile-payments.mjs liet ke cac don nay.
export const markRefundRequired = (client, orderId) => client.query(
  "UPDATE orders SET refund_required = true WHERE id = $1",
  [orderId]
);

// ===================================================== Location Sharing (nhe)
//
// Khong co dieu phoi tu dong, khong luu lich su vi tri - xem migration 011.

// Don dang giao duoc gan cho CHINH tai xe dang goi (driverMiddleware dam bao
// req.userId la mot driver) - driver khong the tu xem don cua driver khac.
export const listOrdersForDriver = (driverId) => run(undefined,
  `${ORDER_SELECT} WHERE o.driver_id = $1 AND o.status = 'shipped' ORDER BY o.created_at DESC`,
  [driverId]
);

// Validate target la driver va don dang o trang thai hop le NGAY TRONG CAU
// SQL (dieu kien trong WHERE) - tranh race giua kiem tra va ghi.
export const assignOrderDriver = async (client, orderId, driverId) => {
  const { rowCount } = await client.query(
    `UPDATE orders SET driver_id = $2
     WHERE id = $1 AND status IN ('confirmed', 'shipped')
       AND EXISTS (SELECT 1 FROM users WHERE id = $2 AND is_driver = true)`,
    [orderId, driverId]
  );
  return rowCount > 0;
};

// UPSERT: chi luu vi tri MOI NHAT (PRIMARY KEY = driver_id), khong phai lich su
export const upsertDriverLocation = (driverId, lat, lng) => query(
  `INSERT INTO driver_locations (driver_id, lat, lng, updated_at)
   VALUES ($1, $2, $3, now())
   ON CONFLICT (driver_id) DO UPDATE SET lat = $2, lng = $3, updated_at = now()`,
  [driverId, lat, lng]
);

export const listDriverUsers = () => query(
  "SELECT id, name, email FROM users WHERE is_driver = true AND is_active ORDER BY name"
);

// ============================================================= ghi: thong bao

// Thong bao khong duoc lam that bai nghiep vu chinh: don da dat/da tra tien van
// phai thanh cong du ghi notification co loi.
export const insertNotification = async (client, userId, title, message) => {
  try {
    await run(client, "INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)",
      [userId, title, message]);
  } catch (error) {
    logger.error("Notify error:", error);
  }
};
