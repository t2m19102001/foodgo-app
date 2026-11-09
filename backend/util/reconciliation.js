// Doi soat thanh toan: 3 loai lech giua bang payments/orders. Dung lai boi
// scripts/reconcile-payments.mjs (chay tay / "npm run reconcile") VA server.js
// (cron noi bo, chay dinh ky de khong ai phai nho chay tay - xem server.js).
import { query } from "../db/index.js";

export const findPaymentDiscrepancies = async () => {
  // 1. Giao dich thanh cong trong ledger ma don KHONG o trang thai paid
  const paidButNotRecorded = await query(`
    SELECT p.order_id, p.vnp_transaction_no, p.vnp_amount / 100 AS amount_vnd, p.created_at,
           o.status, o.payment_status, o.refund_required
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.vnp_response_code = '00'
      AND (p.vnp_transaction_status IS NULL OR p.vnp_transaction_status = '00')
      AND o.payment_status NOT IN ('paid', 'refunded')
    ORDER BY p.created_at DESC`);

  // 2. Don da duoc danh dau can hoan tien nhung chua hoan
  const refundPending = await query(`
    SELECT id AS order_id, amount, status, payment_status, updated_at
    FROM orders
    WHERE refund_required AND payment_status <> 'refunded'
    ORDER BY updated_at DESC`);

  // 3. Don co nhieu hon mot giao dich thanh cong (khach tra hai lan)
  const paidTwice = await query(`
    SELECT order_id, count(*)::int AS successful_payments
    FROM payments
    WHERE vnp_response_code = '00'
      AND (vnp_transaction_status IS NULL OR vnp_transaction_status = '00')
    GROUP BY order_id HAVING count(*) > 1`);

  return {
    paidButNotRecorded: paidButNotRecorded.rows,
    refundPending: refundPending.rows,
    paidTwice: paidTwice.rows,
  };
};

export default { findPaymentDiscrepancies };
