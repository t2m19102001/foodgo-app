-- 001_init.sql - Schema khoi tao PostgreSQL cho FoodGo (thay MongoDB)
--
-- RANG BUOC QUAN TRONG: moi khoa chinh phoi ra client PHAI la uuid, khong duoc
-- dung serial/bigint. Ca 7 model Gson phia Android deu khai bao
-- @SerializedName("_id") private String id, nen so nguyen se ra JSON number va
-- Gson nem loi khi gan vao field String. Backend van serialize ra khoa "_id".

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- email so sanh khong phan biet hoa thuong
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- index tim kiem chuoi con

-- Bo dau tieng Viet de tim kiem "pho" ra "pho". Khong dung unaccent() cua
-- extension vi no duoc khai bao STABLE nen khong index duoc; translate() cho
-- phep khai bao IMMUTABLE va xu ly dung ca ky tu 2 dau lan chu d.
CREATE OR REPLACE FUNCTION vn_unaccent(txt text) RETURNS text AS $fn$
  SELECT translate(
    lower(coalesce(txt, '')),
    'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  );
$fn$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

-- Dung chung cho moi bang co updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         citext NOT NULL UNIQUE,
  password      text NOT NULL,
  phone         text NOT NULL DEFAULT '',
  address       text NOT NULL DEFAULT '',
  image         text NOT NULL DEFAULT '',
  is_admin      boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  token_version integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------- categories
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  image      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- foods
-- category_id thay cho truong category dang String ten mon o Mongo. Chinh
-- truong String do buoc categoryController phai chan cung viec doi ten danh
-- muc dang co mon; voi ON UPDATE CASCADE thi doi ten hoat dong binh thuong.
-- API van tra ve "category" la TEN (string) de app Android khong phai sua.
CREATE TABLE foods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  price        bigint NOT NULL CHECK (price >= 0),   -- VND, so nguyen thay cho double
  image        text NOT NULL,
  category_id  uuid NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_available boolean NOT NULL DEFAULT true,
  stock        integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER foods_updated_at BEFORE UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX foods_category_id_idx ON foods (category_id);
CREATE INDEX foods_search_idx ON foods USING gin (vn_unaccent(name) gin_trgm_ops);

-- --------------------------------------------------------------- orders
CREATE TABLE orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_request_id   text,
  request_fingerprint text,
  amount              bigint NOT NULL CHECK (amount >= 0),
  -- Snapshot dia chi giao hang luc dat don, khong phai khoa ngoai ve addresses:
  -- user sua so dia chi thi don cu khong duoc doi theo.
  ship_full_name      text NOT NULL,
  ship_phone          text NOT NULL,
  ship_address        text NOT NULL,
  ship_note           text NOT NULL DEFAULT '',
  payment_method      text NOT NULL DEFAULT 'cod'
                        CHECK (payment_method IN ('cod', 'vnpay')),
  -- 'refunded' la duong ra hop phap cho don da tra tien ma khach huy: phai
  -- hoan tien TRUOC roi moi huy duoc don (xem constraint o duoi).
  payment_status      text NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  vnp_txn_ref         text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  cancel_reason       text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Luoi an toan cho lo hong nghiem trong nhat cua ban Mongo: don da huy van
  -- xin duoc payUrl va van nhan duoc trang thai paid. Code phai chan truoc,
  -- day chi la chot cuoi - va code PHAI bat loi vi pham constraint nay roi
  -- tra RspCode "02" cho VNPay thay vi de thanh 500.
  --
  -- Constraint nay bat buoc thu tu dung khi khach huy don da tra tien:
  -- payment_status phai sang 'refunded' TRUOC, status moi sang 'cancelled'
  -- duoc. Nho vay khong bao gio ton tai don vua giu tien khach vua bi huy.
  CONSTRAINT orders_paid_not_cancelled
    CHECK (NOT (payment_status = 'paid' AND status = 'cancelled'))
);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tuong duong partial unique index cua Mongo: dat hang idempotent theo
-- clientRequestId. Ket hop INSERT ... ON CONFLICT DO NOTHING de bo han khoi
-- catch duplicate-key 11000.
CREATE UNIQUE INDEX orders_user_client_request_key
  ON orders (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Ban Mongo thieu ca hai index nay nen moi lan liet ke don la mot lan sort
-- toan bo collection trong RAM.
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_created_idx      ON orders (created_at DESC);
CREATE INDEX orders_status_idx       ON orders (status);

-- ---------------------------------------------------------- order_items
-- id la bigserial noi bo, KHONG phoi ra JSON (ban Mongo dung _id: false).
-- Giu snapshot name/price/image: gia mon doi thi don cu khong bi meo.
CREATE TABLE order_items (
  id       bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_id  uuid REFERENCES foods(id) ON DELETE SET NULL,
  name     text NOT NULL,
  price    bigint NOT NULL CHECK (price >= 0),
  quantity integer NOT NULL CHECK (quantity >= 1),
  image    text NOT NULL DEFAULT ''
);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_food_id_idx  ON order_items (food_id);

-- -------------------------------------------------------------- reviews
CREATE TABLE reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- ON DELETE CASCADE sua loi review mo coi: ban Mongo xoa mon xong thi review
  -- cua mon do o lai vinh vien va API van tra ve.
  food_id    uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, food_id)
);
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Index Mongo la {userId, foodId} nen foodId khong phai prefix, tim review
-- theo mon phai quet toan bo collection. Day la index con thieu.
CREATE INDEX reviews_food_id_idx ON reviews (food_id);

