// Smoke test end-to-end: goi API that vao server dang chay + PostgreSQL trong .env.
//
//   cd backend && npm start           (terminal 1 - nen khoi dong lai de reset bo dem rate limit)
//   cd backend && npm run test:e2e    (terminal 2)
//
// Du lieu test deu co tien to "e2e-"/"E2E " va duoc xoa sach o cuoi, ke ca khi co
// buoc fail - ke ca anh da upload (ban truoc chi xoa ban ghi DB nen moi lan chay
// de lai ~8 file mo coi trong uploads/).
import "dotenv/config";
import pg from "pg";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "../util/uploadFile.js";
import crypto_node from "node:crypto";
import querystring from "node:querystring";
import { verifySignature } from "../util/vnpay.js";

// Ky giong thuat toan VNPay de gia lap callback hop le (duoc doi chieu lai bang verifySignature cua chinh backend)
const signVnpay = (params) => {
  const sorted = {};
  for (const key of Object.keys(params).sort()) {
    sorted[key] = encodeURIComponent(String(params[key])).replace(/%20/g, "+");
  }
  const data = querystring.stringify(sorted, undefined, undefined, { encodeURIComponent: (v) => v });
  return crypto_node.createHmac("sha512", process.env.VNPAY_HASH_SECRET).update(Buffer.from(data, "utf-8")).digest("hex");
};

// Script nay GHI du lieu that va cap quyen admin truc tiep trong DB. Ban truoc
// khong co guard nao: neu .env dang tro vao DB production thi no xoa du lieu that.
const DB_URL = process.env.DATABASE_URL || "";
if (!DB_URL) {
  console.error("Thieu DATABASE_URL trong .env");
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1|_test|foodgo_test/.test(DB_URL) && process.env.E2E_CONFIRM !== "1") {
  console.error("DATABASE_URL khong tro vao localhost hoac *_test.");
  console.error("Script nay ghi du lieu that va tu cap quyen admin trong DB.");
  console.error("Neu chac chan, chay lai voi E2E_CONFIRM=1");
  process.exit(1);
}

const db = new pg.Client({
  connectionString: DB_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
});
let dbConnected = false;
const sql = async (text, params) => {
  if (!dbConnected) { await db.connect(); dbConnected = true; }
  return db.query(text, params);
};

const BASE = process.env.E2E_BASE || "http://localhost:5000";
const STAMP = Date.now();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64");

let passed = 0, failed = 0;
const fails = [];
const check = (name, ok, detail = "") => {
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; fails.push(name); console.log(`  FAIL ${name} ${detail}`); }
};
const section = (title) => console.log(`\n== ${title}`);

const api = async (method, path, { token, json, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 120) }; }
  return { status: res.status, body: parsed, headers: res.headers };
};

const imageForm = (fields) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  form.append("image", new Blob([PNG], { type: "image/png" }), "e2e.png");
  return form;
};

const created = { users: [], categories: [], foods: [], orders: [], reviews: [], addresses: [] };

