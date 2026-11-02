// Doi soat thanh toan VNPay: liet ke nhung truong hop tien va trang thai don
// khong khop nhau. Chay dinh ky (cron) hoac khi khach khieu nai:
//
//   npm run reconcile
//
// Thoat voi ma 1 neu co van de, de cron / CI co the canh bao.
//
// Luu y: script chi thay nhung gi DA ghi vao bang payments. Giao dich bi
// tu choi truoc khi ghi ledger (sai chu ky, sai so tien) can doi chieu them
// voi sao ke / API truy van giao dich cua VNPay.
import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("Thieu DATABASE_URL trong .env");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
});
await client.connect();

// 1. Giao dich thanh cong trong ledger ma don KHONG o trang thai paid
const paidButNotRecorded = await client.query(`
  SELECT p.order_id, p.vnp_transaction_no, p.vnp_amount / 100 AS amount_vnd, p.created_at,
         o.status, o.payment_status, o.refund_required
  FROM payments p JOIN orders o ON o.id = p.order_id
  WHERE p.vnp_response_code = '00'
    AND (p.vnp_transaction_status IS NULL OR p.vnp_transaction_status = '00')
    AND o.payment_status NOT IN ('paid', 'refunded')
  ORDER BY p.created_at DESC`);

// 2. Don da duoc danh dau can hoan tien nhung chua hoan
const refundPending = await client.query(`
  SELECT id AS order_id, amount, status, payment_status, updated_at
  FROM orders
  WHERE refund_required AND payment_status <> 'refunded'
  ORDER BY updated_at DESC`);

// 3. Don co nhieu hon mot giao dich thanh cong (khach tra hai lan)
const paidTwice = await client.query(`
  SELECT order_id, count(*)::int AS successful_payments
  FROM payments
  WHERE vnp_response_code = '00'
    AND (vnp_transaction_status IS NULL OR vnp_transaction_status = '00')
  GROUP BY order_id HAVING count(*) > 1`);

const sections = [
  ["Giao dich thanh cong nhung don chua paid", paidButNotRecorded.rows],
  ["Don can hoan tien (refund_required)", refundPending.rows],
  ["Don co hon mot giao dich thanh cong", paidTwice.rows],
];

let problems = 0;
for (const [title, rows] of sections) {
  console.log(`\n== ${title}: ${rows.length}`);
  if (rows.length > 0) console.table(rows);
  problems += rows.length;
}

await client.end();
console.log(problems === 0 ? "\nKhong co sai lech." : `\nCo ${problems} muc can xu ly.`);
process.exit(problems === 0 ? 0 : 1);
