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

export const migrate = async () => {
  const { query } = await getDb();
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const applied = await query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'orders') AS ready`
  );
  if (applied.rows[0].ready) return;
  for (const file of files) {
    await query(await readFile(join(migrationsDir, file), "utf8"));
  }
};

const TABLES = [
  "order_status_history", "payments", "order_items", "orders",
  "reviews", "notifications", "addresses", "foods", "categories", "users",
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

export const makeUser = async ({ email = "khach@test.local", isAdmin = false, isActive = true } = {}) => {
  const { query } = await getDb();
  const { rows } = await query(
    `INSERT INTO users (name, email, password, is_admin, is_active)
     VALUES ($1, $2, 'hash-gia', $3, $4) RETURNING id`,
    ["Khach Test", email, isAdmin, isActive]
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
} = {}) => {
  const { query } = await getDb();
  const { rows } = await query(
    `INSERT INTO foods (name, price, image, category_id, stock, track_stock, is_available)
     VALUES ($1, $2, 'anh.jpg', $3, $4, $5, $6) RETURNING id`,
    [name, price, categoryId, stock, trackStock, isAvailable]
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

export const countRows = async (table, where = "", params = []) => {
  const { query } = await getDb();
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM ${table} ${where}`, params);
  return rows[0].n;
};
