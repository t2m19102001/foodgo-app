// Doi soat thanh toan VNPay: liet ke nhung truong hop tien va trang thai don
// khong khop nhau. Chay dinh ky (cron) hoac khi khach khieu nai:
//
//   npm run reconcile
//
// Thoat voi ma 1 neu co van de, de cron / CI co the canh bao. Logic doi soat
// dung chung voi cron noi bo trong server.js - xem util/reconciliation.js.
//
// Luu y: script chi thay nhung gi DA ghi vao bang payments. Giao dich bi
// tu choi truoc khi ghi ledger (sai chu ky, sai so tien) can doi chieu them
// voi sao ke / API truy van giao dich cua VNPay.
import "dotenv/config";
import { closeDB } from "../db/index.js";
import { findPaymentDiscrepancies } from "../util/reconciliation.js";

if (!process.env.DATABASE_URL) {
  console.error("Thieu DATABASE_URL trong .env");
  process.exit(1);
}

const { paidButNotRecorded, refundPending, paidTwice } = await findPaymentDiscrepancies();

const sections = [
  ["Giao dich thanh cong nhung don chua paid", paidButNotRecorded],
  ["Don can hoan tien (refund_required)", refundPending],
  ["Don co hon mot giao dich thanh cong", paidTwice],
];

let problems = 0;
for (const [title, rows] of sections) {
  console.log(`\n== ${title}: ${rows.length}`);
  if (rows.length > 0) console.table(rows);
  problems += rows.length;
}

await closeDB();
console.log(problems === 0 ? "\nKhong co sai lech." : `\nCo ${problems} muc can xu ly.`);
process.exit(problems === 0 ? 0 : 1);
