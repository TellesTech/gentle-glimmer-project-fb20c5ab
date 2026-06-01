import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { project_id, period_start, period_end } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    // Validate optional period (YYYY-MM-DD)
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    const periodStart = period_start && isoDate.test(period_start) ? period_start : null;
    const periodEnd = period_end && isoDate.test(period_end) ? period_end : null;

    // 1. Fetch project + site + company
    const { data: project } = await supabase
      .from("projects")
      .select("*, sites(name, city, state, company_id, companies(name, responsible_name, responsible_email, cnpj, address, city, state, phone))")
      .eq("id", project_id)
      .single();
    if (!project) throw new Error("Projeto não encontrado");

    // 2. Fetch stages
    const { data: stages } = await supabase
      .from("project_stages")
      .select("name, description, progress, status, planned_start, planned_end, actual_start, actual_end")
      .eq("project_id", project_id)
      .order("order_index");

    // 3. Fetch RDOs (limit reduced — too many overflows the AI prompt and times out the function)
    const RDO_LIMIT = 30;
    const PHOTO_LIMIT = 80;
    let reportsQuery = supabase
      .from("reports")
      .select("id, date, rdo_number, ai_summary, comments, shift, weather, location, daily_progress, actual_workforce, productive_hours, start_time, end_time")
      .eq("project_id", project_id);
    if (periodStart) reportsQuery = reportsQuery.gte("date", periodStart);
    if (periodEnd) reportsQuery = reportsQuery.lte("date", periodEnd);
    const { data: reports } = await reportsQuery
      .order("date", { ascending: false })
      .limit(RDO_LIMIT);
    // Re-sort ascending for narrative
    (reports || []).sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));
    console.log(`[generate-service-report] Project ${project_id}: ${reports?.length || 0} RDOs loaded (period: ${periodStart || "—"} → ${periodEnd || "—"})`);

    const reportIds = (reports || []).map((r: any) => r.id);

    // 4. Fetch activities, deviations, photos, attendance, equipment in parallel
    const [activitiesRes, deviationsRes, photosRes, attendanceRes, equipmentRes] = await Promise.all([
      reportIds.length > 0
        ? supabase.from("report_activities").select("description, notes, progress, completed, report_id").in("report_id", reportIds)
        : { data: [] },
      reportIds.length > 0
        ? supabase.from("report_deviations").select("description, type, impact, action_taken, report_id").in("report_id", reportIds)
        : { data: [] },
      reportIds.length > 0
        ? supabase.from("report_photos").select("url, description, report_id").in("report_id", reportIds).limit(PHOTO_LIMIT)
        : { data: [] },
      reportIds.length > 0
        ? supabase.from("report_attendance").select("user_name, function_role, present, arrival_time, departure_time, report_id").in("report_id", reportIds)
        : { data: [] },
      reportIds.length > 0
        ? supabase.from("report_equipment").select("equipment_name, hours_used, quantity_used, status, observations, report_id").in("report_id", reportIds)
        : { data: [] },
    ]);

    const activities = activitiesRes.data || [];
    const deviations = deviationsRes.data || [];
    const photos = photosRes.data || [];
    const attendance = attendanceRes.data || [];
    const equipment = equipmentRes.data || [];
    console.log(`[generate-service-report] Loaded: ${activities.length} acts, ${deviations.length} devs, ${photos.length} photos, ${attendance.length} att, ${equipment.length} eq`);

    // 5. Aggregate workforce data
    const workforceByRole: Record<string, number> = {};
    let totalHH = 0;
    let peakWorkforce = 0;
    const workforcePerDay: Record<string, number> = {};

    for (const att of attendance) {
      if (!att.present) continue;
      const role = att.function_role || "Não especificado";
      workforceByRole[role] = (workforceByRole[role] || 0) + 1;

      // Calculate HH per worker
      if (att.arrival_time && att.departure_time) {
        const [ah, am] = att.arrival_time.split(":").map(Number);
        const [dh, dm] = att.departure_time.split(":").map(Number);
        const hours = (dh + dm / 60) - (ah + am / 60);
        if (hours > 0) totalHH += hours;
      }
    }

    // Peak workforce per RDO
    for (const r of (reports || [])) {
      const dayCount = attendance.filter((a: any) => a.report_id === r.id && a.present).length;
      workforcePerDay[r.date] = dayCount;
      if (dayCount > peakWorkforce) peakWorkforce = dayCount;
    }

    const workforceRoleSummary = Object.entries(workforceByRole)
      .sort((a, b) => b[1] - a[1])
      .map(([role, count]) => `${role}: ${count} registros`)
      .join(", ");

    // 6. Aggregate equipment data
    const equipmentMap: Record<string, { totalHours: number; maxQty: number; statuses: string[] }> = {};
    for (const eq of equipment) {
      const name = eq.equipment_name || "N/A";
      if (!equipmentMap[name]) equipmentMap[name] = { totalHours: 0, maxQty: 0, statuses: [] };
      equipmentMap[name].totalHours += eq.hours_used || 0;
      if ((eq.quantity_used || 0) > equipmentMap[name].maxQty) equipmentMap[name].maxQty = eq.quantity_used || 1;
      if (eq.status && !equipmentMap[name].statuses.includes(eq.status)) equipmentMap[name].statuses.push(eq.status);
    }

    const equipmentSummary = Object.entries(equipmentMap)
      .map(([name, d]) => `- ${name}: ${d.maxQty} un., ${d.totalHours.toFixed(1)}h acumuladas, status: ${d.statuses.join("/") || "N/A"}`)
      .join("\n");

    // 7. Fetch system settings
    const { data: sysSettings } = await supabase.from("system_settings").select("system_name").limit(1).single();

    // 8. Build context
    const site = (project as any).sites;
    const company = site?.companies;

    const rdoSummaries = (reports || []).map((r: any) => {
      const rActs = activities.filter((a: any) => a.report_id === r.id);
      const rDevs = deviations.filter((d: any) => d.report_id === r.id);
      const rAtt = attendance.filter((a: any) => a.report_id === r.id && a.present);
      const rEq = equipment.filter((e: any) => e.report_id === r.id);
      return {
        date: r.date, rdo: r.rdo_number,
        summary: r.ai_summary || r.comments || "",
        progress: r.daily_progress, workforce: r.actual_workforce || rAtt.length,
        hours: r.productive_hours, shift: r.shift, weather: r.weather,
        activities: rActs.map((a: any) => `${a.description}${a.progress ? ` (${a.progress}%)` : ""}${a.completed ? " ✓" : ""}`).join("; "),
        deviations: rDevs.map((d: any) => `[${d.type}/${d.impact}] ${d.description} → Ação: ${d.action_taken || "N/A"}`).join("; "),
        equipment: rEq.map((e: any) => `${e.equipment_name} (${e.hours_used || 0}h, ${e.status || "N/A"})`).join("; "),
      };
    });

    const stagesText = (stages || []).map((s: any) =>
      `- ${s.name}: ${s.status}, progresso ${s.progress || 0}%, ${s.description || ""} | Previsto: ${s.planned_start || "?"} a ${s.planned_end || "?"} | Real: ${s.actual_start || "?"} a ${s.actual_end || "?"}`
    ).join("\n");

    // Calcula progresso real: prioriza projects.progress; depois último daily_progress
    // dos RDOs; depois média ponderada das stages. Se nada confiável, deixa null.
    let computedProgress: number | null = null;
    const rawProjectProgress = Number((project as any).progress);
    if (Number.isFinite(rawProjectProgress) && rawProjectProgress > 0) {
      computedProgress = Math.min(100, Math.max(0, rawProjectProgress));
    } else {
      const sortedDesc = [...(reports || [])].sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));
      const lastWithProg = sortedDesc.find((r: any) => Number.isFinite(Number(r.daily_progress)) && Number(r.daily_progress) > 0);
      if (lastWithProg) {
        computedProgress = Math.min(100, Math.max(0, Number(lastWithProg.daily_progress)));
      } else if (stages && stages.length > 0) {
        const avg = stages.reduce((acc: number, s: any) => acc + (Number(s.progress) || 0), 0) / stages.length;
        if (avg > 0) computedProgress = Math.min(100, Math.max(0, Math.round(avg)));
      }
    }
    const progressLine = computedProgress !== null && computedProgress > 0
      ? `- **Progresso geral**: ${computedProgress}%`
      : `- **Progresso geral**: não informado (NÃO MENCIONE percentual numérico de progresso geral no texto; descreva o avanço qualitativamente)`;

    const photosText = photos.slice(0, 80).map((p: any, i: number) => `Foto ${i + 1}: "${(p.description || "sem descrição").slice(0, 100)}" - ${p.url}`).join("\n");

    // Calculate deviation summary
    const deviationsByType: Record<string, number> = {};
    for (const d of deviations) {
      deviationsByType[d.type] = (deviationsByType[d.type] || 0) + 1;
    }
    const deviationSummary = Object.entries(deviationsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(", ");

    // 9. Build professional prompt
    const prompt = `Você é um engenheiro técnico sênior responsável por elaborar Relatórios de Serviço profissionais para entrega ao cliente.
O relatório deve seguir padrão técnico formal de engenharia industrial, com linguagem objetiva, dados quantitativos e estrutura organizada.

## ESTRUTURA OBRIGATÓRIA DO RELATÓRIO

1. DADOS DO CLIENTE (preenchidos automaticamente)
2. DADOS DA EMPRESA (preenchidos automaticamente)
3. ESCOPO DOS SERVIÇOS → scope_description
4. SEGURANÇA DO TRABALHO → safety_notes
5. MOBILIZAÇÃO DE RECURSOS → resources_section (NOVO)
6. CRONOGRAMA EXECUTIVO → schedule_summary (NOVO)
7. EXECUÇÃO DOS SERVIÇOS → execution_sections
8. ATIVIDADES FORA DO ESCOPO → out_of_scope_sections (se aplicável)
9. CONCLUSÃO E RECOMENDAÇÕES → conclusion + recommendations

## DADOS DO PROJETO
- **Projeto**: ${project.name}
- **Descrição**: ${project.description || "N/A"}
- **Cliente**: ${company?.name || "N/A"}
- **CNPJ**: ${company?.cnpj || "N/A"}
- **Endereço**: ${company?.address || "N/A"}, ${company?.city || ""}/${company?.state || ""}
- **Contato (A/C)**: ${company?.responsible_name || "N/A"} - ${company?.responsible_email || "N/A"} - ${company?.phone || "N/A"}
- **Unidade/Site**: ${site?.name || "N/A"} - ${site?.city || ""}/${site?.state || ""}
- **Empresa Executora**: ${sysSettings?.system_name || "Empresa"}
- **Período do relatório**: ${periodStart || project.start_date || "N/A"} a ${periodEnd || project.end_date || "N/A"}${periodStart || periodEnd ? " (filtro aplicado pelo usuário)" : " (período contratual)"}
${progressLine}

## DADOS DE MÃO DE OBRA AGREGADOS
- **Total de HH (homem-hora) acumulado**: ${totalHH.toFixed(1)} HH
- **Pico de efetivo**: ${peakWorkforce} colaboradores/dia
- **Efetivo médio**: ${Object.keys(workforcePerDay).length > 0 ? (Object.values(workforcePerDay).reduce((a, b) => a + b, 0) / Object.keys(workforcePerDay).length).toFixed(1) : "N/A"} colaboradores/dia
- **Distribuição por função**: ${workforceRoleSummary || "Sem dados"}

## DADOS DE EQUIPAMENTOS AGREGADOS
${equipmentSummary || "Sem equipamentos registrados"}

## DESVIOS REGISTRADOS
- **Total**: ${deviations.length} ocorrências
- **Por tipo**: ${deviationSummary || "Nenhum"}

## ETAPAS DO PROJETO (Cronograma)
${stagesText || "Sem etapas cadastradas"}

## RDOs DETALHADOS (${(reports || []).length} relatórios diários)
${JSON.stringify(rdoSummaries, null, 1)}

## FOTOS DISPONÍVEIS (${photos.length} fotos)
${photosText}

## INSTRUÇÕES DE REDAÇÃO

### REGRAS DE LINGUAGEM
- Use **linguagem técnica formal** de engenharia (normas ABNT, terminologia industrial)
- Escreva na **terceira pessoa** ("foram executados", "procedeu-se à inspeção")
- Inclua **dados quantitativos** em TODAS as seções: datas, percentuais, medições, quantidades
- Use **formatação HTML** no conteúdo: <strong> para destaque, <ul>/<li> para listas, <br> para quebras
- NÃO invente dados — use APENAS informações dos RDOs fornecidos
- Se dados forem insuficientes, indique: "<em>[Completar com dados de campo]</em>"
- **NUNCA escreva "0%" nem "progresso de 0%"** na conclusão ou em qualquer seção. Se o progresso geral não estiver disponível nos dados acima, descreva o avanço de forma qualitativa (ex.: "execução concluída conforme planejado", "serviços entregues dentro do escopo contratado") sem citar percentual numérico.
- **NUNCA inicie qualquer seção com cabeçalhos do tipo "Estado em DD/MM/YYYY", "Atualizado em ...", "Status em ...", "Data: ..." ou semelhantes.** A data já consta na capa e nos metadados do relatório. Vá direto ao texto técnico.

### 3. ESCOPO DOS SERVIÇOS (scope_description)
Redação técnica descrevendo:
- Objeto do contrato e serviços contratados
- Áreas/equipamentos/sistemas envolvidos (nomenclatura técnica)
- Técnicas e metodologias aplicadas
- Normas técnicas de referência quando aplicável
- Período efetivo de execução com datas

### 4. SEGURANÇA DO TRABALHO (safety_notes)
Informações obrigatórias:
- DDS realizados com temas e frequência
- EPIs utilizados (listar todos)
- Procedimentos: PT (Permissão de Trabalho), APR, bloqueio/etiquetagem
- Liberações obtidas (trabalho em altura, espaço confinado, trabalho a quente)
- Registro de incidentes/acidentes (zero acidentes se aplicável)
- Condições climáticas relevantes

### 5. MOBILIZAÇÃO DE RECURSOS (resources_section) — NOVA SEÇÃO
Texto técnico contendo:
- <strong>Efetivo mobilizado</strong>: quantitativo por função/especialidade, HH total acumulado, pico e média diária
- <strong>Equipamentos e ferramentas</strong>: lista de equipamentos mobilizados com quantidade e horas de uso
- Apresentar dados em formato de lista ou tabela HTML

### 6. CRONOGRAMA EXECUTIVO (schedule_summary) — NOVA SEÇÃO
Texto técnico contendo:
- Resumo do cronograma previsto vs realizado para cada etapa
- Marcos alcançados com datas
- Análise de aderência ao cronograma (adiantado/atrasado/conforme)
- Justificativas para desvios de prazo quando houver

### 7. EXECUÇÃO DOS SERVIÇOS (execution_sections)
Seções com sub-seções quando aplicável.

REGRAS DE TÍTULO (obrigatório):
- O campo "title" deve conter APENAS o nome da seção (ex: "Tratamento e Pintura de Perfis", "Mobilização para a Área").
- NUNCA inclua números no início do título (sem "5.1", "7.2", "1.", "2.", etc.). A numeração será adicionada automaticamente pelo sistema.
- NÃO repita o título da seção dentro do conteúdo (não comece o "content" com <h2>, <h3> ou linhas como "5.1 Tratamento...").
- NUNCA inclua um cabeçalho "REGISTRO FOTOGRÁFICO" no "content" — o sistema renderiza esse rótulo automaticamente quando há fotos.
- NÃO inclua numeração (5.1, 7.2.1, etc.) em NENHUM heading dentro do "content".

REGRAS DE CONTEÚDO (obrigatório):
- Cada seção deve conter:
  - Descrição técnica detalhada da atividade
  - Datas de início e término quando disponível
  - Materiais, consumíveis e técnicas empregadas
  - Resultados e medições obtidas
  - Referência às fotos relevantes (selecionar até 6 por seção — distribua amplamente entre seções e sub-seções)
  - Status de conclusão (concluído, em andamento, pendente)

### REGRA CRÍTICA DE FOTOS
- Existem ${photos.length} fotos disponíveis. Use o MÁXIMO possível.
- Cada seção de execução DEVE ter fotos associadas quando existirem fotos relevantes.
- Distribua as fotos amplamente — NÃO concentre todas em poucas seções nem repita a mesma URL em seções diferentes.
- Priorize: 1 a 6 fotos por seção/sub-seção. Mais seções com 2-3 fotos é melhor que poucas com 6.

### 8. FORA DO ESCOPO (out_of_scope_sections) — se aplicável
Atividades extras executadas fora do escopo contratual. Array vazio se não houver.
Aplique as mesmas regras de título (sem numeração) e conteúdo (sem repetir o título).

### 9. CONCLUSÃO E RECOMENDAÇÕES
- **conclusion**: Análise técnica de desempenho incluindo:
  - Resumo dos serviços concluídos com percentual geral
  - Indicadores: HH total, dias trabalhados, taxa de produtividade
  - Avaliação de conformidade com o escopo contratado
  - Menção a zero acidentes se aplicável
- **recommendations**: Array de recomendações técnicas específicas e acionáveis`;

    // 10. Call Lovable AI with enhanced tool schema (with internal timeout to avoid edge function timeout)
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 120_000); // 120s max
    console.log(`[generate-service-report] Calling AI gateway, prompt size: ${prompt.length} chars`);
    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: aiController.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é um engenheiro técnico sênior especializado em relatórios de serviço industrial. Produza relatórios profissionais com linguagem técnica formal, dados quantitativos reais e formatação HTML para negrito, listas e tabelas. Siga rigorosamente a estrutura solicitada." },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_report",
                description: "Gera o relatório de serviço estruturado profissional",
                parameters: {
                  type: "object",
                  properties: {
                    scope_description: { type: "string", description: "HTML: Texto técnico detalhado do escopo dos serviços com dados quantitativos" },
                    safety_notes: { type: "string", description: "HTML: Segurança do trabalho com DDS, EPIs, procedimentos e indicadores" },
                    resources_section: { type: "string", description: "HTML: Mobilização de recursos — efetivo por função com HH, equipamentos mobilizados com horas de uso" },
                    schedule_summary: { type: "string", description: "HTML: Cronograma executivo — previsto vs realizado, marcos, aderência" },
                    execution_sections: {
                      type: "array",
                      description: "Seções de execução numeradas (5.1, 5.2...)",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string", description: "Título numerado (ex: 5.1 Inspeção dos Módulos)" },
                          content: { type: "string", description: "HTML: Descrição técnica com dados quantitativos" },
                          photo_urls: { type: "array", items: { type: "string" }, description: "URLs de fotos relevantes (até 6, distribua amplamente)" },
                          subsections: {
                            type: "array",
                            description: "Sub-seções detalhadas (5.1.1, 5.1.2...)",
                            items: {
                              type: "object",
                              properties: {
                                title: { type: "string", description: "Título da sub-seção" },
                                content: { type: "string", description: "HTML: Descrição técnica detalhada" },
                                photo_urls: { type: "array", items: { type: "string" }, description: "URLs de fotos (até 6)" },
                              },
                              required: ["title", "content"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["title", "content"],
                        additionalProperties: false,
                      },
                    },
                    out_of_scope_sections: {
                      type: "array",
                      description: "Atividades fora do escopo original (opcional)",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          content: { type: "string", description: "HTML: Descrição da atividade fora do escopo" },
                          photo_urls: { type: "array", items: { type: "string" } },
                        },
                        required: ["title", "content"],
                        additionalProperties: false,
                      },
                    },
                    conclusion: { type: "string", description: "HTML: Conclusão técnica com indicadores de desempenho" },
                    recommendations: {
                      type: "array",
                      items: { type: "string" },
                      description: "Recomendações técnicas específicas e acionáveis",
                    },
                  },
                  required: ["scope_description", "safety_notes", "resources_section", "schedule_summary", "conclusion", "execution_sections", "recommendations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_report" } },
        }),
      });
    } catch (e: any) {
      clearTimeout(aiTimeout);
      if (e?.name === "AbortError") {
        console.error("[generate-service-report] AI gateway timeout after 120s");
        return new Response(JSON.stringify({ error: "A IA demorou muito para responder (>120s). Tente novamente — projetos com muitos RDOs podem exigir mais tempo." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
    clearTimeout(aiTimeout);
    console.log(`[generate-service-report] AI gateway responded: ${aiResponse.status}`);

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
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou dados estruturados");
    }

    let reportData: any;
    try {
      reportData = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      throw new Error("Erro ao processar resposta da IA");
    }

    // ─── POST-PROCESSING ──────────────────────────────────────────────
    // 1) Strip leading number prefixes from section titles ("5.1 X" → "X")
    //    so the PDF generator can apply consistent auto-numbering.
    // 2) Remove duplicate inline headings inside content (e.g. content starts
    //    with "<h2>5.1 X</h2>" or "<h3>4. SEGURANÇA</h3>" matching the title).
    // 3) Strip dangling/empty <p></p> and <p><br></p> fragments.
    // 4) Dedupe photo URLs across sections.
    const stripLeadingNumber = (s: string): string =>
      (s || "").replace(/^\s*\d+(\.\d+)*\.?\s*[-–—]?\s*/, "").trim();

    const normalizeForCompare = (s: string): string =>
      (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^\s*\d+(\.\d+)*\.?\s*[-–—]?\s*/, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();

    const cleanContentHtml = (html: string, title: string): string => {
      if (!html) return "";
      let out = html
        // Remove "Estado em DD/MM/YYYY" / "Atualizado em ..." prefixes the AI sometimes injects
        .replace(/^\s*(<p[^>]*>)?\s*(Estado|Atualizado|Status|Data)\s+em\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*(<br\s*\/?>)?\s*/i, "$1")
        .replace(/(<p[^>]*>)\s*(Estado|Atualizado|Status|Data)\s+em\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*(<br\s*\/?>)?\s*/gi, "$1")
        // Drop empty paragraphs
        .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, "")
        // Trim stray closing/opening tags at boundaries
        .replace(/^\s*(<\/p>|<\/h[1-6]>|<\/li>|<\/ul>|<\/ol>)+/i, "")
        .replace(/(<p>|<h[1-6][^>]*>)+\s*$/i, "")
        // Remove any "REGISTRO FOTOGRÁFICO" headings the AI may insert —
        // the renderer adds this label automatically when there are photos.
        .replace(/<(h[1-6])[^>]*>\s*registro\s+fotogr[áa]fico\s*<\/\1>/gi, "")
        .replace(/<p[^>]*>\s*<strong>\s*registro\s+fotogr[áa]fico\s*<\/strong>\s*<\/p>/gi, "")
        // Strip leading "5.1 ", "7.2.1 — ", etc. inside any heading anywhere
        .replace(/<(h[1-6])([^>]*)>\s*(\d+(?:\.\d+)*\.?\s*[-–—]?\s*)/gi, "<$1$2>");

      // Drop the first heading if it duplicates the section title
      if (title) {
        const titleNorm = normalizeForCompare(title);
        out = out.replace(
          /^\s*<h([1-6])[^>]*>([\s\S]*?)<\/h\1>\s*/i,
          (match, _lvl, inner) => {
            const innerNorm = normalizeForCompare(String(inner).replace(/<[^>]+>/g, ""));
            if (
              titleNorm &&
              (innerNorm === titleNorm ||
                innerNorm.includes(titleNorm) ||
                titleNorm.includes(innerNorm))
            ) {
              return "";
            }
            return match;
          },
        );
      }
      return out.trim();
    };

    const seenPhotoUrls = new Set<string>();
    const dedupePhotos = (urls?: string[]): string[] | undefined => {
      if (!Array.isArray(urls)) return urls;
      const out: string[] = [];
      for (const u of urls) {
        if (!u || seenPhotoUrls.has(u)) continue;
        seenPhotoUrls.add(u);
        out.push(u);
      }
      return out;
    };

    const cleanSection = (sec: any): any => {
      if (!sec || typeof sec !== "object") return sec;
      const cleanedTitle = stripLeadingNumber(String(sec.title || ""));
      return {
        ...sec,
        title: cleanedTitle,
        content: cleanContentHtml(String(sec.content || ""), cleanedTitle),
        photo_urls: dedupePhotos(sec.photo_urls),
        subsections: Array.isArray(sec.subsections) ? sec.subsections.map(cleanSection) : sec.subsections,
      };
    };

    if (Array.isArray(reportData.execution_sections)) {
      reportData.execution_sections = reportData.execution_sections.map(cleanSection);
    }
    if (Array.isArray(reportData.out_of_scope_sections)) {
      reportData.out_of_scope_sections = reportData.out_of_scope_sections.map(cleanSection);
    }
    // Also clean the standalone HTML fields (no title to dedupe against)
    for (const k of ["scope_description", "safety_notes", "resources_section", "schedule_summary", "conclusion"]) {
      if (typeof reportData[k] === "string") {
        reportData[k] = cleanContentHtml(reportData[k], "");
      }
    }

    // Validate minimum content length — replace short/garbage AI output with
    // safe technical fallbacks so the report never shows "Olá" or similar.
    const stripTags = (s: string) => String(s || "").replace(/<[^>]+>/g, "").trim();
    const fallbacks: Record<string, string> = {
      scope_description: "<p>Os serviços foram executados conforme planejamento técnico aprovado, abrangendo as atividades programadas no escopo contratual e seguindo procedimentos operacionais padronizados.</p>",
      safety_notes: "<p>Todas as atividades foram realizadas mediante uso obrigatório de EPIs, com Diálogo Diário de Segurança (DDS) registrado e equipe alinhada aos procedimentos de segurança vigentes.</p>",
      conclusion: "<p>Os serviços foram concluídos atendendo aos requisitos técnicos e prazos estabelecidos, sem registro de não conformidades relevantes no período avaliado.</p>",
    };
    for (const [k, fallback] of Object.entries(fallbacks)) {
      const plain = stripTags(reportData[k] || "");
      if (plain.length < 30) {
        console.warn(`generate-service-report: AI returned short ${k} ("${plain}"), using fallback`);
        reportData[k] = fallback;
      }
    }

    // Return structured data + project metadata
    return new Response(
      JSON.stringify({
        success: true,
        report: {
          ...reportData,
          project_name: project.name,
          client_name: company?.name || "",
          client_unit: `${site?.name || ""} - ${site?.city || ""}`,
          client_contact: company?.responsible_name || "",
          start_date: periodStart || project.start_date,
          end_date: periodEnd || project.end_date,
          total_rdos: (reports || []).length,
          total_photos: photos.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-service-report error:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
