// Thong ke doanh thu 7 ngay - phan de sai nhat cua man admin: RANH GIOI NGAY.
//
// Query duoc go lai tu "boc ham quanh cot created_at" sang "chan khoang tren
// created_at" de dung duoc index (100.8 ms -> 9.3 ms tren 100.000 don). Viec go
// lai nay chi dung khi moc ngay van tinh theo gio Viet Nam. Neu ai sau nay doi
// khoang sang UTC cho "gon", don buoi toi se bi day sang ngay hom sau va bao
// cao doanh thu lech ngay - bo test nay ton tai de chan dung viec do.
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeUser, TEST_DB_URL,
} from "./helpers/db.mjs";

const skip = hasDb ? false : dbMissingReason;
let db;
let orders;
let userId;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  orders = await import("../db/orders.js");
});
beforeEach(async () => {
  if (!hasDb) return;
  await resetDb();
  userId = await makeUser({ email: "stats@test.local" });
});
after(async () => { if (hasDb) await closeDb(); });

// Tao don tai mot thoi diem chinh xac theo GIO VIET NAM: daysAgo ngay truoc
// hom nay (gio VN), vao dung gio timeOfDay. Moc ngay duoc Postgres tinh nen
// test khong phu thuoc mui gio cua may dang chay.
const makeOrderAt = async ({
  daysAgo, timeOfDay = "12:00:00", status = "delivered",
  paymentMethod = "cod", paymentStatus = "unpaid", amount = 100000,
}) => {
  const { rows } = await db.query(
    `INSERT INTO orders (user_id, amount, ship_full_name, ship_phone, ship_address,
                         payment_method, payment_status, status, created_at)
     VALUES ($1, $2, 'Khach', '0900000000', 'HN', $3, $4, $5,
             (((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - make_interval(days => $6::int))
               + $7::interval) AT TIME ZONE 'Asia/Ho_Chi_Minh')
     RETURNING id, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS vn_date`,
    [userId, amount, paymentMethod, paymentStatus, status, daysAgo, timeOfDay]
  );
  return rows[0];
};

const revenueByDate = async () => {
  const { dayRows } = await orders.readOrderStats();
  return Object.fromEntries(dayRows.map((r) => [r.date, { revenue: Number(r.revenue), count: r.count }]));
};

const vnDateDaysAgo = async (daysAgo) => {
  const { rows } = await db.query(
    `SELECT to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - make_interval(days => $1::int),
                    'YYYY-MM-DD') AS d`,
    [daysAgo]
  );
  return rows[0].d;
};

test("luon tra ve dung 7 ngay, ke ca ngay khong co don", { skip }, async () => {
  const byDate = await revenueByDate();
  assert.equal(Object.keys(byDate).length, 7);
  for (let i = 0; i <= 6; i += 1) {
    const date = await vnDateDaysAgo(i);
    assert.deepEqual(byDate[date], { revenue: 0, count: 0 }, `ngay ${date} phai co mat voi 0`);
  }
});

test("don 23:59:59 va 00:00:00 gio VN thuoc dung ngay cua no, khong bi UTC day lech", { skip }, async () => {
  // 23:59:59 ngay (hom nay - 2) gio VN = 16:59:59 cung ngay gio UTC
  // 00:00:00 ngay (hom nay - 1) gio VN = 17:00:00 ngay truoc do gio UTC
  // Neu group theo UTC thi ca hai don se bi gom sai ngay.
  await makeOrderAt({ daysAgo: 2, timeOfDay: "23:59:59", amount: 111000 });
  await makeOrderAt({ daysAgo: 1, timeOfDay: "00:00:00", amount: 222000 });

  const byDate = await revenueByDate();
  assert.deepEqual(byDate[await vnDateDaysAgo(2)], { revenue: 111000, count: 1 });
  assert.deepEqual(byDate[await vnDateDaysAgo(1)], { revenue: 222000, count: 1 });
});

test("hai dau cua cua so 7 ngay: 00:00:00 ngay thu 7 vao, 23:59:59 ngay thu 8 ra", { skip }, async () => {
  const trong = await makeOrderAt({ daysAgo: 6, timeOfDay: "00:00:00", amount: 333000 });
  await makeOrderAt({ daysAgo: 7, timeOfDay: "23:59:59", amount: 999000 });
  // Cuoi ngay hom nay cung phai vao
  await makeOrderAt({ daysAgo: 0, timeOfDay: "23:59:59", amount: 444000 });

  const byDate = await revenueByDate();
  assert.deepEqual(byDate[trong.vn_date.toISOString().slice(0, 10)] ?? byDate[await vnDateDaysAgo(6)],
    { revenue: 333000, count: 1 }, "don dau cua so phai duoc tinh");
  assert.deepEqual(byDate[await vnDateDaysAgo(0)], { revenue: 444000, count: 1 });

  const tong = Object.values(byDate).reduce((s, v) => s + v.revenue, 0);
  assert.equal(tong, 333000 + 444000, "don ngoai cua so (999000) khong duoc lot vao");
});

