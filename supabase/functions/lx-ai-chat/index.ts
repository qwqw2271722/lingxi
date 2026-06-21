import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "未登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "身份验证失败" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, entries } = await req.json();

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: "消息不能为空" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 保存用户消息到数据库
    await supabase.from("lx_ai_logs").insert({
      user_id: user.id,
      role: "user",
      content: message,
    });

    // 获取最近 20 条对话历史
    const { data: history } = await supabase
      .from("lx_ai_logs")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(40);

    // 构建消息列表
    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: `你是"灵隙"的 AI 复盘助手。用户会跟你讨论他们的想法和条目，帮他们深度复盘、发现联系、提出洞察。

当前用户的想法条目：
${(entries || []).map((e: any, i: number) => `${i + 1}. ${e.text}${e.tags?.length ? ' [标签: ' + e.tags.join(', ') + ']' : ''}`).join('\n') || '(暂无条目)'}

请用简洁有洞察力的方式回复，像朋友聊天一样。用中文。`,
      },
    ];

    if (history && history.length > 0) {
      for (const h of history) {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: "user", content: message });

    // Call OpenAI
    if (!OPENAI_API_KEY) {
      const fallbackReply = "AI 复盘功能尚未配置 API Key。请在 Supabase Edge Function 环境变量中设置 OPENAI_API_KEY。";
      await supabase.from("lx_ai_logs").insert({
        user_id: user.id,
        role: "assistant",
        content: fallbackReply,
      });
      return new Response(JSON.stringify({ reply: fallbackReply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", errText);
      const errReply = "抱歉，AI 服务暂时不可用，请稍后再试。";
      await supabase.from("lx_ai_logs").insert({
        user_id: user.id,
        role: "assistant",
        content: errReply,
      });
      return new Response(JSON.stringify({ reply: errReply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || "抱歉，我暂时无法回复。";

    // 保存 AI 回复
    await supabase.from("lx_ai_logs").insert({
      user_id: user.id,
      role: "assistant",
      content: reply,
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lx-ai-chat error:", err);
    return new Response(JSON.stringify({ error: "服务器内部错误" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
