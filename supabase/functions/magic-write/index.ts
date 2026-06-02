import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACTION_PROMPTS: Record<string, string> = {
  expand: `Você é um redator técnico de engenharia industrial. Expanda o texto abaixo com mais detalhes técnicos, mantendo o tom profissional. Adicione informações complementares relevantes sem inventar dados. Mantenha o formato HTML (use <p>, <strong>, <ul>, <li> quando necessário). Retorne APENAS o HTML expandido, sem explicações.`,
  summarize: `Você é um redator técnico de engenharia industrial. Resuma o texto abaixo de forma concisa, mantendo os pontos essenciais. Mantenha o formato HTML. Retorne APENAS o HTML resumido, sem explicações.`,
  improve: `Você é um redator técnico de engenharia industrial. Melhore a gramática, estilo e clareza do texto abaixo, tornando-o mais profissional e bem escrito. Corrija erros e melhore a estrutura. Mantenha o formato HTML. Retorne APENAS o HTML melhorado, sem explicações.`,
  formalize: `Você é um redator técnico de engenharia industrial. Converta o texto abaixo para linguagem técnica formal de relatórios industriais (norma ABNT/WEES). Use terminologia técnica adequada. Mantenha o formato HTML. Retorne APENAS o HTML formalizado, sem explicações.`,
  simplify: `Você é um redator técnico de engenharia industrial. Simplifique o texto abaixo para linguagem acessível, removendo jargões desnecessários mas mantendo a precisão técnica. Mantenha o formato HTML. Retorne APENAS o HTML simplificado, sem explicações.`,
  generate_title: `Você é um redator técnico de engenharia industrial. Com base no conteúdo abaixo, gere um título ou subtítulo conciso e profissional (máximo 10 palavras). Retorne APENAS o texto do título, sem tags HTML, sem explicações.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { text, action } = await req.json();
    if (!text || !action) throw new Error("text and action are required");

    const systemPrompt = ACTION_PROMPTS[action];
    if (!systemPrompt) throw new Error(`Invalid action: ${action}. Valid: ${Object.keys(ACTION_PROMPTS).join(", ")}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let result = aiData.choices?.[0]?.message?.content || "";
    
    // Clean markdown code blocks if present
    result = result.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("magic-write error:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
