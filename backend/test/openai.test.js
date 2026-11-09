import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { callOpenAi, extractToolCalls, extractText, OpenAiError } from "../util/openai.js";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  global.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
  process.env.OPENAI_API_BASE = originalEnv.OPENAI_API_BASE;
});

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test("callOpenAi goi dung URL/header/body va tra ve JSON", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-test-model";
  process.env.OPENAI_API_BASE = "https://fake.openai.com/v1";

  let capturedUrl;
  let capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return jsonResponse({ choices: [{ message: { role: "assistant", content: "ok" } }] });
  };

  const result = await callOpenAi({ messages: [{ role: "user", content: "hi" }] });

  assert.equal(capturedUrl, "https://fake.openai.com/v1/chat/completions");
  assert.equal(capturedOptions.method, "POST");
  assert.equal(capturedOptions.headers.Authorization, "Bearer test-key");
  const sentBody = JSON.parse(capturedOptions.body);
  assert.equal(sentBody.model, "gpt-test-model");
  assert.deepEqual(sentBody.messages, [{ role: "user", content: "hi" }]);
  assert.equal(result.choices[0].message.content, "ok");
});

test("callOpenAi gui kem tools khi co", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-test-model";

  let sentBody;
  global.fetch = async (url, options) => {
    sentBody = JSON.parse(options.body);
    return jsonResponse({ choices: [{ message: { role: "assistant", content: "" } }] });
  };

  await callOpenAi({
    messages: [{ role: "user", content: "hi" }],
    tools: [{ type: "function", function: { name: "x" } }],
  });

  assert.deepEqual(sentBody.tools, [{ type: "function", function: { name: "x" } }]);
});

test("callOpenAi nem OpenAiError khi thieu API key hoac model, khong goi fetch", async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.OPENAI_MODEL = "gpt-test-model";
  let fetchCalled = false;
  global.fetch = async () => { fetchCalled = true; return jsonResponse({}); };

  await assert.rejects(() => callOpenAi({ messages: [] }), OpenAiError);
  assert.equal(fetchCalled, false);
});

test("callOpenAi nem OpenAiError khi fetch bi reject (mat mang)", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-test-model";
  global.fetch = async () => { throw new Error("network down"); };

  await assert.rejects(() => callOpenAi({ messages: [] }), OpenAiError);
});

test("callOpenAi nem OpenAiError khi response khong ok (HTTP loi)", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-test-model";
  global.fetch = async () => jsonResponse({ error: "quota exceeded" }, false, 429);

  await assert.rejects(() => callOpenAi({ messages: [] }), OpenAiError);
});

test("extractToolCalls doc dung mang tool_calls, co the nhieu hon 1", () => {
  const response = {
    choices: [{ message: { tool_calls: [
      { id: "call_1", type: "function", function: { name: "search_menu", arguments: '{"keyword":"cay"}' } },
      { id: "call_2", type: "function", function: { name: "get_food_detail", arguments: '{"foodName":"Phở"}' } },
    ] } }],
  };
  const calls = extractToolCalls(response);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].function.name, "search_menu");
  assert.equal(calls[1].function.name, "get_food_detail");
});

test("extractToolCalls tra mang rong khi khong co tool_calls", () => {
  const response = { choices: [{ message: { content: "chi la text" } }] };
  assert.deepEqual(extractToolCalls(response), []);
});

test("extractText doc dung content, rong khi thieu truong", () => {
  assert.equal(extractText({ choices: [{ message: { content: "Xin chào" } }] }), "Xin chào");
  assert.equal(extractText({}), "");
  assert.equal(extractText(undefined), "");
});
