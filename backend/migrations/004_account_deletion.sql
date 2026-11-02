-- 004_account_deletion.sql
--
-- Xoa tai khoan theo yeu cau cua Google Play / App Store. Don hang tham chieu
-- users bang ON DELETE RESTRICT (can giu cho doi soat, ke toan), nen "xoa" la
-- AN DANH HOA: xoa du lieu ca nhan, giu lai dong users rong de khoa ngoai con
-- dung. deleted_at danh dau tai khoan da xoa.

BEGIN;

ALTER TABLE users ADD COLUMN deleted_at timestamptz;

COMMIT;
