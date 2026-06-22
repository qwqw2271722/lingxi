import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// NVIDIA NIM API Key — 免费无限调用
const NVIDIA_API_KEY = "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";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const AI_MODEL = "nvidia/nemotron-3-nano-30b-a3b";

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
            content: `你是「灵隙」App 的思考伙伴。直接输出以下格式，不要输出任何其他内容：

[3-4句话回应用户的想法，提到他写的具体内容或关键词，有温度不煽情]

这是我为你提炼出来的新认知，你觉得怎么样？
[3-5条认知，每条25字以内，不加任何前缀]
[1个针对用户具体内容的追问]

需要我帮你把这些想法整理归档吗？

参考示例：
你最近反复提到自律和早起的困难，也记录了运动后的满足感。在拖延和行动之间，你似乎正在摸索自己的节奏。

这是我为你提炼出来的新认知，你觉得怎么样？
行动前的阻力往往只持续几分钟
早起的关键在于前一晚的决定
运动带来的成就感远超疲惫

如果明天醒来第一件事就是运动，你最可能遇到的阻力是什么？

需要我帮你把这些想法整理归档吗？

用户当前的想法条目：
${entriesCtx || '(暂无)'}`,
          },
          { role: "user", content: message },
        ],
        temperature: 0.6,
        max_tokens: 512,
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
