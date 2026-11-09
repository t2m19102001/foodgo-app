-- 011_driver_location.sql
--
-- Location Sharing (ban NHE): 1 co is_driver tren users (cung kieu voi
-- is_admin da co, khong dung bang/role enum rieng - gon hon cho quy mo nho).
-- Admin "thang cap" 1 user thuong thanh tai xe (xem authController.js), tai
-- xe van dang nhap qua API dang nhap thong thuong.
--
-- driver_locations CHI luu VI TRI MOI NHAT (khong luu lich su) - PRIMARY KEY
-- = driver_id nen moi lan cap nhat la UPSERT, dung cho "chia se vi tri hien
-- tai", khong phai theo doi lo trinh.
--
-- orders.driver_id: admin gan tay 1 tai xe/don (khong co dieu phoi tu dong).
-- KHONG doi actor_role cua order_status_history - tai xe khong tu doi trang
-- thai don trong ban nhe nay, chi chia se vi tri; admin van la nguoi duy
-- nhat chuyen trang thai (giu nguyen toan bo logic updateOrderStatus cu).

BEGIN;

ALTER TABLE users ADD COLUMN is_driver boolean NOT NULL DEFAULT false;

ALTER TABLE orders ADD COLUMN driver_id uuid REFERENCES users(id);

CREATE TABLE driver_locations (
  driver_id  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat        double precision NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lng        double precision NOT NULL CHECK (lng >= -180 AND lng <= 180),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