-- -------------------------------------------------------- notifications
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  message    text NOT NULL,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
-- Rieng cho unreadCount tra kem moi response thong bao
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE NOT is_read;

-- ------------------------------------------------------------ addresses
CREATE TABLE addresses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name  text NOT NULL,
  phone      text NOT NULL,
  address    text NOT NULL,
  note       text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX addresses_user_id_idx ON addresses (user_id);
-- Chan race o addressController: hai request them dia chi dau tien song song
-- tao ra hai dia chi cung is_default = true.
CREATE UNIQUE INDEX addresses_one_default_per_user
  ON addresses (user_id) WHERE is_default;

-- ------------------------------------------------------------- payments
-- So ghi append-only. Ban Mongo vut bo toan bo payload VNPay sau khi xu ly
-- nen khach khieu nai "toi da tra tien" thi khong co gi de tra.
CREATE TABLE payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  vnp_txn_ref            text NOT NULL,
  vnp_transaction_no     text,
  vnp_response_code      text,
  vnp_transaction_status text,
  vnp_bank_code          text,
  vnp_card_type          text,
  vnp_amount             bigint,   -- don vi VNPay, bang so tien x 100
  vnp_pay_date           text,
  source                 text NOT NULL CHECK (source IN ('return', 'ipn')),
  signature_valid        boolean NOT NULL,
  raw                    jsonb NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_id_idx ON payments (order_id);

-- Idempotency that o tang DB: Return URL va IPN cung bao ve mot giao dich thi
-- chi mot ban ghi duoc tao. Dung INSERT ... ON CONFLICT DO NOTHING, va rowCount
-- bang 0 nghia la giao dich da duoc xu ly truoc do.
CREATE UNIQUE INDEX payments_transaction_no_key
  ON payments (vnp_transaction_no)
  WHERE vnp_transaction_no IS NOT NULL;

-- --------------------------------------------- order_status_history
-- Ban Mongo chi luu status hien tai, nen backend khong biet don sang shipped
-- luc nao du app ve tracker 4 buoc. Bang nay vua lam tracker dung vua la
-- audit log hanh dong admin.
CREATE TABLE order_status_history (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role  text NOT NULL CHECK (actor_role IN ('customer', 'admin', 'system')),
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, created_at);

-- --------------------------------------------------- view tro giup
-- Xoa N+1-qua-mang: ban Mongo khong tinh rating tong hop nen muon hien sao
-- tren danh sach mon, app phai goi API review cho TUNG mon.
CREATE VIEW food_ratings AS
  SELECT food_id,
         round(avg(rating)::numeric, 1) AS avg_rating,
         count(*)::int                  AS review_count
  FROM reviews
  GROUP BY food_id;

COMMIT;
