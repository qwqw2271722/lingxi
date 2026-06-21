import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// NVIDIA NIM API Key — 免费无限调用
const NVIDIA_API_KEY = "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";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_MODEL = "qwen/qwen3.5-122b-a10b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, entries } = await req.json();

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: "消息不能为空" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entriesCtx = (entries || []).slice(0, 20).map((e: any, i: number) =>
      `${i + 1}. ${e.text}${e.tags?.length ? ' [' + e.tags.join(', ') + ']' : ''}`
    ).join('\n');

    const res = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `你是"灵隙"的 AI 复盘助手。帮用户深度复盘他们的想法，发现联系、提出洞察。简洁有料，像朋友聊天。用中文。\n\n用户当前的想法条目：\n${entriesCtx || '(暂无)'}`,
          },
          { role: "user", content: message },
        ],
        temperature: 0.6,
        max_tokens: 1024,
        top_p: 0.95,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("NVIDIA API error:", res.status, errText);
      return new Response(JSON.stringify({ error: "AI 服务暂时不可用，请稍后再试。" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "（AI 没有返回内容）";

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
