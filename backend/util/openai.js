// Goi OpenAI Chat Completions API. Wrapper REST thuan, cung triet ly voi
// util/vnpay.js: giu nguyen hinh dang request/response cua API thuc de de
// doi provider sau nay chi can doi file nay.
//
// Endpoint: POST {OPENAI_API_BASE}/chat/completions
// Auth: header "Authorization: Bearer <key>"
// Tool-calling: messages[].role la system/user/assistant/tool;
//   tools: [{ type: "function", function: { name, description, parameters } }]
//   response: choices[0].message co the co "tool_calls" (MANG, co the nhieu
//   hon 1 - khac Gemini chi tra 1 functionCall/luot) = [{id, type:"function",
//   function: { name, arguments (CHUOI JSON, khong phai object) }}]
//   Gui lai ket qua tool: 1 message rieng cho MOI tool_call:
//   { role: "tool", tool_call_id, content: JSON.stringify(result) }
//
// Ten model doi theo thoi gian - xem OPENAI_MODEL trong .env.example, kiem
// tra model con dang dung tai https://platform.openai.com/docs/models truoc
// khi dien, hoac goi GET {OPENAI_API_BASE}/models voi key thuc de xem danh
// sach that.
//
// Wrapper nay dung duoc cho MOI provider tuong thich chuan OpenAI Chat
// Completions (Groq, OpenRouter...) - chi can doi OPENAI_API_BASE +
// OPENAI_MODEL + OPENAI_API_KEY trong .env, KHONG can sua code. Vi du Groq:
// OPENAI_API_BASE=https://api.groq.com/openai/v1, OPENAI_MODEL=llama-3.3-70b-versatile.

import logger from "./logger.js";

const apiBase = () => process.env.OPENAI_API_BASE || "https://api.openai.com/v1";

export class OpenAiError extends Error {}

// messages: [{ role: "system"|"user"|"assistant"|"tool", content, ... }]
// tools: [{ type: "function", function: {...} }] (optional)
export const callOpenAi = async ({ messages, tools }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey) throw new OpenAiError("OPENAI_API_KEY chưa được cấu hình");
  if (!model) throw new OpenAiError("OPENAI_MODEL chưa được cấu hình");

  const body = { model, messages };
  if (tools) body.tools = tools;

  let response;
  try {
    response = await fetch(`${apiBase()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Khong log API key - chi log thong tin loi mang
    logger.error("OpenAI fetch error:", error.message);
    throw new OpenAiError("Không gọi được OpenAI API");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.error(`OpenAI API trả lỗi ${response.status}: ${text.slice(0, 500)}`);
    throw new OpenAiError(`OpenAI API trả lỗi ${response.status}`);
  }

  return response.json();
};

const firstMessage = (openAiResponse) => openAiResponse?.choices?.[0]?.message || {};

// Co the tra ve NHIEU tool_calls trong 1 luot (OpenAI ho tro goi song song) -
// khac voi Gemini chi tra 1 functionCall/luot. Luon tra mang, rong neu khong co.
export const extractToolCalls = (openAiResponse) => firstMessage(openAiResponse).tool_calls || [];

export const extractText = (openAiResponse) => firstMessage(openAiResponse).content || "";
