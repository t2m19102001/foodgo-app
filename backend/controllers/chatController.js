import { getOrCreateConversation, insertMessage, listMessages } from "../db/chat.js";
import { callOpenAi, extractToolCalls, extractText, OpenAiError } from "../util/openai.js";
import { chatToolDeclarations, executeChatTool } from "../util/chatTools.js";
import { badRequest } from "../util/httpError.js";
import logger from "../util/logger.js";

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_LIMIT = 10;
// Chan vong lap vo han neu model cu goi tool lien tuc khong tra text
const MAX_TOOL_ROUNDS = 3;

const SYSTEM_INSTRUCTION = `Bạn là trợ lý ảo của FoodGo, một ứng dụng đặt đồ ăn trực tuyến.
FoodGo hiện CHỈ có MỘT cửa hàng duy nhất - không có nhiều nhà hàng hay chi nhánh để so sánh,
và hiện CHƯA có chương trình khuyến mãi/giảm giá nào.
Khi khách hỏi về món ăn, giá, danh mục, hoặc đơn hàng của họ, BẮT BUỘC dùng tool được cung cấp để lấy
dữ liệu thật rồi mới trả lời - KHÔNG được tự bịa ra tên món, giá, khuyến mãi, hoặc trạng thái đơn hàng.
Nếu tool không trả về kết quả phù hợp, hãy nói rõ là không tìm thấy, đừng đoán bừa.
Trả lời ngắn gọn, thân thiện, bằng tiếng Việt.`;

// Tool declaration dung chung (util/chatTools.js) duoc boc theo dung khung
// OpenAI {type:"function", function:{...}} - Gemini dung khung khac nen
// cho boc o day, khong boc san trong chatTools.js, de file do khong gan voi
// 1 provider cu the.
const TOOLS = chatToolDeclarations.map((decl) => ({ type: "function", function: decl }));

const mapChatMessage = (row) => ({
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
});

const historyToMessages = (messages) => messages.map((m) => ({ role: m.role, content: m.content }));

export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body || {};
    if (typeof message !== "string" || !message.trim()) {
      return badRequest(res, "Nội dung tin nhắn không được để trống");
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return badRequest(res, `Tin nhắn quá dài, tối đa ${MAX_MESSAGE_LENGTH} ký tự`);
    }
    const text = message.trim();

    const conversationId = await getOrCreateConversation(req.userId);
    const history = await listMessages(conversationId, HISTORY_LIMIT);
    await insertMessage(conversationId, "user", text);

    let messages = [
      { role: "system", content: SYSTEM_INSTRUCTION },
      ...historyToMessages(history),
      { role: "user", content: text },
    ];

    let reply;
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const response = await callOpenAi({ messages, tools: TOOLS });
        const toolCalls = extractToolCalls(response);
        if (toolCalls.length === 0) {
          reply = extractText(response) || "Xin lỗi, mình chưa có câu trả lời phù hợp.";
          break;
        }

        // OpenAI co the goi NHIEU tool cung luc - phai tra loi DU het truoc
        // khi goi luot tiep theo, moi tool_call_id ung voi 1 message rieng.
        messages = [...messages, { role: "assistant", tool_calls: toolCalls, content: null }];
        for (const toolCall of toolCalls) {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch (error) {
            logger.error("Khong doc duoc arguments cua tool call:", error.message);
          }
          const toolResult = await executeChatTool(toolCall.function.name, args, { userId: req.userId });
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolResult) });
        }
      }
    } catch (error) {
      if (error instanceof OpenAiError) {
        logger.error("OpenAI chat error:", error.message);
        return res.json({
          success: true,
          reply: "Trợ lý AI hiện đang bận hoặc gặp sự cố, vui lòng thử lại sau ít phút.",
          degraded: true,
        });
      }
      throw error;
    }

    if (!reply) {
      reply = "Mình cần hỏi quá nhiều bước cho câu này, bạn thử hỏi cụ thể hơn giúp mình nhé.";
    }

    await insertMessage(conversationId, "assistant", reply);
    res.json({ success: true, reply });
  } catch (error) {
    logger.error("Send chat message error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi gửi tin nhắn" });
  }
};

export const getHistory = async (req, res) => {
  try {
    const conversationId = await getOrCreateConversation(req.userId);
    const messages = await listMessages(conversationId, 50);
    res.json({ success: true, messages: messages.map(mapChatMessage) });
  } catch (error) {
    logger.error("Get chat history error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy lịch sử hội thoại" });
  }
};
