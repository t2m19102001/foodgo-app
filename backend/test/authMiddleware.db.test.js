// middleware/auth.js truoc day khong co test nao, du no la cua ngo phan quyen
// cua toan bo API.
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse, makeUser,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";

const skip = hasDb ? false : dbMissingReason;
let auth;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  auth = await import("../middleware/auth.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
after(async () => { if (hasDb) await closeDb(); });

const tokenFor = (id, { isAdmin = false, tokenVersion = 0, expiresIn = "7d" } = {}) =>
  jwt.sign({ id, isAdmin, tokenVersion }, process.env.JWT_SECRET, { expiresIn });

const callAuth = async (headers) => {
  const req = { headers };
  const res = makeResponse();
  let passed = false;
  await auth.authMiddleware(req, res, () => { passed = true; });
  return { req, res, passed };
};

test("khong co token -> 401", { skip }, async () => {
  const { res, passed } = await callAuth({});
  assert.equal(res.statusCode, 401);
  assert.equal(passed, false);
});

test("token rac hoac ky bang secret khac -> 401", { skip }, async () => {
  const userId = await makeUser();
  for (const token of [
    "khong-phai-jwt",
    jwt.sign({ id: userId }, "secret-khac-hoan-toan-0123456789012345"),
    tokenFor(userId, { expiresIn: "-1s" }),
  ]) {
    const { res, passed } = await callAuth({ authorization: `Bearer ${token}` });
    assert.equal(res.statusCode, 401);
    assert.equal(passed, false);
  }
});

test("token hop le nhung user da bi xoa -> 401", { skip }, async () => {
  const userId = await makeUser();
  const token = tokenFor(userId);
  await db.query("DELETE FROM users WHERE id = $1", [userId]);

  const { res, passed } = await callAuth({ authorization: `Bearer ${token}` });
  assert.equal(res.statusCode, 401);
  assert.equal(passed, false);
});

test("tai khoan bi khoa -> 403 ke ca khi token con han", { skip }, async () => {
  const userId = await makeUser({ isActive: false });
  const { res, passed } = await callAuth({ authorization: `Bearer ${tokenFor(userId)}` });
  assert.equal(res.statusCode, 403);
  assert.equal(passed, false);
});

test("token_version cu -> 401 (doi mat khau lam token cu het hieu luc)", { skip }, async () => {
  const userId = await makeUser();
  const oldToken = tokenFor(userId, { tokenVersion: 0 });
  await db.query("UPDATE users SET token_version = 1 WHERE id = $1", [userId]);

  const { res, passed } = await callAuth({ authorization: `Bearer ${oldToken}` });
  assert.equal(res.statusCode, 401);
  assert.equal(passed, false);
});

test("isAdmin duoc doc tu DB chu khong tin payload token", { skip }, async () => {
  const userId = await makeUser({ isAdmin: false });
  // Token tu nhan la admin, nhung DB noi khong phai
  const lyingToken = tokenFor(userId, { isAdmin: true });

  const { req, passed } = await callAuth({ authorization: `Bearer ${lyingToken}` });
  assert.equal(passed, true, "token hop le nen qua duoc authMiddleware");
  assert.equal(req.user.isAdmin, false, "quyen admin phai lay tu DB");

  // Nen requireAdmin van chan lai
  const res = makeResponse();
  let reachedHandler = false;
  auth.requireAdmin(req, res, () => { reachedHandler = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(reachedHandler, false);
});

test("thu quyen admin co hieu luc tuc thi, khong can doi token het han", { skip }, async () => {
  const userId = await makeUser({ isAdmin: true });
  const token = tokenFor(userId, { isAdmin: true });

  const before = await callAuth({ authorization: `Bearer ${token}` });
  assert.equal(before.req.user.isAdmin, true);

  await db.query("UPDATE users SET is_admin = false WHERE id = $1", [userId]);

  const after = await callAuth({ authorization: `Bearer ${token}` });
  assert.equal(after.req.user.isAdmin, false, "cung token do, nhung quyen da bi thu");
});

test("nhan token qua header 'token' ngoai 'Authorization: Bearer'", { skip }, async () => {
  const userId = await makeUser();
  const { req, passed } = await callAuth({ token: tokenFor(userId) });
  assert.equal(passed, true);
  assert.equal(req.userId, userId);
});

test("adminMiddleware la chuoi hai middleware chay noi tiep", { skip }, async () => {
  // Ban Mongo goi long authMiddleware roi truyen callback lam next - chay duoc
  // nhung neu authMiddleware throw ngoai try/catch thi request treo.
  assert.ok(Array.isArray(auth.adminMiddleware));
  assert.equal(auth.adminMiddleware.length, 2);

  const adminId = await makeUser({ isAdmin: true });
  const req = { headers: { authorization: `Bearer ${tokenFor(adminId, { isAdmin: true })}` } };
  const res = makeResponse();
  const [first, second] = auth.adminMiddleware;

  let reachedHandler = false;
  await first(req, res, () => second(req, res, () => { reachedHandler = true; }));
  assert.equal(reachedHandler, true, "admin that phai di toi handler");
});

test("loi DB khi xac thuc -> 503, KHONG phai 401 (app khong xoa phien dang nhap)", { skip }, async () => {
  const userId = await makeUser();
  const token = tokenFor(userId);
  // Gia lap DB mat ket noi dung luc middleware doc users
  const original = db.default.query;
  db.default.query = async () => { throw new Error("Connection terminated unexpectedly"); };
  try {
    const { res, passed } = await callAuth({ authorization: `Bearer ${token}` });
    assert.equal(res.statusCode, 503);
    assert.equal(passed, false);
  } finally {
    db.default.query = original;
  }

  // DB song lai thi cung token do van dung duoc - phien chua bao gio bi huy
  const { passed } = await callAuth({ authorization: `Bearer ${token}` });
  assert.equal(passed, true);
});

test("token ky dung secret nhung id khong phai uuid -> 401, khong cham DB", { skip }, async () => {
  const { res, passed } = await callAuth({ authorization: `Bearer ${tokenFor("khong-phai-uuid")}` });
  assert.equal(res.statusCode, 401);
  assert.equal(passed, false);
});

test("tai khoan da xoa (deleted_at) -> 401", { skip }, async () => {
  const userId = await makeUser();
  await db.query("UPDATE users SET deleted_at = now() WHERE id = $1", [userId]);
  const { res, passed } = await callAuth({ authorization: `Bearer ${tokenFor(userId)}` });
  assert.equal(res.statusCode, 401);
  assert.equal(passed, false);
});
