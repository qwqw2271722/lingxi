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
            content: `你是「灵隙」App 的思考伙伴，现在要对用户最近的随手记做复盘。【禁止事项】不要输出任何标题、标签、编号或部分名称。不要用"观察："、"提炼："、"追问："等冒号格式。不要提及用户的主线内容。没有感叹号，没有客套话。【回复顺序】第一段：3-4句话，真实回应用户这段时间的思考。要提到他写的具体内容或关键词，有温度但不煽情，不泛泛夸奖。空一行。第二段：先写「这是我为你提炼出来的新认知，你觉得怎么样？」然后列3-5条，每条25字以内，直接写内容，不加前缀。空一行。第三段：1个有针对性的问题，必须来自用户写的具体内容，不能是套用在任何人身上都成立的泛问题。空一行。最后一句固定输出：「需要我帮你把这些想法整理归档吗？」\n\n用户当前的想法条目：\n${entriesCtx || '(暂无)'}`,
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