const run = async () => {
  section("Health & hardening");
  const health = await api("GET", "/api/health");
  check("health tra 200 va database connected", health.status === 200 && health.body.database === "connected", JSON.stringify(health.body));
  check("helmet gan X-Content-Type-Options", health.headers.get("x-content-type-options") === "nosniff");
  const cors = await fetch(`${BASE}/api/food`, { headers: { Origin: "http://evil.example.com" } });
  check("CORS tu choi origin la", cors.headers.get("access-control-allow-origin") === null);
  check("khong co token -> 401", (await api("GET", "/api/auth/profile")).status === 401);

  section("Dang ky / dang nhap");
  const custEmail = `e2e-${STAMP}-cust@example.local`;
  const adminEmail = `e2e-${STAMP}-admin@example.local`;
  const reg1 = await api("POST", "/api/auth/register", { json: { name: "E2E Khach", email: custEmail, password: "matkhau123", phone: "0900000001" } });
  const reg2 = await api("POST", "/api/auth/register", { json: { name: "E2E Admin", email: adminEmail, password: "matkhau123" } });
  check("dang ky khach -> 201 + token", reg1.status === 201 && !!reg1.body.token, JSON.stringify(reg1.body));
  check("dang ky admin -> 201 + token", reg2.status === 201 && !!reg2.body.token);
  created.users.push(reg1.body.userId, reg2.body.userId);
  check("email trung -> 400", (await api("POST", "/api/auth/register", { json: { name: "x", email: custEmail, password: "matkhau123" } })).status === 400);
  check("email sai dinh dang -> 400", (await api("POST", "/api/auth/register", { json: { name: "x", email: "khong-phai-email", password: "matkhau123" } })).status === 400);
  check("mat khau ngan -> 400", (await api("POST", "/api/auth/register", { json: { name: "x", email: `e2e-${STAMP}-s@example.local`, password: "123" } })).status === 400);

  // Cap quyen admin truc tiep trong DB (dung nhu huong dan trong README)
  await sql("UPDATE users SET is_admin = true WHERE email = $1", [adminEmail]);
  const adminLogin = await api("POST", "/api/auth/login", { json: { email: adminEmail, password: "matkhau123" } });
  const custLogin = await api("POST", "/api/auth/login", { json: { email: custEmail, password: "matkhau123" } });
  check("dang nhap admin tra isAdmin = true", adminLogin.status === 200 && adminLogin.body.isAdmin === true, JSON.stringify(adminLogin.body));
  check("dang nhap khach tra isAdmin = false", custLogin.status === 200 && custLogin.body.isAdmin === false);
  const admin = adminLogin.body.token;
  let cust = custLogin.body.token;
  check("sai mat khau -> 401", (await api("POST", "/api/auth/login", { json: { email: custEmail, password: "sai-roi" } })).status === 401);
  check("khach goi API admin -> 403", (await api("GET", "/api/order/list", { token: cust })).status === 403);

  section("Ho so");
  const profile = await api("GET", "/api/auth/profile", { token: cust });
  check("xem ho so khong tra ve password", profile.status === 200 && profile.body.user.password === undefined);
  const updated = await api("PUT", "/api/auth/profile", { token: cust, form: imageForm({ name: "E2E Khach Moi", phone: "0900000009" }) });
  check("cap nhat ho so + upload anh", updated.status === 200 && updated.body.user.name === "E2E Khach Moi" && !!updated.body.user.image, JSON.stringify(updated.body).slice(0, 150));

  section("Danh muc & mon an (admin)");
  const catName = `E2E Danh muc ${STAMP}`;
  const cat = await api("POST", "/api/category", { token: admin, form: imageForm({ name: catName }) });
  check("them danh muc -> 201", cat.status === 201, JSON.stringify(cat.body).slice(0, 150));
  created.categories.push(cat.body.category?._id);
  check("khach them danh muc -> 403", (await api("POST", "/api/category", { token: cust, form: imageForm({ name: "x" }) })).status === 403);

  const food = await api("POST", "/api/food", { token: admin, form: imageForm({ name: `E2E Com tam ${STAMP}`, description: "mon test", price: 45000, category: catName }) });
  check("them mon -> 201", food.status === 201, JSON.stringify(food.body).slice(0, 150));
  const foodId = food.body.food?._id;
  created.foods.push(foodId);
  check("them mon voi danh muc khong ton tai -> 400",
    (await api("POST", "/api/food", { token: admin, form: imageForm({ name: "x", price: 1, category: "khong-ton-tai" }) })).status === 400);
  check("them mon thieu anh -> 400", (await api("POST", "/api/food", { token: admin, json: { name: "x", price: 1, category: catName } })).status === 400);

  const list = await api("GET", "/api/food");
  check("danh sach mon giu shape cu (foods array)", list.status === 200 && Array.isArray(list.body.foods) && list.body.foods.length > 0);
  check("danh sach mon co pagination meta", !!list.body.pagination && list.body.pagination.limit === 200, JSON.stringify(list.body.pagination));
  const paged = await api("GET", "/api/food?page=1&limit=2");
  check("phan trang limit=2 tra ve <= 2 mon", paged.status === 200 && paged.body.foods.length <= 2);
  check("limit=999 -> 400", (await api("GET", "/api/food?limit=999")).status === 400);
  check("chi tiet mon", (await api("GET", `/api/food/${foodId}`)).body.food?._id === foodId);
  check("mon theo danh muc", (await api("GET", `/api/food/category/${encodeURIComponent(catName)}`)).body.foods.length === 1);
  check("danh sach danh muc co pagination meta", !!(await api("GET", "/api/category")).body.pagination);

  const offStock = await api("PUT", `/api/food/${foodId}`, { token: admin, form: imageForm({ isAvailable: "false" }) });
  check("tat het hang", offStock.status === 200 && offStock.body.food.isAvailable === false);
  check("dat mon het hang -> 400", (await api("POST", "/api/order", {
    token: cust,
    json: { clientRequestId: crypto.randomUUID(), items: [{ foodId, quantity: 1 }], address: { fullName: "A", phone: "0900000000", address: "1 ABC" } },
  })).status === 400);
  await api("PUT", `/api/food/${foodId}`, { token: admin, form: imageForm({ isAvailable: "true" }) });
  check("isAvailable khong hop le -> 400", (await api("PUT", `/api/food/${foodId}`, { token: admin, form: imageForm({ isAvailable: "maybe" }) })).status === 400);
  // Ban MongoDB tra 409 o day vi foods.category luu TEN danh muc, doi ten la
  // lam mon mo coi. Postgres dung khoa ngoai ON UPDATE CASCADE nen doi ten
  // hoat dong binh thuong va mon van thuoc dung danh muc.
  const renamed = `${catName} doi`;
  check("doi ten danh muc dang co mon -> 200", (await api("PUT", `/api/category/${created.categories[0]}`, { token: admin, form: imageForm({ name: renamed }) })).status === 200);
  const afterRename = await api("GET", `/api/food/category/${encodeURIComponent(renamed)}`);
  check("mon van thuoc danh muc sau khi doi ten", afterRename.status === 200 && afterRename.body.foods.length > 0, JSON.stringify(afterRename.body).slice(0, 120));
  check("doi ten lai ten cu -> 200", (await api("PUT", `/api/category/${created.categories[0]}`, { token: admin, form: imageForm({ name: catName }) })).status === 200);
  check("xoa danh muc dang co mon -> 409", (await api("DELETE", `/api/category/${created.categories[0]}`, { token: admin })).status === 409);

  section("So dia chi");
  const addr = await api("POST", "/api/address", { token: cust, json: { fullName: "E2E Khach", phone: "0900000001", address: "1 Duong ABC", note: "Toa X", isDefault: true } });
  check("them dia chi -> 201", addr.status === 201 || addr.status === 200, JSON.stringify(addr.body).slice(0, 150));
  const addrId = addr.body.address?._id || addr.body.addresses?.[0]?._id;
  created.addresses.push(addrId);
  check("danh sach dia chi cua toi", (await api("GET", "/api/address", { token: cust })).body.addresses?.length >= 1);
  // PUT o day la thay the toan bo (khong phai patch tung field) nen phai gui du fullName/phone/address
  check("sua dia chi (gui du field)", (await api("PUT", `/api/address/${addrId}`, { token: cust, json: { fullName: "E2E Khach", phone: "0900000001", address: "2 Duong XYZ", note: "Toa Y" } })).status === 200);
  check("sua dia chi thieu field -> 400", (await api("PUT", `/api/address/${addrId}`, { token: cust, json: { address: "3 Duong Z" } })).status === 400);
  check("dat dia chi mac dinh", (await api("PUT", `/api/address/${addrId}/default`, { token: cust })).status === 200);
  check("thieu thong tin dia chi -> 400", (await api("POST", "/api/address", { token: cust, json: { fullName: "", phone: "", address: "" } })).status === 400);

  section("Dat hang & idempotency");
  const requestId = crypto.randomUUID();
  const orderPayload = {
    clientRequestId: requestId,
    paymentMethod: "cod",
    items: [{ foodId, quantity: 2, price: 1 }],
    address: { fullName: "E2E Khach", phone: "0900000001", address: "2 Duong XYZ" },
  };
  const order1 = await api("POST", "/api/order", { token: cust, json: orderPayload });
  check("dat hang -> 201", order1.status === 201, JSON.stringify(order1.body).slice(0, 200));
  check("don COD khong qua cong thanh toan nen khong co payUrl", order1.body.payUrl === undefined);
  const orderId = order1.body.orderId || order1.body.order?._id;
  created.orders.push(orderId);
  check("server tu tinh tien (2 x 45000), bo qua price client gui", order1.body.order?.amount === 90000, String(order1.body.order?.amount));
  const replay = await api("POST", "/api/order", { token: cust, json: orderPayload });
  check("gui lai cung clientRequestId -> 200 va cung orderId", replay.status === 200 && (replay.body.orderId || replay.body.order?._id) === orderId);
  const concurrent = await Promise.all([1, 2, 3].map(() => api("POST", "/api/order", {
    token: cust, json: { ...orderPayload, clientRequestId: `${requestId}-race` },
  })));
  const raceIds = new Set(concurrent.map((r) => r.body.orderId || r.body.order?._id));
  check("3 request dong thoi cung mot ma -> chi 1 don", raceIds.size === 1, [...raceIds].join(","));
  created.orders.push([...raceIds][0]);
  check("do don theo clientRequestId", (await api("GET", `/api/order/request/${requestId}`, { token: cust })).status === 200);
  check("dat hang thieu dia chi -> 400", (await api("POST", "/api/order", { token: cust, json: { clientRequestId: crypto.randomUUID(), items: [{ foodId, quantity: 1 }] } })).status === 400);
  check("don cua toi (loc trang thai pending)", (await api("GET", "/api/order/my?page=1&limit=10&status=pending", { token: cust })).body.orders?.length >= 1);
  check("phan trang don khong hop le -> 400", (await api("GET", "/api/order/my?page=0", { token: cust })).status === 400);

  section("Thong bao sau khi dat hang");
  const notif = await api("GET", "/api/notification", { token: cust });
  check("co thong bao dat hang thanh cong + unreadCount", notif.status === 200 && notif.body.unreadCount >= 1, JSON.stringify(notif.body.unreadCount));
  const notifId = notif.body.notifications?.[0]?._id;
  check("danh dau mot thong bao da doc", (await api("PUT", `/api/notification/${notifId}/read`, { token: cust })).status === 200);
  check("nguoi khac danh dau thong bao nay -> 404", (await api("PUT", `/api/notification/${notifId}/read`, { token: admin })).status === 404);
  check("danh dau tat ca da doc", (await api("PUT", "/api/notification/read-all", { token: cust })).status === 200);
  check("unreadCount ve 0", (await api("GET", "/api/notification", { token: cust })).body.unreadCount === 0);

  section("VNPay");
  // Dat hang bang VNPay KHONG tra orderId/order - chi tra payUrl. Day chinh la
  // cho sua bug "bam Dat hang la thay don xuat hien (GET /my) roi moi den man
  // thanh toan": server co giu cho don o phia sau (xem placeOrder) nhung client
  // khong duoc biet no ton tai cho den khi VNPay bao thanh toan thanh cong.
  const vnpRequestId = crypto.randomUUID();
  const vnpPayload = { ...orderPayload, clientRequestId: vnpRequestId, paymentMethod: "vnpay" };
  const vnpOrder = await api("POST", "/api/order", { token: cust, json: vnpPayload });
  check("dat don VNPay -> 200, khong phai 201 (khong co gi duoc 'tao' voi client)",
    vnpOrder.status === 200, JSON.stringify(vnpOrder.body).slice(0, 150));
  check("response KHONG co orderId", vnpOrder.body.orderId === undefined, JSON.stringify(vnpOrder.body).slice(0, 150));
  check("response KHONG co order", vnpOrder.body.order === undefined);
  const payUrl = vnpOrder.body.payUrl || "";
  check("tao payUrl co chu ky", payUrl.includes("vnp_SecureHash="), JSON.stringify(vnpOrder.body).slice(0, 150));
  check("payUrl gui so tien x100 (90.000 -> 9000000)", payUrl.includes("vnp_Amount=9000000"), payUrl.split("vnp_Amount=")[1]?.slice(0, 12));
  const txnRef = new URL(payUrl).searchParams.get("vnp_TxnRef");
  const vnpOrderId = txnRef.slice(0, txnRef.lastIndexOf("-"));
  check("vnp_TxnRef chua orderId", String(txnRef).startsWith(String(vnpOrderId)), String(txnRef));

  // Don co that tren server (admin xem truc tiep duoc qua GET /:id, dung cho
  // doi soat/ho tro) nhung CHUA xuat hien trong danh sach cua ai ca
  check("don VNPay chua thanh toan KHONG hien trong GET /my cua khach",
    !(await api("GET", "/api/order/my", { token: cust })).body.orders.some((o) => o._id === vnpOrderId));
  check("don VNPay chua thanh toan KHONG hien trong GET /list cua admin",
    !(await api("GET", "/api/order/list", { token: admin })).body.orders.some((o) => o._id === vnpOrderId));
  const pendingCheck = await api("GET", `/api/order/request/${vnpRequestId}`, { token: cust });
  check("getOrderByRequestId bao 'dang cho thanh toan', khong lo orderId",
    pendingCheck.status === 200 && pendingCheck.body.paymentPending === true && pendingCheck.body.orderId === undefined,
    JSON.stringify(pendingCheck.body).slice(0, 150));
  const resubmitPending = await api("POST", "/api/order", { token: cust, json: vnpPayload });
  check("gui lai khi chua thanh toan -> DUNG payUrl cu (khong vo hieu giao dich dang chay)",
    resubmitPending.body.payUrl === payUrl, JSON.stringify(resubmitPending.body).slice(0, 150));
  check("payUrl co vnp_ExpireDate", new URL(payUrl).searchParams.has("vnp_ExpireDate"));

  // Chu ky gia: khong duoc cap nhat trang thai thanh toan
  const forged = await api("GET", `/api/order/vnpay/ipn?vnp_TxnRef=${txnRef}&vnp_ResponseCode=00&vnp_SecureHash=deadbeef`);
  check("IPN chu ky gia -> RspCode 97", forged.body.RspCode === "97", JSON.stringify(forged.body));
  const returnForged = await fetch(`${BASE}/api/order/vnpay/return?vnp_TxnRef=${txnRef}&vnp_ResponseCode=00&vnp_SecureHash=deadbeef`);
  check("return chu ky gia -> trang bao khong hop le", (await returnForged.text()).includes("không hợp lệ"));
  check("don van chua thanh toan sau chu ky gia",
    !(await api("GET", "/api/order/my", { token: cust })).body.orders.some((o) => o._id === vnpOrderId));

  // Chu ky that: don chuyen sang paid + confirmed, sinh thong bao, VA xuat hien
  // trong moi danh sach tu bay gio
  const ipnParams = { vnp_TxnRef: txnRef, vnp_ResponseCode: "00", vnp_Amount: "9000000", vnp_TmnCode: process.env.VNPAY_TMN_CODE };
  const ipnQuery = { ...ipnParams, vnp_SecureHash: signVnpay(ipnParams) };
  check("chu ky tu ky duoc backend cong nhan (doi chieu verifySignature)", verifySignature(ipnQuery) === true);
  const ipnOk = await api("GET", `/api/order/vnpay/ipn?${new URLSearchParams(ipnQuery)}`);
  check("IPN hop le -> RspCode 00", ipnOk.body.RspCode === "00", JSON.stringify(ipnOk.body));
  created.orders.push(vnpOrderId);

  const afterPay = await api("GET", "/api/order/my", { token: cust });
  const paidInList = afterPay.body.orders.find((o) => o._id === vnpOrderId);
  check("don VNPay xuat hien trong GET /my NGAY SAU KHI thanh toan xong", !!paidInList, JSON.stringify(afterPay.body.orders?.[0]));
  check("don chuyen sang paid", paidInList?.paymentStatus === "paid", String(paidInList?.paymentStatus));
  check("don tu pending -> confirmed sau khi thanh toan", paidInList?.status === "confirmed", String(paidInList?.status));
  check("co thong bao ket qua thanh toan", (await api("GET", "/api/notification", { token: cust })).body.notifications
    .some((n) => /thanh to/i.test(`${n.title} ${n.message}`)));
  const ipnReplay = await api("GET", `/api/order/vnpay/ipn?${new URLSearchParams(ipnQuery)}`);
  check("IPN goi lai lan 2 (idempotent) -> RspCode 00", ipnReplay.body.RspCode === "00", JSON.stringify(ipnReplay.body));

  const resubmitPaid = await api("POST", "/api/order", { token: cust, json: vnpPayload });
  check("gui lai cung clientRequestId SAU KHI thanh toan -> tra ve don that, khong phai payUrl moi",
    resubmitPaid.status === 200 && resubmitPaid.body.orderId === vnpOrderId && resubmitPaid.body.payUrl === undefined,
    JSON.stringify(resubmitPaid.body).slice(0, 150));

  section("Danh gia (rang buoc nghiep vu)");
  check("danh gia mon chua nhan -> 403", (await api("POST", "/api/review", { token: cust, json: { foodId, rating: 5, comment: "chua mua" } })).status === 403);
  check("rating ngoai 1..5 -> 400", (await api("POST", "/api/review", { token: cust, json: { foodId, rating: 9 } })).status === 400);

  section("Luong trang thai don (admin)");
  check("nhay trang thai pending -> delivered -> 400", (await api("PUT", `/api/order/${orderId}/status`, { token: admin, json: { status: "delivered" } })).status === 400);
  check("khach doi trang thai -> 403", (await api("PUT", `/api/order/${orderId}/status`, { token: cust, json: { status: "confirmed" } })).status === 403);
  for (const status of ["confirmed", "shipped", "delivered"]) {
    const res = await api("PUT", `/api/order/${orderId}/status`, { token: admin, json: { status } });
    check(`chuyen sang ${status}`, res.status === 200, JSON.stringify(res.body).slice(0, 120));
  }
  check("doi lai trang thai cu (da delivered) -> 400/409", [400, 409].includes((await api("PUT", `/api/order/${orderId}/status`, { token: admin, json: { status: "shipped" } })).status));
  check("khach huy don da giao -> 400", (await api("PUT", `/api/order/${orderId}/cancel`, { token: cust, json: { reason: "doi y" } })).status === 400);
  check("moi lan doi trang thai sinh thong bao cho khach", (await api("GET", "/api/notification", { token: cust })).body.unreadCount >= 3);

  section("Danh gia sau khi nhan hang");
  const review = await api("POST", "/api/review", { token: cust, json: { foodId, rating: 5, comment: "E2E ngon" } });
  check("danh gia mon da nhan -> 201", review.status === 201, JSON.stringify(review.body).slice(0, 150));
  const reviewId = review.body.review?._id;
  created.reviews.push(reviewId);
  check("danh gia lan 2 cho cung mon -> 400", (await api("POST", "/api/review", { token: cust, json: { foodId, rating: 4 } })).status === 400);
  check("danh gia hien o trang chi tiet mon", (await api("GET", `/api/review/food/${foodId}`)).body.reviews?.length === 1);
  check("sua danh gia cua minh", (await api("PUT", `/api/review/${reviewId}`, { token: cust, json: { rating: 4, comment: "sua lai" } })).status === 200);
  check("nguoi khac sua danh gia nay -> 403", (await api("PUT", `/api/review/${reviewId}`, { token: admin, json: { rating: 1 } })).status === 403);

  section("Huy don & thong ke");
  const toCancel = await api("POST", "/api/order", {
    token: cust, json: { ...orderPayload, clientRequestId: crypto.randomUUID() },
  });
  const cancelId = toCancel.body.orderId || toCancel.body.order?._id;
  created.orders.push(cancelId);
  check("huy don pending kem ly do", (await api("PUT", `/api/order/${cancelId}/cancel`, { token: cust, json: { reason: "E2E doi y" } })).status === 200);
  const stats = await api("GET", "/api/order/stats", { token: admin });
  check("thong ke co totalRevenue / byStatus / last7Days",
    stats.status === 200 && typeof stats.body.totalRevenue === "number" && stats.body.byStatus?.length === 5 && Array.isArray(stats.body.last7Days),
    JSON.stringify(stats.body).slice(0, 160));
  // Check nay truoc day dang nhap chinh custEmail (CHU DON) roi assert 200, nen
  // mang ten "don cua khach khac khong xem duoc" ma khong bao gio kiem duoc IDOR.
  // Gio dung mot user thu ba that su khong lien quan.
  const outsiderEmail = `e2e-${STAMP}-outsider@example.local`;
  const outsiderReg = await api("POST", "/api/auth/register", { json: { name: "E2E Nguoi la", email: outsiderEmail, password: "matkhau123" } });
  created.users.push(outsiderReg.body.userId);
  const outsider = outsiderReg.body.token;
  const idorAttempt = await api("GET", `/api/order/${orderId}`, { token: outsider });
  check("don cua khach khac KHONG xem duoc (403)", idorAttempt.status === 403, `status=${idorAttempt.status}`);
  check("chu don van xem duoc don cua minh", (await api("GET", `/api/order/${orderId}`, { token: cust })).status === 200);
  check("nguoi la KHONG huy duoc don", (await api("PUT", `/api/order/${orderId}/cancel`, { token: outsider, json: { reason: "x" } })).status === 403);

  section("Doi mat khau lam token cu het hieu luc");
  const changed = await api("PUT", "/api/auth/change-password", { token: cust, json: { oldPassword: "matkhau123", newPassword: "matkhaumoi123" } });
  check("doi mat khau -> 200", changed.status === 200, JSON.stringify(changed.body));
  check("token cu bi tu choi sau khi doi mat khau", (await api("GET", "/api/auth/profile", { token: cust })).status === 401);
  const relogin = await api("POST", "/api/auth/login", { json: { email: custEmail, password: "matkhaumoi123" } });
  check("dang nhap bang mat khau moi", relogin.status === 200 && !!relogin.body.token);
  cust = relogin.body.token;

  section("Rate limit (chay cuoi vi se chan IP 15 phut)");
  let got429 = false, retryAfter = null;
  for (let i = 0; i < 12; i++) {
    const res = await api("POST", "/api/auth/login", { json: { email: custEmail, password: "sai-mat-khau" } });
    if (res.status === 429) { got429 = true; retryAfter = res.headers.get("retry-after"); break; }
  }
  check("dang nhap sai lien tuc -> 429 kem Retry-After", got429 && !!retryAfter, `retry-after=${retryAfter}`);
};

