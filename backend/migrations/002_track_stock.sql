-- 002_track_stock.sql
--
-- Van de: app Android (man hinh admin them/sua mon) KHONG gui field stock -
-- no chi gui name/description/price/category/isAvailable. Neu bat buoc
-- stock >= quantity khi dat hang thi moi mon tao tu app se co stock = 0 va
-- thanh khong the dat duoc. Do la vo luong admin dang chay.
--
-- Giai phap: tru ton kho chi ap dung cho mon CO BAT theo doi ton kho.
--   track_stock = false (mac dinh) -> xu su y nhu ban MongoDB, khong gioi han
--   track_stock = true             -> dat hang phai con du stock
--
-- Nho vay khong pha hop dong API hien tai, ma van co duong dung chong oversell
-- cho nhung mon that su can dem suat.

BEGIN;

ALTER TABLE foods ADD COLUMN track_stock boolean NOT NULL DEFAULT false;

-- Mon nao da duoc dat stock > 0 (vi du tu seed) thi coi nhu muon theo doi
UPDATE foods SET track_stock = true WHERE stock > 0;

COMMENT ON COLUMN foods.track_stock IS
  'Bat thi dat hang phai con du stock; tat thi khong gioi han (hanh vi cu)';

COMMIT;
