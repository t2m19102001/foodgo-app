// Kiem chung schema PostgreSQL lam dung nhung gi no hua, tren DB that.
// Khac voi npm test (unit test, mock DB): script nay can mot Postgres dang chay
// va GHI DU LIEU vao DATABASE_URL.
//
//   DATABASE_URL=postgres://... PGSSL=disable node scripts/verify-db.mjs
//
// Moi ban ghi no tao deu mang dau rieng (email @verify.invalid, ten bat dau
// bang __verifydb__) va duoc XOA SACH trong khoi finally, ke ca khi co test
// that bai - de khong lam ban du lieu seed.
//
// No kiem 5 dieu la ly do chuyen tu MongoDB sang Postgres:
//   1. bigint tra ve Number -> JSON khong vo hop dong voi Gson phia Android
//   2. hai don SONG SONG tren mon con 1 suat chi tao 1 don (ban Mongo: ca 2)
//   3. transaction rollback thi khong mat ton kho, khong de lai don mo coi
//   4. don da tra tien phai hoan tien TRUOC moi huy duoc
//   5. nhieu callback VNPay cung mot giao dich chi ghi 1 ban ghi ledger
import "dotenv/config";
import { query, withTransaction, closeDB } from "../db/index.js";

const url = process.env.DATABASE_URL || "";
if (!url) {
  console.error("Thieu DATABASE_URL");
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1|_test|foodgo_test/.test(url) && process.env.VERIFY_DB_CONFIRM !== "1") {
  console.error("DATABASE_URL khong tro vao localhost hoac *_test.");
  console.error("Script nay GHI du lieu that (va tu xoa o cuoi).");
  console.error("Neu chac chan, chay lai voi VERIFY_DB_CONFIRM=1");
  process.exit(1);
}

const TAG = "__verifydb__";
const EMAIL = "verifydb@verify.invalid";

let pass = 0;
let fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${extra ? " -> " + extra : ""}`);
  ok ? (pass += 1) : (fail += 1);
};

const cleanup = async () => {
  // Xoa theo thu tu khoa ngoai. order_items/payments/history deu CASCADE hoac
  // RESTRICT nen phai go truoc khi xoa orders.
  await query(
    `DELETE FROM payments WHERE order_id IN
       (SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id WHERE u.email = $1)`,
    [EMAIL]
  );
  await query(
    `DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
    [EMAIL]
  );
  await query(`DELETE FROM foods WHERE name LIKE $1`, [`${TAG}%`]);
  await query(`DELETE FROM categories WHERE name LIKE $1`, [`${TAG}%`]);
  await query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
};

