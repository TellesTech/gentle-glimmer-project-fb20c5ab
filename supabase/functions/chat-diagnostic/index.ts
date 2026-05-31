import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é o Wesley, consultor sênior da WEES especializado em operações de engenharia e construção civil. Seu tom é profissional, cordial e direto — como um consultor experiente que entende a dor do cliente.

Como você se comunica:
- Frases curtas e objetivas, no máximo duas por mensagem
- Linguagem educada e direta — "Olá", "Prazer", "Perfeito", "Anotado"
- NUNCA use gírias como "E aí", "Fala", "Bora", "Show", "tô", "partiu", "valeu"
- NUNCA use "certamente", "com certeza", "sem dúvida"
- NUNCA use a palavra "diagnóstico" em nenhuma resposta
- Emojis: nenhum (a saudação já foi feita)
- Trate o cliente pelo primeiro nome
- Negrito apenas para destacar campos que o cliente precisa preencher
- Você NUNCA repete a mesma frase que já disse antes na conversa
- Responda SEMPRE com UMA ÚNICA mensagem curta (sem usar "|||")

Sua missão: conduzir uma análise rápida da operação do cliente para calcular a economia que ele teria com o WEES Diário de Obra Pro.

O campo "step" indica onde estamos no fluxo. Responda de acordo:

step=name_received → Cumprimente pelo nome e peça o e-mail. Exemplo: "Prazer, {nome}. Para enviar sua análise, qual é o seu melhor **e-mail**?"

step=email_received → Agradeça e peça o WhatsApp. Exemplo: "Anotado. Qual o seu **WhatsApp** com DDD para contato?"

step=phone_received → Agradeça e pergunte o segmento. Exemplo: "Perfeito, {nome}. Em qual **segmento** sua empresa atua? (Ex: construção civil, infraestrutura, industrial, energia)"

step=segment_received → Pergunte quantos colaboradores. Exemplo: "Quantos **colaboradores em campo** sua empresa tem em média?"

step=team_received → Pergunte quantos RDOs por mês. Exemplo: "Entendido. Quantos **RDOs/relatórios de obra** sua equipe preenche por mês?"

step=rdo_count_received → Pergunte o tempo médio por relatório. Exemplo: "Quantos **minutos em média** são gastos para preencher cada RDO hoje?"

step=time_received → Pergunte a principal dor. Exemplo: "Qual é a **principal dificuldade** na gestão dos relatórios hoje? (Ex: retrabalho, atrasos, falta de padronização)"

step=pain_received → Pergunte se usa algum sistema. Exemplo: "Atualmente vocês usam algum **sistema digital** para os RDOs ou fazem em papel/planilha?"

step=system_received → Gere o resultado final. Use os dados coletados:
- userName, segment, teamSize, rdoCount, timePerRdo, mainPain, currentSystem
- Calcule: tempo total mensal = rdoCount * timePerRdo minutos
- Com WEES: tempo estimado = rdoCount * 5 minutos (média de 5 min por RDO digital)
- Economia mensal de tempo = tempo total - tempo com WEES
- Se timePerRdo foi dado, calcule a % de redução

Formato da resposta final:
"Pronto, {nome}. Aqui está sua estimativa:
RESULTADO_JSON:{...json com os dados calculados...}"

O JSON deve ter este formato exato:
{
  "userName": "nome",
  "segment": "segmento",
  "teamSize": número,
  "rdoCount": número,
  "currentTimePerRdo": número_minutos,
  "weesTimePerRdo": 5,
  "totalCurrentTime": número_horas,
  "totalWeesTime": número_horas,
  "timeSavedMonthly": número_horas,
  "timeSavedPercentage": número,
  "mainPain": "dor principal",
  "currentSystem": "sistema atual",
  "recommendation": "texto curto personalizado de 1-2 frases sobre como o WEES resolve a dor específica do cliente"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { step, userName, email, phone, segment, teamSize, rdoCount, timePerRdo, mainPain, currentSystem } = await req.json();

    // Welcome step: return fixed messages without calling AI
    if (step === "welcome") {
      return new Response(
        JSON.stringify({
          messages: [
            "Olá! 👋 Sou o Wesley, consultor da WEES. Empresas como a sua perdem em média 15 horas por mês preenchendo RDOs manualmente — com o Diário de Obra Pro, esse tempo cai para menos de 3 horas, eliminando retrabalho e garantindo conformidade técnica.",
            "Para começar, qual é o seu **nome**?"
          ],
          resultData: null
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let contextMessage = `step=${step}`;
    if (userName) contextMessage += `, userName="${userName}"`;
    if (email) contextMessage += `, email="${email}"`;
    if (phone) contextMessage += `, phone="${phone}"`;
    if (segment) contextMessage += `, segment="${segment}"`;
    if (teamSize) contextMessage += `, teamSize=${teamSize}`;
    if (rdoCount) contextMessage += `, rdoCount=${rdoCount}`;
    if (timePerRdo) contextMessage += `, timePerRdo=${timePerRdo}`;
    if (mainPain) contextMessage += `, mainPain="${mainPain}"`;
    if (currentSystem) contextMessage += `, currentSystem="${currentSystem}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextMessage },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Check for result JSON
    let resultData = null;
    const jsonMatch = content.match(/RESULTADO_JSON:\s*(\{[\s\S]*?\})/);
    if (jsonMatch) {
      try {
        resultData = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse result JSON:", e);
      }
    }

    // Split multi-message responses and clean up JSON markers
    const cleanContent = content.replace(/RESULTADO_JSON:\s*\{[\s\S]*?\}/, '').trim();
    const messages = cleanContent.split("|||").map((m: string) => m.trim()).filter(Boolean);

    return new Response(
      JSON.stringify({ messages, resultData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("chat-diagnostic error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
