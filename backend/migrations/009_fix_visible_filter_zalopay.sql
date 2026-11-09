-- 009_fix_visible_filter_zalopay.sql
--
-- Migration 008 them 'zalopay' vao payment_method nhung quen 2 cho: ham JS
-- VISIBLE_ORDER_FILTER (da sua trong cung lan commit nay, xem db/orders.js)
-- va 2 partial index o day van con predicate cu "<> 'vnpay'" - nghia la don
-- zalopay CHUA tra tien bi lo ra GET /my/list/stats (bat qua bang
-- test/zalopay.db.test.js, khong phai suy doan).
--
-- Khong sua duoc migration 005 cu (da chay roi, doi noi dung file da ap dung
-- se KHONG duoc ap lai - schema_migrations chi theo ten file). Phai DROP roi
-- CREATE lai 2 index nay voi predicate moi, giu nguyen tat ca thiet ke khac
-- (cot, INCLUDE) da duoc do dac trong migration 005.
--
-- Predicate phai KHIT voi VISIBLE_ORDER_FILTER/dieu kien revenue moi (xem
-- db/orders.js) de Postgres con dung duoc index nay (chung minh WHERE => predicate).

BEGIN;

DROP INDEX orders_revenue_by_day_idx;
CREATE INDEX orders_revenue_by_day_idx
  ON orders (created_at) INCLUDE (amount)
  WHERE status = 'delivered' AND (payment_method NOT IN ('vnpay', 'zalopay') OR payment_status = 'paid');

DROP INDEX orders_visible_status_idx;
CREATE INDEX orders_visible_status_idx
  ON orders (status, created_at DESC) INCLUDE (amount)
  WHERE (payment_method NOT IN ('vnpay', 'zalopay') OR payment_status = 'paid' OR refund_required);

COMMIT;

ANALYZE orders;
