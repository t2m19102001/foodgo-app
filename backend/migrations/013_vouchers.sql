-- 013_vouchers.sql
--
-- Voucher/ma giam gia: ho tro ca giam theo % (co tran toi da optional) va
-- giam so tien co dinh. Dung chung mot cot discount_value voi hai y nghia
-- khac nhau theo discount_type (% hoac VND) - xem backend/util/voucher.js.
--
-- orders.amount TIEP TUC la so tien CUOI CUNG phai tra (sau giam gia): day
-- la so duoc gui cho VNPay/ZaloPay va duoc cong vao doanh thu, khong doi y
-- nghia de khong phai sua getOrIssuePayUrl/getOrIssueZaloPayOrder/readOrderStats.
-- discount_amount la snapshot de hien thi "da giam X d"; subtotal hien thi
-- phia Android = amount + discount_amount, khong luu them cot.
--
-- Chong dung lai qua gioi han / dung hai lan cho cung don: xem
-- backend/controllers/orderController.js - khoa dong vouchers FOR UPDATE
-- theo code TRUOC khi dem voucher_redemptions, giong tinh than
-- lockZalopayTransaction trong backend/util/zalopay.js.

BEGIN;

CREATE TABLE vouchers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 citext NOT NULL UNIQUE,
  description          text NOT NULL DEFAULT '',
  discount_type        text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  -- percent: 1-100 (xem CHECK duoi). fixed: so VND, > 0.
  discount_value       bigint NOT NULL CHECK (discount_value > 0),
  -- Chi co nghia voi discount_type = 'percent'. NULL = khong co tran.
  max_discount_amount  bigint CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  -- NULL = khong gioi han don toi thieu
  min_order_value      bigint NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  -- NULL = khong gioi han so lan dung
  usage_limit          integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_limit_per_user  integer CHECK (usage_limit_per_user IS NULL OR usage_limit_per_user > 0),
  valid_from           timestamptz,
  valid_until          timestamptz,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vouchers_percent_range
    CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CONSTRAINT vouchers_valid_window
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until)
);
CREATE TRIGGER vouchers_updated_at BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX vouchers_active_idx ON vouchers (is_active);

-- So ghi append-only: nguon chan ly duy nhat de dem so lan da dung (tong va
-- theo user). UNIQUE(order_id) vi hien tai 1 don chi ap 1 ma - cung la chot
-- chong ghi trung neu code vo tinh goi insert hai lan.
CREATE TABLE voucher_redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id      uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount bigint NOT NULL CHECK (discount_amount >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voucher_redemptions_one_per_order UNIQUE (order_id)
);
-- Phuc vu dem "tong da dung" va "da dung boi user nay" - ca hai deu loc theo
-- voucher_id truoc nen mot index gop du dung cho ca hai truy van.
CREATE INDEX voucher_redemptions_voucher_user_idx ON voucher_redemptions (voucher_id, user_id);

-- Snapshot tren orders de hien thi nhanh khong can JOIN moi lan doc mot don.
ALTER TABLE orders ADD COLUMN voucher_id uuid REFERENCES vouchers(id) ON DELETE RESTRICT;
ALTER TABLE orders ADD COLUMN discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

COMMIT;
