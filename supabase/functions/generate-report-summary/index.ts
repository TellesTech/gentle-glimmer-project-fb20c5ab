import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitizeTechnicalSummary(text: string): string {
  if (!text) return '';
  return text
    // Remove blocos de código primeiro (para não processar conteúdo interno)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove negrito/itálico Markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    // Remove marcadores de nota tipo (*), (**), (1), (2)
    .replace(/\s*\([\*\d]+\)/g, '')
    // Remove asteriscos soltos remanescentes
    .replace(/\*/g, '')
    // Remove bullets/marcadores de lista no início de linhas
    .replace(/^[\s]*[•\-–—►▪▫◦‣⁃]\s+/gm, '')
    .replace(/^[\s]*\d+[\.\)]\s+/gm, '')
    .replace(/^[\s]*[a-z][\.\)]\s+/gim, '')
    // Remove headings markdown
    .replace(/^#+\s*/gm, '')
    // Remove emojis comuns e símbolos decorativos
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '')
    // Normaliza espaços múltiplos e quebras excessivas
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activities, deviations, attendance, date, shift, projectName } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Formatar dados para o prompt
    const completedActivities = activities?.filter((a: any) => a.completed) || [];
    const pendingActivities = activities?.filter((a: any) => !a.completed) || [];
    const presentCount = attendance?.filter((a: any) => a.present)?.length || 0;
    const totalCount = attendance?.length || 0;
    
    const shiftLabels: Record<string, string> = {
      morning: 'Manhã',
      afternoon: 'Tarde',
      night: 'Noite',
    };

    const prompt = `Você é um engenheiro de manutenção/obras redigindo um relatório técnico de RDO (Relatório Diário de Obra) conforme NBR e normas internas de engenharia.

DADOS OPERACIONAIS:
- Projeto/Frente: ${projectName || 'Não informado'}
- Data: ${date || 'Não informada'}
- Turno: ${shiftLabels[shift] || shift || 'Não informado'}
- Efetivo mobilizado: ${presentCount} de ${totalCount} colaboradores

ATIVIDADES EXECUTADAS:
${completedActivities.map((a: any) => `• ${a.description}`).join('\n') || 'Nenhuma registrada'}

ATIVIDADES EM ANDAMENTO:
${pendingActivities.map((a: any) => `• ${a.description}`).join('\n') || 'Nenhuma registrada'}

OCORRÊNCIAS / DESVIOS:
${deviations?.map((d: any) => `• ${d.description}`).join('\n') || 'Sem ocorrências registradas'}

DIRETRIZES TÉCNICAS DE REDAÇÃO:
1. Linguagem técnica, objetiva, formal e impessoal — padrão de engenharia industrial/manutenção.
2. Empregue terminologia técnica adequada quando aplicável (ex.: "execução de", "intervenção em", "inspeção", "comissionamento", "lançamento de cabo", "torque aplicado", "isolamento", "bloqueio e etiquetagem - LOTO", "frente de serviço", "área classificada", "PT/APR").
3. Verbos no passado ou presente impessoal ("foi executado", "encontra-se em andamento", "procedeu-se à inspeção").
4. Apresente quantitativos sempre que disponíveis (efetivo, HH, percentuais de avanço, dimensões).
5. Estrutura obrigatória em 3 parágrafos curtos:
   • Parágrafo 1 — Contexto operacional: data, turno, frente de serviço e efetivo mobilizado.
   • Parágrafo 2 — Descrição técnica das atividades executadas e em andamento, com método e localização.
   • Parágrafo 3 — Ocorrências, desvios, pendências e status técnico final da frente.
6. Vedado: saudações ("Prezados"), despedidas, opiniões, juízos de valor, adjetivos subjetivos, floreios.
7. Não invente dados, equipamentos ou métodos não fornecidos.
8. Responda APENAS com texto corrido limpo. PROIBIDO ABSOLUTAMENTE:
   - Asteriscos (*), parênteses-asterisco (*), notas de rodapé de qualquer tipo
   - Negrito/itálico Markdown (**texto**, *texto*, _texto_, __texto__)
   - Marcadores de lista (•, -, –, 1., a), etc.)
   - Títulos, cabeçalhos (#, ##, ###)
   - Emojis, ícones, símbolos decorativos
   - Aspas decorativas em torno de termos técnicos
   - Códigos inline (\`texto\`), tags HTML, blocos de código
   - Qualquer marcador copiado de rótulos de formulário (ex: "(*)" indicando obrigatoriedade)
   Apenas frases corridas em português técnico, separadas por pontuação normal (ponto, vírgula, ponto-e-vírgula).`;

    console.log('[generate-report-summary] Gerando resumo com dados:', {
      activitiesCount: activities?.length,
      deviationsCount: deviations?.length,
      presentCount,
      totalCount
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-report-summary] API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Entre em contato com o suporte.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const rawSummary = data.choices?.[0]?.message?.content?.trim() || '';
    const summary = sanitizeTechnicalSummary(rawSummary);

    console.log('[generate-report-summary] Resumo gerado com sucesso, tamanho:', summary.length);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-report-summary] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
