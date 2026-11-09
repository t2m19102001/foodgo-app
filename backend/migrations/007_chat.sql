-- 007_chat.sql
--
-- AI Chatbot: 1 cuoc hoi thoai lien tuc cho mot user (UNIQUE user_id), khong
-- can khai niem "nhieu phong chat" - spec chi can "luu lich su theo tai
-- khoan". Tach rieng conversation/message (khong don vao 1 bang) de sau nay
-- de mo rong (vd: nut "xoa lich su" chi can xoa messages, giu conversation).

BEGIN;

CREATE TABLE chat_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL CHECK (char_length(content) <= 4000),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conversation_idx ON chat_messages (conversation_id, created_at);

COMMIT;
