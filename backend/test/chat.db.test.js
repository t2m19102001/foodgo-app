import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, makeCategory, makeFood, makeOrder,
} from "./helpers/db.mjs";

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-chi-dung-trong-test-0123456789";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-test-model";

const skip = hasDb ? false : dbMissingReason;
let chat;
let db;
const originalFetch = global.fetch;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  chat = await import("../controllers/chatController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
afterEach(() => { global.fetch = originalFetch; });
after(async () => { if (hasDb) await closeDb(); });

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => "" });
const textReply = (content) => jsonResponse({ choices: [{ message: { role: "assistant", content } }] });
const toolCallReply = (name, args = {}) => jsonResponse({
  choices: [{ message: {
    role: "assistant",
    content: null,
    tool_calls: [{ id: "call_1", type: "function", function: { name, arguments: JSON.stringify(args) } }],
  } }],
});

const rowsOf = async (table, where = "", params = []) => {
  const { rows } = await db.query(`SELECT * FROM ${table} ${where} ORDER BY created_at`, params);
  return rows;
};

test("sendMessage tao dung 1 conversation/user va luu dung thu tu message", { skip }, async () => {
  const userId = await makeUser();
  global.fetch = async () => textReply("Chào bạn!");

  const response = makeResponse();
  await chat.sendMessage({ userId, body: { message: "Xin chào" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.reply, "Chào bạn!");

  const conversations = await rowsOf("chat_conversations");
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].user_id, userId);

  const messages = await rowsOf("chat_messages");
  assert.deepEqual(messages.map((m) => [m.role, m.content]), [
    ["user", "Xin chào"],
    ["assistant", "Chào bạn!"],
  ]);
});

test("message rong hoac qua dai bi chan truoc khi tao conversation", { skip }, async () => {
  const userId = await makeUser();

  const empty = makeResponse();
  await chat.sendMessage({ userId, body: { message: "   " } }, empty);
  assert.equal(empty.statusCode, 400);

  const tooLong = makeResponse();
  await chat.sendMessage({ userId, body: { message: "a".repeat(1001) } }, tooLong);
  assert.equal(tooLong.statusCode, 400);

  assert.equal((await rowsOf("chat_conversations")).length, 0);
});

test("OpenAI loi: van giu message user, KHONG luu message assistant rong, tra reply degraded", { skip }, async () => {
  const userId = await makeUser();
  global.fetch = async () => { throw new Error("network down"); };

  const response = makeResponse();
  await chat.sendMessage({ userId, body: { message: "Món nào ngon?" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.degraded, true);
  assert.ok(response.body.reply.length > 0);

  const messages = await rowsOf("chat_messages");
  assert.deepEqual(messages.map((m) => m.role), ["user"]);
});

test("get_my_order_status qua tool-call chi doc don cua CHINH user dang chat, khong lo don nguoi khac", { skip }, async () => {
  const userId = await makeUser({ email: "owner@test.local" });
  const otherUserId = await makeUser({ email: "other@test.local" });
  const foodId = await makeFood(await makeCategory());
  const myOrderId = await makeOrder(userId, { status: "pending", foodId });
  await makeOrder(otherUserId, { status: "pending", foodId });

  const fetchCalls = [];
  global.fetch = async (url, options) => {
    fetchCalls.push(JSON.parse(options.body));
    if (fetchCalls.length === 1) return toolCallReply("get_my_order_status");
    return textReply("Đơn của bạn đang chờ xác nhận.");
  };

  const response = makeResponse();
  await chat.sendMessage({ userId, body: { message: "Đơn của tôi sao rồi?" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(fetchCalls.length, 2, "phai goi OpenAI lan 2 sau khi co ket qua tool");

  const toolMessage = fetchCalls[1].messages.find((m) => m.role === "tool");
  assert.ok(toolMessage, "phai gui lai ket qua tool (role=tool) cho OpenAI");

  const toolResult = JSON.parse(toolMessage.content);
  const orderIds = toolResult.orders.map((o) => o._id);
  assert.deepEqual(orderIds, [myOrderId], "chi duoc thay don cua chinh minh");
});

test("getHistory tra dung thu tu thoi gian, rong khi chua chat lan nao", { skip }, async () => {
  const userId = await makeUser();

  const empty = makeResponse();
  await chat.getHistory({ userId }, empty);
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.body.messages, []);

  global.fetch = async () => textReply("Trả lời 1");
  await chat.sendMessage({ userId, body: { message: "Câu hỏi 1" } }, makeResponse());
  global.fetch = async () => textReply("Trả lời 2");
  await chat.sendMessage({ userId, body: { message: "Câu hỏi 2" } }, makeResponse());

  const history = makeResponse();
  await chat.getHistory({ userId }, history);
  assert.deepEqual(history.body.messages.map((m) => m.content), [
    "Câu hỏi 1", "Trả lời 1", "Câu hỏi 2", "Trả lời 2",
  ]);
});