test("chi tinh don da giao va da thuc nhan tien", { skip }, async () => {
  await makeOrderAt({ daysAgo: 1, amount: 100000, status: "delivered", paymentMethod: "cod" });
  await makeOrderAt({ daysAgo: 1, amount: 200000, status: "delivered", paymentMethod: "vnpay", paymentStatus: "paid" });
  // Khong duoc tinh:
  await makeOrderAt({ daysAgo: 1, amount: 400000, status: "delivered", paymentMethod: "vnpay", paymentStatus: "unpaid" });
  await makeOrderAt({ daysAgo: 1, amount: 800000, status: "pending", paymentMethod: "cod" });
  await makeOrderAt({ daysAgo: 1, amount: 1600000, status: "cancelled", paymentMethod: "cod" });

  const byDate = await revenueByDate();
  assert.deepEqual(byDate[await vnDateDaysAgo(1)], { revenue: 300000, count: 2 });
});

// Day la test QUAN TRONG NHAT file nay, va la ly do bo test ban dau vo dung.
//
// Postgres suy ra mui gio cho mot timestamp khong mui gio theo TimeZone cua
// SESSION. Postgres tren may dev thua TimeZone cua may (Asia/Ho_Chi_Minh) con
// Neon chay UTC. Nghia la mot query bo mat buoc doi mui gio tuong minh van cho
// ket qua DUNG tren may dev va LECH 7 TIENG tren production - loai loi te nhat,
// vi test xanh het.
//
// Nen cau SQL THAT duoc chay tren mot client co TimeZone bi ep, lan luot qua
// may mui gio. Ket qua phai y nhu nhau: query khong duoc phu thuoc session.
// Mot ket noi RIENG chu khong dung pool cua db/index.js: SET TimeZone chi co
// hieu luc tren dung ket noi do, con pool.query() co the roi vao bat ky ket noi
// nao trong pool.
const runSqlWithTimeZone = async (timeZone, sql) => {
  const client = new pg.Client({ connectionString: TEST_DB_URL, ssl: false });
  await client.connect();
  try {
    await client.query(`SET TimeZone = '${timeZone}'`);
    const { rows } = await client.query(sql);
    return rows.map((r) => ({ date: r.date, revenue: Number(r.revenue), count: r.count }));
  } finally {
    await client.end();
  }
};

test("doanh thu 7 ngay khong doi theo TimeZone cua session", { skip }, async () => {
  // Rai don quanh cac moc de ranh gioi ngay co y nghia
  for (const daysAgo of [0, 1, 6, 7]) {
    for (const timeOfDay of ["00:00:00", "03:00:00", "16:59:59", "17:00:00", "23:59:59"]) {
      await makeOrderAt({ daysAgo, timeOfDay, amount: 10000 });
    }
  }

  const { REVENUE_LAST_7_DAYS_SQL } = orders;
  const vn = await runSqlWithTimeZone("Asia/Ho_Chi_Minh", REVENUE_LAST_7_DAYS_SQL);
  const utc = await runSqlWithTimeZone("UTC", REVENUE_LAST_7_DAYS_SQL);
  const ny = await runSqlWithTimeZone("America/New_York", REVENUE_LAST_7_DAYS_SQL);
  const kiritimati = await runSqlWithTimeZone("Pacific/Kiritimati", REVENUE_LAST_7_DAYS_SQL);

  assert.ok(vn.some((r) => r.revenue > 0), "du lieu test phai co doanh thu");
  assert.deepEqual(utc, vn, "TimeZone=UTC (nhu Neon) phai cho ket qua y nhu +07");
  assert.deepEqual(ny, vn, "TimeZone=America/New_York phai cho ket qua y nhu +07");
  assert.deepEqual(kiritimati, vn, "TimeZone=Pacific/Kiritimati (+14) phai cho ket qua y nhu +07");
});

// Cai chot cuoi: giu nguyen van cau SQL CU lam ban doi chieu. Hai cach phai cho
// ket qua giong nhau tren moi du lieu. Neu ai go lai query moi va lam lech ngay,
// test nay fail ngay - con neu luat nghiep vu that su doi thi CA HAI cau o day
// phai duoc sua, va viec phai sua ca hai la co y.
test("cach chan khoang cho ket qua y het cach boc ham quanh cot", { skip }, async () => {
  for (const daysAgo of [0, 1, 3, 6, 7, 8]) {
    for (const timeOfDay of ["00:00:00", "06:30:00", "16:59:59", "17:00:00", "23:59:59"]) {
      await makeOrderAt({ daysAgo, timeOfDay, amount: 10000 + daysAgo * 1000 });
      await makeOrderAt({
        daysAgo, timeOfDay, amount: 20000, paymentMethod: "vnpay", paymentStatus: "paid",
      });
      await makeOrderAt({
        daysAgo, timeOfDay, amount: 40000, paymentMethod: "vnpay", paymentStatus: "unpaid",
      });
    }
  }

  const { rows: cu } = await db.query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
            COALESCE(sum(o.amount), 0)::bigint AS revenue,
            count(o.id)::int AS count
     FROM generate_series(
            (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - interval '6 days',
            (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
            interval '1 day') AS d(day)
     LEFT JOIN orders o
            ON o.status = 'delivered'
           AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.day
           AND (o.payment_method <> 'vnpay' OR o.payment_status = 'paid')
     GROUP BY d.day ORDER BY d.day`
  );

  const { dayRows: moi } = await orders.readOrderStats();

  const chuanHoa = (rows) => rows.map((r) => ({
    date: r.date, revenue: Number(r.revenue), count: r.count,
  }));
  assert.deepEqual(chuanHoa(moi), chuanHoa(cu));
  // Co du lieu that de so sanh co nghia, khong phai 7 ngay toan so 0
  assert.ok(chuanHoa(moi).some((r) => r.revenue > 0), "du lieu test phai co doanh thu");
});
