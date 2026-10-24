import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";

const skip = hasDb ? false : dbMissingReason;
let auth;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  auth = await import("../controllers/authController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
after(async () => { if (hasDb) await closeDb(); });

test("register rejects a bad email and a short password before touching the database", { skip }, async () => {
  const badEmail = makeResponse();
  await auth.registerUser(
    { body: { name: "Man", email: "khong-phai-email", password: "matkhau123" } }, badEmail);
  assert.equal(badEmail.statusCode, 400);

  const shortPassword = makeResponse();
  await auth.registerUser(
    { body: { name: "Man", email: "man@example.com", password: "12345" } }, shortPassword);
  assert.equal(shortPassword.statusCode, 400);

  // Khong co ban ghi nao duoc tao: validate phai chay truoc khi vao DB
  const { rows } = await db.query("SELECT count(*)::int AS n FROM users");
  assert.equal(rows[0].n, 0);
});

test("register stores only a bcrypt hash and returns a token carrying the role", { skip }, async () => {
  const response = makeResponse();
  await auth.registerUser(
    { body: { name: " Man ", email: "Man@Example.COM", password: "matkhau123" } }, response);

  assert.equal(response.statusCode, 201);
  assert.ok(response.body.token);
  assert.equal(response.body.isAdmin, false);

  const { rows } = await db.query("SELECT name, email, password FROM users");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Man", "ten phai duoc trim");
  assert.equal(rows[0].email, "man@example.com", "email phai ha chu thuong");
  assert.notEqual(rows[0].password, "matkhau123", "khong duoc luu mat khau tho");
  assert.ok(rows[0].password.startsWith("$2"), "phai la bcrypt hash");
  assert.ok(await bcrypt.compare("matkhau123", rows[0].password));

  const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
  assert.equal(decoded.isAdmin, false);
  assert.equal(decoded.tokenVersion, 0);
});

test("email trung bi chan boi rang buoc UNIQUE, khong phai boi mot cau SELECT co the bi race", { skip }, async () => {
  const first = makeResponse();
  await auth.registerUser(
    { body: { name: "A", email: "trung@test.local", password: "matkhau123" } }, first);
  assert.equal(first.statusCode, 201);

  // citext nen khac hoa thuong van la trung
  const second = makeResponse();
  await auth.registerUser(
    { body: { name: "B", email: "TRUNG@test.local", password: "matkhau123" } }, second);
  assert.equal(second.statusCode, 400);
  assert.equal(await (async () => (await db.query("SELECT count(*)::int AS n FROM users")).rows[0].n)(), 1);
});

test("login refuses a locked account even when the password is correct", { skip }, async () => {
  const hash = await bcrypt.hash("matkhau123", 10);
  await db.query(
    `INSERT INTO users (name, email, password, is_active)
     VALUES ('Khoa', 'khoa@test.local', $1, false)`, [hash]);

  const response = makeResponse();
  await auth.loginUser({ body: { email: "khoa@test.local", password: "matkhau123" } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.token, undefined);
});

test("login khong tiet lo email co ton tai hay khong", { skip }, async () => {
  const hash = await bcrypt.hash("matkhau123", 10);
  await db.query(
    "INSERT INTO users (name, email, password) VALUES ('A', 'co@test.local', $1)", [hash]);

  const wrongPassword = makeResponse();
  await auth.loginUser({ body: { email: "co@test.local", password: "sai-roi" } }, wrongPassword);

  const noSuchEmail = makeResponse();
  await auth.loginUser({ body: { email: "khong-co@test.local", password: "sai-roi" } }, noSuchEmail);

  // Ban Mongo tra "Email khong ton tai" va "Mat khau khong dung" rieng biet,
  // nen liet ke duoc tai khoan nao co that.
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(noSuchEmail.statusCode, 401);
  assert.equal(wrongPassword.body.message, noSuchEmail.body.message);
  assert.equal(wrongPassword.body.token, undefined);
});

test("changing the password bumps tokenVersion so tokens issued earlier stop working", { skip }, async () => {
  const hash = await bcrypt.hash("matkhaucu", 10);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password, token_version)
     VALUES ('A', 'doi@test.local', $1, 3) RETURNING id`, [hash]);
  const userId = rows[0].id;

  const response = makeResponse();
  await auth.changePassword(
    { userId, body: { oldPassword: "matkhaucu", newPassword: "matkhaumoi" } }, response);
  assert.equal(response.statusCode, 200);

  const after = await db.query("SELECT password, token_version FROM users WHERE id = $1", [userId]);
  assert.equal(after.rows[0].token_version, 4, "token_version phai tang len 1");
  assert.ok(await bcrypt.compare("matkhaumoi", after.rows[0].password));
});

test("a wrong old password leaves the stored password and tokenVersion untouched", { skip }, async () => {
  const hash = await bcrypt.hash("matkhaucu", 10);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password, token_version)
     VALUES ('A', 'sai@test.local', $1, 3) RETURNING id`, [hash]);
  const userId = rows[0].id;

  const response = makeResponse();
  await auth.changePassword(
    { userId, body: { oldPassword: "doan-sai", newPassword: "matkhaumoi" } }, response);
  assert.equal(response.statusCode, 400);

  const after = await db.query("SELECT password, token_version FROM users WHERE id = $1", [userId]);
  assert.equal(after.rows[0].password, hash, "mat khau khong duoc doi");
  assert.equal(after.rows[0].token_version, 3, "token_version khong duoc tang");
});
