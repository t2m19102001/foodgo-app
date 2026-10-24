import pg from "pg";
import logger from "../util/logger.js";

// Tien trong DB la bigint (VND, so nguyen). Driver pg mac dinh tra bigint ve
// dang string de khong mat chinh xac voi so > 2^53. Tien cua app nay khong bao
// gio vuot 2^53 nen parse ve Number, neu khong JSON se co "amount": "65000"
// va Gson phia Android se nem loi vi Order.amount la double.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number.parseInt(value, 10));

// NUMERIC cung tra ve string (avg_rating trong view food_ratings)
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number.parseFloat(value));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.parseInt(process.env.PG_POOL_MAX || "10", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Neon va phan lon dich vu Postgres quan ly deu bat buoc TLS, va dung CA cong
  // khai nen XAC MINH duoc chung chi. Khong dat rejectUnauthorized: false -
  // lam vay la ma hoa duong truyen nhung van bi MITM, vo nghia voi app co
  // thanh toan. PGSSL=disable chi danh cho Postgres local khong co TLS.
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
});

pool.on("error", (error) => {
  // Loi tren connection dang idle trong pool, khong gan voi request nao
  logger.error("Postgres pool error:", error.message);
});

export const query = (text, params) => pool.query(text, params);

// Chay fn trong mot transaction. Dung cho moi thao tac ghi lien quan den tien:
// dat hang (tru ton kho + tao don + tao thong bao) va xu ly callback VNPay
// (ghi ledger + cap nhat don). Transaction o day co y de NHIN THAY duoc trong
// code, khong an sau ORM.
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error("Rollback failed:", rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

export const connectDB = async () => {
  if (!process.env.DATABASE_URL) {
    logger.error("DATABASE_URL chua duoc cau hinh");
    process.exit(1);
  }
  try {
    const { rows } = await pool.query("SELECT current_database() AS db");
    logger.info(`PostgreSQL connected (${rows[0].db})`);
  } catch (error) {
    logger.error("PostgreSQL connection error:", error.message);
    process.exit(1);
  }
};

// Dung cho GET /api/health - giu nguyen hop dong 200/503 nhu ban Mongo
export const isDbReady = async () => {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};

export const closeDB = () => pool.end();

export default { query, withTransaction, connectDB, isDbReady, closeDB };
