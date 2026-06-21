# 灵隙 AI 复盘 — 部署指南

## 前置条件

1. 已完成 `migration_profile.sql` 和 `migration_ai.sql` 的执行
2. 本地已安装 Supabase CLI：https://supabase.com/docs/guides/cli
3. 拥有 OpenAI API Key：https://platform.openai.com/api-keys

## 部署步骤

### 1. 登录 Supabase

```bash
npx supabase login
```

### 2. 链接项目

```bash
cd lingxi-deploy
npx supabase link --project-ref ryzlppvebqrcmoetzllw
```

### 3. 设置环境变量（OpenAI API Key）

```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 4. 部署 Edge Function

```bash
npx supabase functions deploy lx-ai-chat --project-ref ryzlppvebqrcmoetzllw
```

### 5. 验证部署

部署成功后，访问：
```
https://rywlppvebqrcmoetzllw.supabase.co/functions/v1/lx-ai-chat
```

如果返回 JSON 错误（未登录/无消息），说明部署成功。

## 环境变量说明

| 变量 | 说明 | 必填 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI API Key | 是 |
| `SUPABASE_URL` | Supabase 项目 URL（自动注入） | 自动 |
| `SUPABASE_ANON_KEY` | Supabase Anon Key（自动注入） | 自动 |

## 未部署时的行为

如果 Edge Function 未部署，前端会显示友好提示：
> "AI 复盘功能尚未配置，请联系管理员"

不会报错或崩溃。

## 故障排查

| 问题 | 可能原因 | 解决 |
|------|----------|------|
| 返回 401 | 用户未登录 | 检查 Supabase Auth |
| 返回 "AI 服务暂时不可用" | OpenAI API 返回错误 | 检查 API Key 和余额 |
| 返回 "AI 复盘功能尚未配置" | Edge Function 未部署 | 按上述步骤部署 |
| CORS 错误 | 跨域问题 | Edge Function 已配置 CORS，检查部署是否成功 |
