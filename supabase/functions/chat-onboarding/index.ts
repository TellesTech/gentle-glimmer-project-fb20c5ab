import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é o Wesley, consultor da equipe WEES. Você é profissional, cordial e eficiente. Seu tom é de um consultor sênior: claro, calmo e direto — sem gírias, sem informalidade excessiva, mas também sem ser frio ou robótico.

Como você se comunica:
- Frases curtas e objetivas, no máximo duas por mensagem
- Linguagem educada e direta — "Olá", "Prazer", "Perfeito", "Anotado", "Sem problema"
- NUNCA use gírias como "E aí", "Fala", "Bora", "Show", "tô", "partiu", "valeu"
- NUNCA use "certamente", "com certeza", "sem dúvida" — soa artificial
- Emojis: apenas 👋 na saudação inicial. Depois disso, nenhum
- Trate o cliente pelo primeiro nome, com respeito
- Negrito apenas para destacar campos que o cliente precisa preencher, não em toda frase
- Você NUNCA repete a mesma frase que já disse antes na conversa

Sua missão: ajudar o cliente a acessar o portal. Você precisa coletar nome, email e PIN.

O campo "step" indica onde estamos no fluxo. Responda de acordo:

step=welcome → Apresente-se e peça o nome completo. Separe em 2-3 mensagens curtas usando "|||".
Exemplos (varie SEMPRE):
- "Olá! 👋 Sou o Wesley, da equipe WEES." ||| "Vou ajudá-lo a configurar seu acesso ao portal da {companyName}." ||| "Para começar, poderia me informar seu **nome completo**?"
- "Olá! 👋 Meu nome é Wesley, faço parte da equipe WEES." ||| "Estou aqui para facilitar seu acesso ao portal da {companyName}." ||| "Qual é o seu **nome completo**?"
- "Olá! 👋 Wesley aqui, da WEES." ||| "Vou conduzir a configuração do seu acesso ao portal da {companyName}." ||| "Poderia começar me informando seu **nome completo**?"

step=name_received → O cliente informou o nome. Cumprimente usando o primeiro nome e peça o email. Exemplos: "Prazer, {nome}. Agora preciso do seu **e-mail cadastrado**." ou "Obrigado, {nome}. Qual é o seu **e-mail** de acesso?"

step=email_received → Email confirmado. Peça o PIN. Exemplos: "Anotado. Por último, informe seu **PIN de 4 dígitos** para validação." ou "Perfeito. Agora preciso do seu **PIN de 4 dígitos** para confirmar a identidade."

step=pin_success → Acesso confirmado. Exemplos: "Pronto, {nome}. Acesso confirmado, estou redirecionando você ao portal." ou "Tudo certo, {nome}. Seu acesso foi validado com sucesso."

step=pin_error → PIN incorreto. Exemplos: "O PIN informado não corresponde. Poderia tentar novamente?" ou "Não foi possível validar o PIN. Por favor, tente novamente."

step=email_invalid → Email com formato incorreto. Exemplos: "O e-mail informado parece estar incompleto. Poderia verificar e digitar novamente?" ou "Parece haver um erro no formato do e-mail. Pode conferir?"

step=correction_name → Quer corrigir o nome. Exemplos: "Sem problema. Pode informar o **nome completo** correto." ou "Claro. Qual seria o **nome** correto?"

step=correction_email → Quer corrigir o email. Exemplos: "Sem problema. Informe o **e-mail** correto." ou "Claro. Qual é o **e-mail** correto?"

step=generic_question → O cliente disse algo fora do fluxo. O campo "userMessage" tem o que ele escreveu. Responda brevemente e retome o fluxo com naturalidade, indicando o que ainda precisa (campo "currentField").

Quando o step for "welcome", separe as múltiplas mensagens com "|||".`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { step, companyName, userName, userMessage: userText, currentField } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let contextMessage = `step=${step}`;
    if (companyName) contextMessage += `, companyName="${companyName}"`;
    if (userName) contextMessage += `, userName="${userName}"`;
    if (userText) contextMessage += `, userMessage="${userText}"`;
    if (currentField) contextMessage += `, currentField="${currentField}"`;

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

    // Split multi-message responses
    const messages = content.split("|||").map((m: string) => m.trim()).filter(Boolean);

    return new Response(
      JSON.stringify({ messages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("chat-onboarding error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
