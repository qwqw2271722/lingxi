-- 灵隙 | Lingxi - AI 对话日志表
-- 在 Supabase SQL Editor 中执行此脚本

CREATE TABLE IF NOT EXISTS lx_ai_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lx_ai_logs_user_id ON lx_ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lx_ai_logs_created_at ON lx_ai_logs(created_at);

-- RLS: 用户只能读写自己的对话记录
ALTER TABLE lx_ai_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lx_ai_logs_select_policy ON lx_ai_logs;
CREATE POLICY lx_ai_logs_select_policy ON lx_ai_logs
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS lx_ai_logs_insert_policy ON lx_ai_logs;
CREATE POLICY lx_ai_logs_insert_policy ON lx_ai_logs
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