try {
  await cleanup(); // du lieu con sot tu lan chay truoc bi ngat giua duong

  const u = await query(
    `INSERT INTO users (name, email, password) VALUES ($1, $2, 'x') RETURNING id`,
    [`${TAG} user`, EMAIL]
  );
  const userId = u.rows[0].id;
  const c = await query(`INSERT INTO categories (name) VALUES ($1) RETURNING id`, [`${TAG}cat`]);
  const f = await query(
    `INSERT INTO foods (name, price, image, category_id, stock)
     VALUES ($1, 65000, 'p.jpg', $2, 1) RETURNING id`,
    [`${TAG}Phở bò`, c.rows[0].id]
  );
  const foodId = f.rows[0].id;

  // --- 1. bigint parse ve Number, khong phai string ---
  const pr = await query(`SELECT price FROM foods WHERE id = $1`, [foodId]);
  check(
    "price bigint tra ve Number (Gson can number, khong phai string)",
    typeof pr.rows[0].price === "number",
    `typeof = ${typeof pr.rows[0].price}`
  );

  // --- 2. Oversell duoi dong thoi THAT: 2 transaction song song, stock = 1 ---
  const placeOrder = () =>
    withTransaction(async (client) => {
      const upd = await client.query(
        `UPDATE foods SET stock = stock - 1 WHERE id = $1 AND stock >= 1`,
        [foodId]
      );
      if (upd.rowCount === 0) throw new Error("HET_HANG");
      const o = await client.query(
        `INSERT INTO orders (user_id, amount, ship_full_name, ship_phone, ship_address)
         VALUES ($1, 65000, 'A', '0900', 'HN') RETURNING id`,
        [userId]
      );
      await client.query(
        `INSERT INTO order_items (order_id, food_id, name, price, quantity)
         VALUES ($1, $2, $3, 65000, 1)`,
        [o.rows[0].id, foodId, `${TAG}Phở bò`]
      );
      return o.rows[0].id;
    });

  const results = await Promise.allSettled([placeOrder(), placeOrder()]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r) => r.status === "rejected").length;
  check(
    "2 don song song tren mon con 1 suat -> dung 1 thanh cong",
    ok === 1 && rejected === 1,
    `thanh cong=${ok} that bai=${rejected}`
  );

  const st = await query(`SELECT stock FROM foods WHERE id = $1`, [foodId]);
  check("ton kho khong bao gio am", st.rows[0].stock === 0, `stock=${st.rows[0].stock}`);

  const cnt = await query(
    `SELECT count(*)::int AS n FROM orders WHERE user_id = $1`, [userId]);
  check("chi co 1 don duoc tao (khong co don mo coi)", cnt.rows[0].n === 1, `n=${cnt.rows[0].n}`);

  // --- 3. Rollback: tru kho xong nhung buoc sau loi -> khong mat kho ---
  await query(`UPDATE foods SET stock = 5 WHERE id = $1`, [foodId]);
  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE foods SET stock = stock - 2 WHERE id = $1 AND stock >= 2`, [foodId]);
      throw new Error("loi gia lap sau khi tru kho");
    });
  } catch {
    /* mong doi */
  }
  const st2 = await query(`SELECT stock FROM foods WHERE id = $1`, [foodId]);
  check("rollback hoan lai ton kho", st2.rows[0].stock === 5, `stock=${st2.rows[0].stock}`);

  // --- 4. Duong hoan tien ---
  const o2 = await query(
    `INSERT INTO orders (user_id, amount, ship_full_name, ship_phone, ship_address,
                         payment_method, payment_status)
     VALUES ($1, 65000, 'A', '0900', 'HN', 'vnpay', 'paid') RETURNING id`,
    [userId]
  );
  const paidId = o2.rows[0].id;

  let blocked = false;
  try {
    await query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [paidId]);
  } catch (error) {
    blocked = error.constraint === "orders_paid_not_cancelled";
  }
  check("huy TRUC TIEP don da tra tien bi constraint chan", blocked);

  await query(`UPDATE orders SET payment_status = 'refunded' WHERE id = $1`, [paidId]);
  await query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [paidId]);
  const fin = await query(`SELECT status, payment_status FROM orders WHERE id = $1`, [paidId]);
  check(
    "hoan tien TRUOC roi huy thi duoc",
    fin.rows[0].status === "cancelled" && fin.rows[0].payment_status === "refunded",
    `${fin.rows[0].payment_status}/${fin.rows[0].status}`
  );

  // --- 5. Ledger idempotent duoi dong thoi ---
  const writeLedger = () =>
    query(
      `INSERT INTO payments (order_id, vnp_txn_ref, vnp_transaction_no, source, signature_valid, raw)
       VALUES ($1, 'ref', $2, 'ipn', true, '{}'::jsonb)
       ON CONFLICT (vnp_transaction_no) WHERE vnp_transaction_no IS NOT NULL DO NOTHING
       RETURNING id`,
      [paidId, `${TAG}TXN-1`]
    );
  const led = await Promise.all([writeLedger(), writeLedger(), writeLedger()]);
  const inserted = led.filter((r) => r.rowCount === 1).length;
  check("3 callback song song cung TXN -> dung 1 ban ghi ledger", inserted === 1, `inserted=${inserted}`);

  // --- 6. Tim kiem bo dau tieng Viet, va co dung index ---
  // Gioi han trong mon cua chinh script, vi du lieu seed cung co "Phở bò tái nạm"
  const search = await query(
    `SELECT name FROM foods
     WHERE id = $1 AND vn_unaccent(name) LIKE '%' || vn_unaccent($2) || '%'`,
    [foodId, "PHO BO"]
  );
  check('go "PHO BO" khong dau tim ra "Phở bò"', search.rowCount === 1, `${search.rowCount} ket qua`);

  // Va chac chan no khong phai an may: tu khoa khong lien quan phai ra 0
  const miss = await query(
    `SELECT name FROM foods
     WHERE id = $1 AND vn_unaccent(name) LIKE '%' || vn_unaccent($2) || '%'`,
    [foodId, "banh mi"]
  );
  check('go "banh mi" khong khop thi tra ve rong', miss.rowCount === 0, `${miss.rowCount} ket qua`);

  const plan = await query(
    `EXPLAIN (COSTS OFF) SELECT name FROM foods WHERE vn_unaccent(name) LIKE '%pho%'`);
  const planText = plan.rows.map((r) => r["QUERY PLAN"]).join(" ");
  check(
    "query tim kiem dung index foods_search_idx, khong seq scan",
    planText.includes("foods_search_idx"),
    planText.includes("Seq Scan") ? "dang Seq Scan" : "ok"
  );
} finally {
  await cleanup();
  const left = await query(
    `SELECT (SELECT count(*) FROM users WHERE email = $1)
          + (SELECT count(*) FROM foods WHERE name LIKE $2)
          + (SELECT count(*) FROM categories WHERE name LIKE $2) AS n`,
    [EMAIL, `${TAG}%`]
  );
  console.log(`\nDon dep: con lai ${left.rows[0].n} ban ghi test (ky vong 0)`);
  console.log(`${pass} ok, ${fail} fail`);
  await closeDB();
}

process.exit(fail === 0 ? 0 : 1);
