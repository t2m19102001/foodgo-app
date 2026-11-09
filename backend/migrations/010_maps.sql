-- 010_maps.sql
--
-- Toa do cho module Google Maps. Nullable, tuong thich nguoc voi dia
-- chi/don cu chua co toa do - khong bat buoc chon tren ban do, van nhap
-- text nhu truoc duoc.
--
-- Khong them bang "restaurants": he thong chi co 1 cua hang (xem
-- RESTAURANT_LAT/LNG trong .env.example), khong can bang cho 1 ban ghi tinh.

BEGIN;

ALTER TABLE addresses
  ADD COLUMN lat double precision CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  ADD COLUMN lng double precision CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));

-- Snapshot toa do giao hang LUC DAT DON, cung tinh than voi ship_full_name/
-- ship_address (text) da co - dia chi co the doi/xoa sau nhung don van giu
-- dung toa do da dung luc giao.
ALTER TABLE orders
  ADD COLUMN ship_lat double precision CHECK (ship_lat IS NULL OR (ship_lat >= -90 AND ship_lat <= 90)),
  ADD COLUMN ship_lng double precision CHECK (ship_lng IS NULL OR (ship_lng >= -180 AND ship_lng <= 180));

COMMIT;
