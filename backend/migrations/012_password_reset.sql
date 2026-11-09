-- 012_password_reset.sql
--
-- Quen mat khau: gui ma OTP 6 so qua email, het han ngan, dung duoc 1 lan.
-- Luu HASH cua ma (sha256), khong luu ma tho - cung tinh than voi mat khau/JWT.
-- Doi voi mot nguoi dung co the co nhieu dong (xin lai ma nhieu lan), chi dong
-- moi nhat chua dung va chua het han la con hop le.

BEGIN;

CREATE TABLE password_reset_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_codes_user ON password_reset_codes (user_id, created_at DESC);

COMMIT;
