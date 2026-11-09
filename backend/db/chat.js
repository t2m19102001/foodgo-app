// Tang truy cap du lieu cho chatbot. 1 conversation/user (UNIQUE user_id,
// xem migration 007) - khong can khai niem nhieu phong chat.
import { query } from "./index.js";

export const getOrCreateConversation = async (userId) => {
  const { rows } = await query(
    `INSERT INTO chat_conversations (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = excluded.user_id
     RETURNING id`,
    [userId]
  );
  return rows[0].id;
};

export const insertMessage = (conversationId, role, content) => query(
  "INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, $2, $3)",
  [conversationId, role, content]
);

// ORDER BY created_at DESC LIMIT roi dao nguoc lai: lay N message MOI NHAT
// nhung tra ve theo thu tu THOI GIAN TANG DAN (dung thu tu hoi thoai).
export const listMessages = async (conversationId, limit = 50) => {
  const { rows } = await query(
    `SELECT role, content, created_at FROM chat_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [conversationId, limit]
  );
  return rows.reverse();
};
