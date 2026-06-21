-- 灵隙 | Lingxi - 用户配置表
-- 在 Supabase SQL Editor 中执行此脚本

CREATE TABLE IF NOT EXISTS lx_profile (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL UNIQUE,
  mainline    TEXT DEFAULT '',
  todos       JSONB DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_lx_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lx_profile_updated_at ON lx_profile;
CREATE TRIGGER trg_lx_profile_updated_at
  BEFORE UPDATE ON lx_profile
  FOR EACH ROW EXECUTE FUNCTION update_lx_profile_updated_at();

-- RLS: 用户只能读写自己的记录
ALTER TABLE lx_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lx_profile_select_policy ON lx_profile;
CREATE POLICY lx_profile_select_policy ON lx_profile
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS lx_profile_insert_policy ON lx_profile;
CREATE POLICY lx_profile_insert_policy ON lx_profile
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS lx_profile_update_policy ON lx_profile;
CREATE POLICY lx_profile_update_policy ON lx_profile
  FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS lx_profile_delete_policy ON lx_profile;
CREATE POLICY lx_profile_delete_policy ON lx_profile
  FOR DELETE USING (auth.uid()::text = user_id);
