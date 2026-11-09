// Ha tang chung cho cac test chay tren PostgreSQL that.
//
// Vi sao khong mock DB: controller gio la SQL thuan, nen mock chi chung minh
// duoc "ta goi dung chuoi ta da viet" - khong chung minh duoc chuoi SQL do
// dung. Bug "FOR UPDATE is not allowed with aggregate functions" trong lan
// migration nay la vi du: moi test mock se pass trong khi production tra 500.
// Chay tren DB that bat duoc ca cu phap SQL, constraint, index va transaction.
//
// Can TEST_DATABASE_URL tro vao mot DB RONG dung de test (khong phai DATABASE_URL
// cua app) - de npm test khong bao gio ghi vao DB that.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "migrations");

export const TEST_DB_URL = process.env.TEST_DATABASE_URL || "";
export const dbMissingReason =
  "Can TEST_DATABASE_URL tro vao mot Postgres rong. Vi du:\n"
  + "  TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/foodgo_test npm test";

// Bat buoc tro vao localhost hoac ten co _test: chan truong hop tro nham vao
// DB that roi bi TRUNCATE sach.
if (TEST_DB_URL && !/localhost|127\.0\.0\.1|_test/.test(TEST_DB_URL)) {
  throw new Error("TEST_DATABASE_URL phai tro vao localhost hoac DB co ten chua _test");
}

export const hasDb = Boolean(TEST_DB_URL);

let db = null;

// db/index.js doc DATABASE_URL luc tao pool, nen phai gan env TRUOC khi import
export const getDb = async () => {
  if (db) return db;
  process.env.DATABASE_URL = TEST_DB_URL;
  if (!process.env.PGSSL) process.env.PGSSL = "disable";
  db = await import("../../db/index.js");
  return db;
};

// Chay migration theo bang schema_migrations giong scripts/migrate.mjs, de DB
// test da tao tu truoc van nhan migration moi (truoc day chi kiem "da co bang
// orders chua" nen migration 003 tro di khong bao gio chay tren DB test cu).
export const migrate = async () => {
  const { query } = await getDb();
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.filename));
  // DB test tao bang code cu: da co bang orders nhung chua ghi so migration
  if (applied.size === 0) {
    const legacy = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public' AND table_name = 'orders') AS ready`);
    if (legacy.rows[0].ready) {
      for (const file of ["001_init.sql", "002_track_stock.sql"]) {
        await query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        applied.add(file);
      }
    }
  }
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    await query(await readFile(join(migrationsDir, file), "utf8"));
    await query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
  }
};

const TABLES = [
  "order_status_history", "payments", "payment_attempts", "zalopay_transactions",
  "voucher_redemptions", "delivery_estimates", "driver_locations", "order_items", "orders",
  "reviews", "notifications", "addresses", "foods", "categories", "users", "vouchers",
];

export const resetDb = async () => {
  const { query } = await getDb();
  await query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
};

export const closeDb = async () => {
  if (db) await db.closeDB();
  db = null;
};

// Giu nguyen helper cua bo test cu de phong cach assert khong doi
export const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  send(body) { this.body = body; return this; },
  set() { return this; },
});

export const makeUser = async ({
  email = "khach@test.local", isAdmin = false, isActive = true, isDriver = false,
} = {}) => {
  const { query } = await getDb();
  const { rows } = await query(
    `INSERT INTO users (name, email, password, is_admin, is_active, is_driver)
     VALUES ($1, $2, 'hash-gia', $3, $4, $5) RETURNING id`,
    ["Khach Test", email, isAdmin, isActive, isDriver]
  );
  return rows[0].id;
};

export const makeCategory = async (name = "Mon nuoc") => {
  const { query } = await getDb();
  const { rows } = await query(
    "INSERT INTO categories (name) VALUES ($1) RETURNING id", [name]);
  return rows[0].id;
};

export const makeFood = async (categoryId, {
  name = "Phở bò", price = 65000, stock = 0, trackStock = false, isAvailable = true,
  prepTimeMinutes = 15,
} = {}) => {
  const { query } = await getDb();
  const { rows } = await query(
    `INSERT INTO foods (name, price, image, category_id, stock, track_stock, is_available, prep_time_minutes)
     VALUES ($1, $2, 'anh.jpg', $3, $4, $5, $6, $7) RETURNING id`,
    [name, price, categoryId, stock, trackStock, isAvailable, prepTimeMinutes]
  );
  return rows[0].id;
};

export const makeOrder = async (userId, {
  status = "pending", paymentStatus = "unpaid", paymentMethod = "cod", amount = 65000,
  clientRequestId = null, foodId = null, quantity = 1,
} = {}) => {
  const { query } = await getDb();
  const { rows } = await query(
    `INSERT INTO orders (user_id, client_request_id, amount, ship_full_name, ship_phone,
                         ship_address, payment_method, payment_status, status)
     VALUES ($1, $2, $3, 'Khach', '0900000000', 'HN', $4, $5, $6) RETURNING id`,
    [userId, clientRequestId, amount, paymentMethod, paymentStatus, status]
  );
  const orderId = rows[0].id;
  if (foodId) {
    await query(
      `INSERT INTO order_items (order_id, food_id, name, price, quantity)
       VALUES ($1, $2, 'Phở bò', $3, $4)`,
      [orderId, foodId, amount, quantity]
    );
  }
  return orderId;
};

export const makeVoucher = async ({
  code = "SALE10", discountType = "percent", discountValue = 10, maxDiscountAmount = null,
  minOrderValue = 0, usageLimit = null, usageLimitPerUser = null,
  validFrom = null, validUntil = null, isActive = true,
} = {}) => {
  const { query } = await getDb();
  const { rows } = await query(
    `INSERT INTO vouchers (code, discount_type, discount_value, max_discount_amount, min_order_value,
                           usage_limit, usage_limit_per_user, valid_from, valid_until, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [code, discountType, discountValue, maxDiscountAmount, minOrderValue,
      usageLimit, usageLimitPerUser, validFrom, validUntil, isActive]
  );
  return rows[0].id;
};

export const countRows = async (table, where = "", params = []) => {
  const { query } = await getDb();
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM ${table} ${where}`, params);
  return rows[0].n;
};
