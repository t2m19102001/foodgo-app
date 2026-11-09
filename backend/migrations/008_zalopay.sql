-- 008_zalopay.sql
--
-- Them ZaloPay nhu mot payment_method thu 3 (sau cod, vnpay). Tai dung TOAN
-- BO state machine payment_status (unpaid/paid/failed/refunded) va cac ham
-- markPaymentPaid/markPaymentFailed/flagRefund da co trong db/orders.js -
-- khong viet lai, chi them nguon callback moi.
--
-- Vi sao KHONG dung chung bang payment_attempts/payments voi VNPay: hai bang
-- do dat ten cot gan chat VNPay (txn_ref, vnp_transaction_no...) va co UNIQUE
-- constraint rieng cho vnp_transaction_no - dung chung se phai sua lai ten
-- cot, rui ro pha du lieu VNPay dang chay. Bang rieng zalopay_transactions
-- an toan hon, doi gia ca cua tach biet theo cong thanh toan.

BEGIN;

ALTER TABLE orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cod', 'vnpay', 'zalopay'));

CREATE TABLE zalopay_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Dinh dang ZaloPay yeu cau: yymmdd_<ma rieng>, toi da 40 ky tu
  app_trans_id text NOT NULL UNIQUE,
  zp_trans_id  text,
  order_url    text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  -- ZaloPay het han nhan thanh toan cho 1 app_trans_id sau 15 phut (theo tai
  -- lieu) - dung de biet khi nao CAP LAI don moi thay vi tai su dung order_url cu.
  expires_at   timestamptz NOT NULL,
  raw_callback jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zalopay_transactions_order_idx ON zalopay_transactions (order_id);
CREATE TRIGGER zalopay_transactions_updated_at BEFORE UPDATE ON zalopay_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