const cleanup = async () => {
  section("Don du lieu test");
  try {
    // Xoa theo tien to e2e-/E2E de don sach ca du lieu con sot tu lan chay truoc.
    // Thu tu quan trong: payments va orders la ON DELETE RESTRICT nen phai go
    // truoc users; reviews/notifications/addresses tu CASCADE theo users.
    const r = {};
    const userIds = (await sql(
      "SELECT id FROM users WHERE email LIKE 'e2e-%'")).rows.map((row) => row.id);

    if (userIds.length) {
      r.payments = (await sql(
        `DELETE FROM payments WHERE order_id IN
           (SELECT id FROM orders WHERE user_id = ANY($1::uuid[]))`, [userIds])).rowCount;
      r.orders = (await sql(
        "DELETE FROM orders WHERE user_id = ANY($1::uuid[])", [userIds])).rowCount;
    }

    // Lay ten anh TRUOC khi xoa ban ghi de con duong xoa file tren dia
    const images = (await sql(
      `SELECT image FROM foods WHERE name LIKE 'E2E %'
       UNION ALL SELECT image FROM categories WHERE name LIKE 'E2E %'
       UNION ALL SELECT image FROM users WHERE email LIKE 'e2e-%'`)).rows
      .map((row) => row.image).filter(Boolean);

    r.foods = (await sql("DELETE FROM foods WHERE name LIKE 'E2E %'")).rowCount;
    r.categories = (await sql("DELETE FROM categories WHERE name LIKE 'E2E %'")).rowCount;
    r.users = (await sql("DELETE FROM users WHERE email LIKE 'e2e-%'")).rowCount;

    // Ban truoc chi xoa ban ghi DB, nen moi lan chay de lai anh mo coi trong
    // uploads/ - README lai noi la "xoa sach".
    let removedImages = 0;
    for (const image of new Set(images)) {
      if (path.basename(image) !== image) continue;
      try {
        await unlink(path.join(uploadsDir, image));
        removedImages += 1;
      } catch { /* file khong con thi bo qua */ }
    }
    r.images = removedImages;

    console.log("  da xoa:", JSON.stringify(r));
  } catch (error) {
    console.log("  LOI khi don du lieu:", error.message);
  } finally {
    if (dbConnected) await db.end().catch(() => {});
  }
};

try {
  await run();
} catch (error) {
  failed++;
  fails.push(`EXCEPTION: ${error.message}`);
  console.log("\n!! Exception:", error.stack?.split("\n").slice(0, 3).join("\n"));
} finally {
  await cleanup();
  console.log(`\n===== KET QUA: ${passed} pass / ${failed} fail =====`);
  if (fails.length) console.log("Fail:", fails.join(" | "));
  process.exit(failed ? 1 : 0);
}
