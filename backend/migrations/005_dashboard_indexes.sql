-- 005_dashboard_indexes.sql
--
-- Hai index cho man thong ke/danh sach cua admin. Do tren 100.000 don that
-- (Postgres 17.6, trung vi 9 lan chay moi bien the, co ~3 ms overhead ket noi
-- psql trong moi so):
--
--   doanh thu 7 ngay        101-155 ms -> 9-16 ms   (~10x, kem viec viet lai query)
--   count(*) phan trang      37-47 ms  -> 13-20 ms  (~2.5x)
--   thong ke theo trang thai 63-68 ms  -> 22-26 ms  (~2.5x)
--
-- Khoang thay vi mot so: may do dang chay viec khac nen gia tri tuyet doi dao
-- qua lai giua cac lan, nhung TI LE thi on dinh.
--
-- Query trang 1 danh sach admin KHONG can index moi: orders_created_idx cong
-- LIMIT 10 da chi doc 13 dong (0.04 ms). Da do truoc khi them nen khong them
-- index vo ich cho no.
--
-- Vi sao chi 2 index: moi index la mot chi phi tra tren TUNG lan ghi. Don hang
-- doi trang thai ~3 lan trong doi (pending -> confirmed -> shipped ->
-- delivered), moi lan doi deu phai cap nhat index co `status` trong khoa. Chi
-- giu nhung index da DO duoc la co loi.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Doanh thu 7 ngay gan nhat (readOrderStats trong db/orders.js)
--
-- Query cu loc bang `(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ...`.
-- Boc ham quanh cot lam Postgres khong dung duoc index nao tren created_at, nen
-- no quet toan bang roi sort 54.000 dong TRAN RA DIA (external sort 2648kB).
-- Va khong the index chinh bieu thuc do: `timestamptz AT TIME ZONE <text>` la
-- STABLE chu khong IMMUTABLE (ket qua phu thuoc du lieu mui gio cua he thong),
-- ma index chi nhan bieu thuc IMMUTABLE.
--
-- Nen query duoc viet lai thanh chan khoang tren CHINH cot created_at
-- (created_at >= dau_ngay AND created_at < sau_ngay_cuoi), va index nay phuc vu
-- dung khoang do. INCLUDE (amount) de thanh Index Only Scan: sum(amount) lay
-- luon trong index, khong phai doc 1833 block heap nhu truoc.
--
-- Predicate trung KHIT voi WHERE cua query - Postgres chi dung partial index
-- khi chung minh duoc WHERE suy ra predicate, nen hai cho phai giong nhau.
CREATE INDEX orders_revenue_by_day_idx
  ON orders (created_at) INCLUDE (amount)
  WHERE status = 'delivered' AND (payment_method <> 'vnpay' OR payment_status = 'paid');

-- ---------------------------------------------------------------------------
-- 2. Don "hien thi duoc" theo trang thai
--
-- Predicate la dung VISIBLE_ORDER_FILTER trong db/orders.js (don VNPay chua tra
-- tien coi nhu chua ton tai, tru don can hoan tien). Dieu kien nay dung cho
-- ~83% so don nen khong chon loc gi - index khong giup bang cach "nhay qua"
-- dong nao, ma bang cach cho doc 4 MB index thay vi 15 MB bang.
--
-- Khoa (status, created_at DESC) phuc vu ba query mot luc:
--   - count(*) phan trang (quet ca index, Index Only Scan)
--   - thong ke GROUP BY status (status la cot dau khoa)
--   - danh sach admin loc theo trang thai, ORDER BY created_at DESC: co san thu
--     tu nen khong phai sort
-- Da do ca ban khoa chi (status): cham hon cho query thu ba va khong nhanh hon
-- o hai query dau, nen chon ban nay du ton them 736 kB.
CREATE INDEX orders_visible_status_idx
  ON orders (status, created_at DESC) INCLUDE (amount)
  WHERE (payment_method <> 'vnpay' OR payment_status = 'paid' OR refund_required);

-- Luu y khi chay tren production: CREATE INDEX (khong CONCURRENTLY) giu SHARE
-- lock tren bang orders - chan GHI, khong chan DOC - cho den khi xong. Voi so
-- don hien tai thi chi vai chuc mili giay. Neu sau nay bang len hang trieu dong
-- thi phai doi sang CREATE INDEX CONCURRENTLY, va khi do phai bo BEGIN/COMMIT
-- cua file nay vi CONCURRENTLY khong chay duoc trong transaction.

COMMIT;

ANALYZE orders;
