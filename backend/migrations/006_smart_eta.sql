-- 006_smart_eta.sql
--
-- Smart ETA rule-based: KHONG co GPS/khoang cach thuc, nen "thoi gian giao
-- hang" gop luon ca "cho tai xe toi lay" thanh MOT khoang trung binh cau hinh
-- duoc (ETA_DELIVERY_MINUTES) - day la han che ro rang, se thay bang tinh
-- toan theo khoang cach thuc khi lam module Maps/driver o giai doan sau.
--
-- prep_base_minutes trong delivery_estimates la phan "chuan bi" TRUOC khi
-- nhan he so tai (load_factor): max(prep_time_minutes cac mon) + phu phi theo
-- so mon khac nhau. Luu rieng phan nay de o lan DOC don sau co the tinh lai
-- ETA voi TAI HIEN TAI ma khong phai JOIN lai bang foods (prep_time_minutes
-- cua mon co the da doi, nhung muc dich o day la phat hien do lech do TAI,
-- khong phai do gia/prep mon doi).

BEGIN;

ALTER TABLE foods
  ADD COLUMN prep_time_minutes integer NOT NULL DEFAULT 15
    CHECK (prep_time_minutes > 0 AND prep_time_minutes <= 180);
COMMENT ON COLUMN foods.prep_time_minutes IS
  'Thoi gian chuan bi trung binh cua mon (phut), dung cho Smart ETA';

-- Uoc tinh Smart ETA cho moi don: snapshot luc dat hang (estimate) + thoi
-- diem THUC TE server ghi nhan khi doi trang thai (actual). 1-1 voi orders,
-- tach bang rieng (khong gop vao orders) de danh cho viec doi soat estimate
-- vs actual sau nay (tinh chinh cong thuc hoac lam ML) ma KHONG dong vao
-- schema orders dang duoc nhieu noi doc.
CREATE TABLE delivery_estimates (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,

  -- Dau vao da dung de tinh (de giai thich lai ket qua / doi soat sau nay)
  distinct_items_count      integer NOT NULL CHECK (distinct_items_count > 0),
  active_orders_at_creation integer NOT NULL CHECK (active_orders_at_creation >= 0),
  prep_base_minutes         integer NOT NULL CHECK (prep_base_minutes > 0),
  load_factor               numeric(3,2) NOT NULL CHECK (load_factor >= 1),

  -- Ket qua uoc tinh (estimate), dong bang luc dat hang
  confirm_minutes           integer NOT NULL,
  prep_minutes              integer NOT NULL,
  delivery_minutes          integer NOT NULL,
  total_minutes             integer NOT NULL,
  estimated_ready_at        timestamptz NOT NULL,  -- du kien mon xong (xac nhan + chuan bi)
  estimated_delivered_at    timestamptz NOT NULL,  -- du kien giao xong (tong)

  -- Thoi diem THUC TE, ghi tu updateOrderStatus (xem recordEstimateActual)
  actual_confirmed_at       timestamptz,
  actual_shipped_at         timestamptz,
  actual_delivered_at       timestamptz,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER delivery_estimates_updated_at BEFORE UPDATE ON delivery_estimates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- UNIQUE(order_id) da tu tao index, khong can them CREATE INDEX rieng.

COMMIT;
