-- 003_vnpay_attempts_expiry.sql
--
-- Sua hai loi tien cua luong VNPay va them han thanh toan:
--
-- 1. payment_attempts: MOI payUrl tung cap cho mot don deu duoc ghi lai. Truoc
--    day orders.vnp_txn_ref chi giu txnRef MOI NHAT, nen khi app goi lai
--    POST /api/order (cap payUrl moi) thi IPN cua giao dich khach DA TRA TIEN
--    bang payUrl cu bi tu choi (RspCode 02) va khong de lai dau vet nao.
--    Gio callback hop le neu txnRef nam trong bang nay va thuoc dung don.
--    pay_url duoc luu de gui lai dung URL cu khi no con han, thay vi cap moi.
--
-- 2. orders.payment_expires_at: don VNPay chua thanh toan giu ton kho; qua han
--    (cong them thoi gian an han cho IPN den tre) thi job tu huy va hoan kho.
--
-- 3. orders.refund_required: tien ve cho mot don da huy/het han, hoac ve LAN
--    THU HAI cho mot don da paid. Khong the dat paid (constraint
--    orders_paid_not_cancelled), nen danh dau de admin hoan tien va de doi soat.

BEGIN;

CREATE TABLE payment_attempts (
  txn_ref    text PRIMARY KEY,
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount     bigint NOT NULL CHECK (amount >= 0),
  pay_url    text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_attempts_order_idx ON payment_attempts (order_id, created_at DESC);

-- txnRef da phat truoc migration nay van phai duoc cong nhan khi IPN ve tre.
-- Khong co pay_url nen se khong bao gio duoc gui lai cho client.
INSERT INTO payment_attempts (txn_ref, order_id, amount, pay_url, expires_at, created_at)
  SELECT vnp_txn_ref, id, amount, '', created_at, created_at
  FROM orders
  WHERE vnp_txn_ref <> ''
ON CONFLICT (txn_ref) DO NOTHING;

ALTER TABLE orders ADD COLUMN payment_expires_at timestamptz;
ALTER TABLE orders ADD COLUMN refund_required boolean NOT NULL DEFAULT false;

-- Don VNPay cu dang treo: cho them 30 phut tinh tu luc chay migration
UPDATE orders SET payment_expires_at = now() + interval '30 minutes'
  WHERE payment_method = 'vnpay' AND payment_status <> 'paid' AND status = 'pending';

-- Phuc vu job het han: chi quet dung tap don dang cho thanh toan
CREATE INDEX orders_vnpay_awaiting_idx ON orders (payment_expires_at)
  WHERE payment_method = 'vnpay' AND status = 'pending'
    AND payment_status IN ('unpaid', 'failed');

CREATE INDEX orders_refund_required_idx ON orders (id) WHERE refund_required;

COMMIT;
