import test, { mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import { changePassword, loginUser, registerUser } from "../controllers/authController.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("register rejects a bad email and a short password before any database query", async () => {
  mock.method(userModel, "findOne", async () => { throw new Error("should not reach DB"); });
  try {
    const badEmail = makeResponse();
    await registerUser({ body: { name: "Man", email: "khong-phai-email", password: "matkhau123" } }, badEmail);
    assert.equal(badEmail.statusCode, 400);

    const shortPassword = makeResponse();
    await registerUser({ body: { name: "Man", email: "man@example.com", password: "12345" } }, shortPassword);
    assert.equal(shortPassword.statusCode, 400);
  } finally {
    mock.restoreAll();
  }
});

test("register stores only a bcrypt hash and returns a token carrying the role", async () => {
  let created = null;
  mock.method(userModel, "findOne", async () => null);
  mock.method(userModel, "create", async (data) => {
    created = data;
    return { ...data, _id: "user1", isAdmin: false, tokenVersion: 0 };
  });
  try {
    const response = makeResponse();
    await registerUser({ body: { name: " Man ", email: "Man@Example.COM", password: "matkhau123" } }, response);

    assert.equal(response.statusCode, 201);
    assert.notEqual(created.password, "matkhau123");
    assert.equal(await bcrypt.compare("matkhau123", created.password), true);
    assert.equal(created.email, "man@example.com");
    assert.equal(created.name, "Man");

    const payload = jwt.verify(response.body.token, process.env.JWT_SECRET);
    assert.equal(payload.id, "user1");
    assert.equal(payload.isAdmin, false);
  } finally {
    mock.restoreAll();
  }
});

test("login refuses a locked account even when the password is correct", async () => {
  mock.method(userModel, "findOne", async () => ({
    _id: "user1",
    name: "Man",
    password: await bcrypt.hash("matkhau123", 10),
    isActive: false,
    isAdmin: false,
    tokenVersion: 0,
  }));
  try {
    const response = makeResponse();
    await loginUser({ body: { email: "man@example.com", password: "matkhau123" } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.token, undefined);
  } finally {
    mock.restoreAll();
  }
});

test("login with a wrong password returns 401 without a token", async () => {
  mock.method(userModel, "findOne", async () => ({
    _id: "user1",
    name: "Man",
    password: await bcrypt.hash("matkhau123", 10),
    isActive: true,
    isAdmin: false,
    tokenVersion: 0,
  }));
  try {
    const response = makeResponse();
    await loginUser({ body: { email: "man@example.com", password: "sai-mat-khau" } }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.token, undefined);
  } finally {
    mock.restoreAll();
  }
});

test("changing the password bumps tokenVersion so tokens issued earlier stop working", async () => {
  let saved = false;
  const user = {
    password: await bcrypt.hash("matkhaucu", 10),
    tokenVersion: 3,
    save: async () => { saved = true; },
  };
  mock.method(userModel, "findById", async () => user);
  try {
    const response = makeResponse();
    await changePassword(
      { userId: "user1", body: { oldPassword: "matkhaucu", newPassword: "matkhaumoi" } },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(user.tokenVersion, 4);
    assert.equal(await bcrypt.compare("matkhaumoi", user.password), true);
    assert.equal(saved, true);
  } finally {
    mock.restoreAll();
  }
});

test("a wrong old password leaves the stored password and tokenVersion untouched", async () => {
  let saved = false;
  const originalHash = await bcrypt.hash("matkhaucu", 10);
  const user = { password: originalHash, tokenVersion: 3, save: async () => { saved = true; } };
  mock.method(userModel, "findById", async () => user);
  try {
    const response = makeResponse();
    await changePassword(
      { userId: "user1", body: { oldPassword: "doan-sai", newPassword: "matkhaumoi" } },
      response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(user.password, originalHash);
    assert.equal(user.tokenVersion, 3);
    assert.equal(saved, false);
  } finally {
    mock.restoreAll();
  }
});
