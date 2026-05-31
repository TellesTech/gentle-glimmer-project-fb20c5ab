import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action || "process";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user company from auth
    const authHeader = req.headers.get("Authorization");
    let userCompanyId: string | null = null;
    if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
        userCompanyId = profile?.company_id;
      }
    }

    // ============ ANALYZE PRODUCTIVITY ============
    if (action === "analyze-productivity") {
      if (!lovableKey) throw new Error("IA não disponível");
      const { records, delays, start_date, end_date } = body;

      const prompt = `Você é um consultor especialista em produtividade industrial e controle de Homem-Hora (HH).

Analise os dados abaixo do período ${start_date} a ${end_date} e forneça:

1. **RESUMO EXECUTIVO**: Visão geral da produtividade
2. **ANÁLISE DE PRODUTIVIDADE POR FUNÇÃO**: Quais funções consomem mais HH, eficiência
3. **DESPERDÍCIOS IDENTIFICADOS**: Horas extras excessivas, padrões de ineficiência
4. **PADRÕES DE ATRASO**: Tipos mais comuns, frequência, impacto total
5. **PREVISÃO DE HH**: Baseado na média dos dados, projete o HH para os próximos 30 dias
6. **DIMENSIONAMENTO DE EQUIPE**: Sugira a equipe ideal por função baseado na demanda
7. **RECOMENDAÇÕES**: 3-5 ações concretas para otimizar

Dados de HH (${records?.length || 0} registros):
${JSON.stringify(records?.slice(0, 200), null, 0)}

Atrasos (${delays?.length || 0} registros):
${JSON.stringify(delays?.slice(0, 50), null, 0)}

Responda em português. Seja objetivo e use números.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é um consultor industrial especializado em produtividade e controle de Homem-Hora." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Erro na análise de IA");
      }

      const aiData = await aiResp.json();
      const analysis = aiData.choices?.[0]?.message?.content || "Análise indisponível.";

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ IMPORT SPREADSHEET ============
    if (action === "import-spreadsheet") {
      const { rawData, project_id: projId } = body;
      if (!rawData || !Array.isArray(rawData) || rawData.length === 0) throw new Error("Nenhum dado recebido");

      if (!lovableKey) throw new Error("IA não disponível para mapeamento");

      const sampleRows = rawData.slice(0, 5);
      const mapPrompt = `Mapeie as colunas da planilha para os campos do sistema de HH.

Campos do sistema: worker_name (nome), function_role (função), date (data), start_time (horário início), end_time (horário fim), activity_name (atividade), normal_hours, overtime_75, overtime_100, night_bonus, compensation_hours.

Amostra de dados:
${JSON.stringify(sampleRows, null, 2)}

Retorne o mapeamento e os dados convertidos.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você mapeia dados de planilhas para um sistema de HH. Retorne apenas JSON." },
            { role: "user", content: mapPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "map_spreadsheet",
              description: "Map spreadsheet data to workforce records",
              parameters: {
                type: "object",
                properties: {
                  records: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        worker_name: { type: "string" },
                        function_role: { type: "string" },
                        date: { type: "string" },
                        start_time: { type: "string" },
                        end_time: { type: "string" },
                        activity_name: { type: "string" },
                        normal_hours: { type: "number" },
                        overtime_75: { type: "number" },
                        overtime_100: { type: "number" },
                        night_bonus: { type: "number" },
                        compensation_hours: { type: "number" },
                      },
                      required: ["worker_name", "date"],
                    },
                  },
                },
                required: ["records"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "map_spreadsheet" } },
        }),
      });

      if (!aiResp.ok) throw new Error("Erro no mapeamento de IA");
      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("IA não retornou mapeamento");

      const parsed = JSON.parse(toolCall.function.arguments);
      const mapped = (parsed.records || []).map((r: any) => ({
        worker_name: r.worker_name || "Sem nome",
        function_role: normalizeFunction(r.function_role || ""),
        date: r.date,
        start_time: r.start_time || "07:00",
        end_time: r.end_time || "17:00",
        activity_name: r.activity_name || "Importado",
        normal_hours: r.normal_hours || 0,
        overtime_75: r.overtime_75 || 0,
        overtime_100: r.overtime_100 || 0,
        night_bonus: r.night_bonus || 0,
        compensation_hours: r.compensation_hours || 0,
        project_id: projId || null,
        company_id: userCompanyId,
        processed_by_ai: true,
      }));

      // Deduplication: check existing records
      const dates = [...new Set(mapped.map((r: any) => r.date).filter(Boolean))];
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      let skipped = 0;

      if (dates.length > 0 && userCompanyId) {
        const { data: existing } = await supabase
          .from("workforce_database")
          .select("id, worker_name, date, report_id")
          .eq("company_id", userCompanyId)
          .in("date", dates);

        const existingMap = new Map<string, any>();
        (existing || []).forEach((e: any) => {
          existingMap.set(`${e.worker_name?.trim()?.toUpperCase()}|${e.date}`, e);
        });

        for (const rec of mapped) {
          const key = `${rec.worker_name?.trim()?.toUpperCase()}|${rec.date}`;
          const ex = existingMap.get(key);
          if (ex) {
            if (ex.report_id) { skipped++; continue; } // RDO has precedence
            toUpdate.push({ ...rec, id: ex.id });
          } else {
            toInsert.push(rec);
          }
        }
      } else {
        toInsert.push(...mapped);
      }

      // Insert new records
      const batchSize = 100;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        await supabase.from("workforce_database").insert(toInsert.slice(i, i + batchSize));
      }

      // Update existing spreadsheet records
      for (const rec of toUpdate) {
        const { id, ...data } = rec;
        await supabase.from("workforce_database").update(data).eq("id", id);
      }

      const msg = `${toInsert.length} inseridos, ${toUpdate.length} atualizados, ${skipped} ignorados (RDO)`;
      return new Response(JSON.stringify({ message: msg, count: toInsert.length + toUpdate.length, inserted: toInsert.length, updated: toUpdate.length, skipped }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ DEFAULT: PROCESS RDOs ============
    const { project_id, start_date, end_date } = body;
    if (!start_date || !end_date) throw new Error("start_date e end_date são obrigatórios");

    let reportsQuery = supabase
      .from("reports")
      .select(`id, date, project_id, projects!inner(name, site_id, sites!inner(company_id)), report_attendance(id, user_id, user_name, function_role, arrival_time, departure_time, present)`)
      .gte("date", start_date)
      .lte("date", end_date);

    if (project_id) reportsQuery = reportsQuery.eq("project_id", project_id);

    const { data: reports, error: reportsError } = await reportsQuery;
    if (reportsError) throw reportsError;
    if (!reports || reports.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum RDO encontrado no período", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allAttendance: any[] = [];
    for (const report of reports) {
      const attendance = report.report_attendance as any[];
      if (attendance) {
        for (const att of attendance) {
          if (att.present && att.user_name) allAttendance.push({ ...att, _report: report });
        }
      }
    }

    const userIds = [...new Set(allAttendance.map(a => a.user_id).filter(Boolean))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, job_title").in("id", userIds);
      if (profiles) profileMap = Object.fromEntries(profiles.filter(p => p.job_title).map(p => [p.id, p.job_title]));
    }

    const unmatchedNames = [...new Set(allAttendance.filter(a => !(a.user_id && profileMap[a.user_id])).map(a => a.user_name?.trim()).filter(Boolean))];
    let nameMap: Record<string, string> = {};
    if (unmatchedNames.length > 0) {
      const { data: nameProfiles } = await supabase.from("profiles").select("name, job_title").not("job_title", "is", null);
      if (nameProfiles) {
        for (const p of nameProfiles) {
          if (p.job_title && p.name) nameMap[p.name.trim().toUpperCase()] = p.job_title;
        }
      }
    }

    const attendanceRecords: any[] = [];
    for (const att of allAttendance) {
      const report = att._report;
      const project = report.projects as any;
      const companyId = project?.sites?.company_id;
      const nameKey = att.user_name?.trim()?.toUpperCase();
      const rawRole = (att.user_id && profileMap[att.user_id]) || (nameKey && nameMap[nameKey]) || att.function_role || "Convencional";

      attendanceRecords.push({
        report_id: report.id, project_id: report.project_id, company_id: companyId || userCompanyId,
        attendance_id: att.id, activity_name: project?.name || "Sem atividade", date: report.date,
        worker_name: att.user_name, function_role: normalizeFunction(rawRole),
        start_time: att.arrival_time || "07:00", end_time: att.departure_time || "17:00",
      });
    }

    if (attendanceRecords.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum registro de presença encontrado", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by worker+date and merge shifts
    const workerDayGroups: Record<string, any[]> = {};
    for (const rec of attendanceRecords) {
      const key = `${rec.worker_name?.trim()?.toUpperCase()}|${rec.date}`;
      (workerDayGroups[key] ??= []).push(rec);
    }

    let processedRecords = Object.values(workerDayGroups).map(group => {
      const first = group[0];
      // Collect all shifts for this worker+day
      const shifts = group.map(r => ({ start: r.start_time, end: r.end_time })).filter(s => s.start && s.end);

      // Convert to minute intervals, merge overlapping/consecutive
      const intervals = shifts.map(s => {
        const sMin = parseTime(s.start) * 60;
        const eMin = parseTime(s.end) * 60;
        return { start: sMin, end: eMin <= sMin ? eMin + 1440 : eMin };
      }).sort((a, b) => a.start - b.start);

      const merged: Array<{ start: number; end: number }> = intervals.length > 0 ? [{ ...intervals[0] }] : [];
      for (let i = 1; i < intervals.length; i++) {
        const last = merged[merged.length - 1];
        if (intervals[i].start <= last.end) {
          last.end = Math.max(last.end, intervals[i].end);
        } else {
          merged.push({ ...intervals[i] });
        }
      }

      const totalMinutes = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
      const workedMinutes = Math.max(0, totalMinutes - 60); // 1 lunch deduction
      const workedHours = workedMinutes / 60;

      const normalHours = Math.min(workedHours, 9);
      const extraHours = Math.max(0, workedHours - 9);
      const overtime75 = Math.min(extraHours, 2);
      const overtime100 = Math.max(0, extraHours - 2);

      // Night bonus (22:00-05:00) over merged intervals
      let nightMin = 0;
      const NIGHT_START = 22 * 60;
      const NIGHT_END = 5 * 60;
      for (const iv of merged) {
        const s = iv.start % 1440;
        const e = iv.end % 1440 || 1440;
        if (e > s) {
          if (s < NIGHT_END) nightMin += Math.min(e, NIGHT_END) - s;
          if (e > NIGHT_START) nightMin += e - Math.max(s, NIGHT_START);
        } else {
          // crosses midnight
          if (s < NIGHT_END) nightMin += NIGHT_END - s;
          if (1440 > NIGHT_START) nightMin += 1440 - Math.max(s, NIGHT_START);
          if (e <= NIGHT_END) nightMin += e;
          else nightMin += NIGHT_END;
          if (e > NIGHT_START) nightMin += e - NIGHT_START;
        }
      }

      // Use earliest start and latest end for the merged record
      const mergedStart = group.reduce((earliest: string | null, r: any) =>
        !r.start_time ? earliest : (!earliest || r.start_time < earliest ? r.start_time : earliest), null) || first.start_time;
      const mergedEnd = group.reduce((latest: string | null, r: any) =>
        !r.end_time ? latest : (!latest || r.end_time > latest ? r.end_time : latest), null) || first.end_time;

      return {
        ...first,
        start_time: mergedStart,
        end_time: mergedEnd,
        normal_hours: Math.round(normalHours * 100) / 100,
        compensation_hours: 0,
        overtime_75: Math.round(overtime75 * 100) / 100,
        overtime_100: Math.round(overtime100 * 100) / 100,
        night_bonus: Math.round(Math.max(0, nightMin / 60) * 100) / 100,
        processed_by_ai: false,
      };
    });

    if (lovableKey && attendanceRecords.length <= 200) {
      try {
        const prompt = `Analise os registros de presença abaixo e calcule as horas trabalhistas conforme CLT brasileira:\n- HN: até 9h/dia\n- COM: compensação\n- HH-75%: primeiras 2h extras\n- HH-100%: extras acima de 2h\n- ADN: entre 22h e 05h\n\nRegistros:\n${JSON.stringify(attendanceRecords.map(r => ({ nome: r.worker_name, data: r.date, inicio: r.start_time, fim: r.end_time, funcao: r.function_role })), null, 2)}\n\nResponda APENAS com JSON array.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "system", content: "Especialista em cálculos trabalhistas CLT. Retorne apenas JSON." }, { role: "user", content: prompt }],
            tools: [{ type: "function", function: { name: "calculate_hours", description: "Return calculated work hours", parameters: { type: "object", properties: { records: { type: "array", items: { type: "object", properties: { index: { type: "number" }, normal_hours: { type: "number" }, compensation_hours: { type: "number" }, overtime_75: { type: "number" }, overtime_100: { type: "number" }, night_bonus: { type: "number" } }, required: ["index", "normal_hours", "overtime_75", "overtime_100", "night_bonus"] } } }, required: ["records"] } } }],
            tool_choice: { type: "function", function: { name: "calculate_hours" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed.records && Array.isArray(parsed.records)) {
              for (const calc of parsed.records) {
                if (calc.index >= 0 && calc.index < processedRecords.length) {
                  processedRecords[calc.index] = { ...processedRecords[calc.index], normal_hours: calc.normal_hours ?? processedRecords[calc.index].normal_hours, compensation_hours: calc.compensation_hours ?? 0, overtime_75: calc.overtime_75 ?? processedRecords[calc.index].overtime_75, overtime_100: calc.overtime_100 ?? processedRecords[calc.index].overtime_100, night_bonus: calc.night_bonus ?? processedRecords[calc.index].night_bonus, processed_by_ai: true };
                }
              }
            }
          }
        }
      } catch (aiError) { console.error("AI processing error (using fallback):", aiError); }
    }

    let deleteQuery = supabase.from("workforce_database").delete().gte("date", start_date).lte("date", end_date);
    if (project_id) deleteQuery = deleteQuery.eq("project_id", project_id);
    if (userCompanyId) deleteQuery = deleteQuery.eq("company_id", userCompanyId);
    await deleteQuery;

    const batchSize = 100;
    for (let i = 0; i < processedRecords.length; i += batchSize) {
      const batch = processedRecords.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from("workforce_database").insert(batch);
      if (insertError) throw insertError;
    }

    // Remove spreadsheet duplicates that match the new RDO records
    if (userCompanyId) {
      const rdoKeys = processedRecords.map(r => ({
        name: r.worker_name?.trim()?.toUpperCase(),
        date: r.date
      }));
      const uniqueDates = [...new Set(rdoKeys.map((k: any) => k.date))];
      const { data: duplicates } = await supabase
        .from("workforce_database")
        .select("id, worker_name, date, report_id")
        .eq("company_id", userCompanyId)
        .is("report_id", null)
        .in("date", uniqueDates);

      const rdoKeySet = new Set(rdoKeys.map((k: any) => `${k.name}|${k.date}`));
      const toDeleteIds = (duplicates || [])
        .filter((d: any) => rdoKeySet.has(`${d.worker_name?.trim()?.toUpperCase()}|${d.date}`))
        .map((d: any) => d.id);

      if (toDeleteIds.length > 0) {
        for (let i = 0; i < toDeleteIds.length; i += 100) {
          await supabase.from("workforce_database").delete().in("id", toDeleteIds.slice(i, i + 100));
        }
        console.log(`Removed ${toDeleteIds.length} spreadsheet duplicates after RDO processing`);
      }
    }

    return new Response(JSON.stringify({ message: `${processedRecords.length} registros processados`, count: processedRecords.length, ai_processed: processedRecords.some(r => r.processed_by_ai) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function parseTime(time: string): number {
  const parts = time.split(":");
  return parseInt(parts[0]) + parseInt(parts[1] || "0") / 60;
}

const FUNCTION_SYNONYMS: Record<string, string> = {
  'MECANICO': 'MECÂNICO CONVENCIONAL', 'MECÂNICO': 'MECÂNICO CONVENCIONAL', 'MECANICO CONVENCIONAL': 'MECÂNICO CONVENCIONAL',
  'MECANICO ESCALADOR': 'MECÂNICO ESCALADOR N1', 'MECÂNICO ESCALADOR': 'MECÂNICO ESCALADOR N1',
  'MECANICO N1': 'MECÂNICO ESCALADOR N1', 'MECÂNICO N1': 'MECÂNICO ESCALADOR N1',
  'MECANICO ESCALADOR N1': 'MECÂNICO ESCALADOR N1', 'MECÂNICO ESCALADOR N1': 'MECÂNICO ESCALADOR N1',
  'MECANICO N2': 'MECÂNICO ESCALADOR N2', 'MECÂNICO N2': 'MECÂNICO ESCALADOR N2',
  'MECANICO ESCALADOR N2': 'MECÂNICO ESCALADOR N2', 'MECÂNICO ESCALADOR N2': 'MECÂNICO ESCALADOR N2',
  'MECANICO N3': 'MECÂNICO ESCALADOR N3', 'MECÂNICO N3': 'MECÂNICO ESCALADOR N3',
  'MECANICO ESCALADOR N3': 'MECÂNICO ESCALADOR N3', 'MECÂNICO ESCALADOR N3': 'MECÂNICO ESCALADOR N3',
  'MEC': 'MECÂNICO CONVENCIONAL', 'MEC.': 'MECÂNICO CONVENCIONAL',
  'SOLDADOR': 'SOLDADOR CONVENCIONAL', 'SOLD': 'SOLDADOR CONVENCIONAL', 'SOLD.': 'SOLDADOR CONVENCIONAL',
  'SOLDADOR ESCALADOR': 'SOLDADOR ESCALADOR N1',
  'SOLDADOR N1': 'SOLDADOR ESCALADOR N1', 'SOLDADOR ESCALADOR N1': 'SOLDADOR ESCALADOR N1',
  'SOLDADOR N2': 'SOLDADOR ESCALADOR N2', 'SOLDADOR ESCALADOR N2': 'SOLDADOR ESCALADOR N2',
  'SOLDADOR N3': 'SOLDADOR ESCALADOR N3', 'SOLDADOR ESCALADOR N3': 'SOLDADOR ESCALADOR N3',
  'CALDEIREIRO': 'CALDEIREIRO CONVENCIONAL', 'CALD': 'CALDEIREIRO CONVENCIONAL', 'CALD.': 'CALDEIREIRO CONVENCIONAL',
  'CALDEIREIRO ESCALADOR': 'CALDEIREIRO ESCALADOR N1',
  'CALDEIREIRO N1': 'CALDEIREIRO ESCALADOR N1', 'CALDEIREIRO ESCALADOR N1': 'CALDEIREIRO ESCALADOR N1',
  'CALDEIREIRO N2': 'CALDEIREIRO ESCALADOR N2', 'CALDEIREIRO ESCALADOR N2': 'CALDEIREIRO ESCALADOR N2',
  'CALDEIREIRO N3': 'CALDEIREIRO ESCALADOR N3', 'CALDEIREIRO ESCALADOR N3': 'CALDEIREIRO ESCALADOR N3',
  'PINTOR': 'PINTOR CONVENCIONAL',
  'PINTOR ESCALADOR': 'PINTOR ESCALADOR N1',
  'PINTOR N1': 'PINTOR ESCALADOR N1', 'PINTOR ESCALADOR N1': 'PINTOR ESCALADOR N1',
  'PINTOR N2': 'PINTOR ESCALADOR N2', 'PINTOR ESCALADOR N2': 'PINTOR ESCALADOR N2',
  'PINTOR N3': 'PINTOR ESCALADOR N3', 'PINTOR ESCALADOR N3': 'PINTOR ESCALADOR N3',
  'MEIO OFICIAL': 'MEIO OFICIAL', 'PROGRAMADOR': 'PROGRAMADOR', 'PROJETISTA': 'PROJETISTA',
  'SUPERVISOR N3': 'SUPERVISOR ESCALADOR N3', 'SUPERVISOR ESCALADOR N3': 'SUPERVISOR ESCALADOR N3',
  'SUP N3': 'SUPERVISOR ESCALADOR N3', 'SUP. N3': 'SUPERVISOR ESCALADOR N3',
  'SUPERVISOR': 'SUPERVISOR ESCALADOR N3', 'SUPERVISOR ALPINISTA N3': 'SUPERVISOR ESCALADOR N3',
  'COLABORADOR': 'MEIO OFICIAL', 'CONVENCIONAL': 'MEIO OFICIAL',
  'COORDENADOR': 'SUPERVISOR ESCALADOR N3', 'LÍDER': 'SUPERVISOR ESCALADOR N3', 'LIDER': 'SUPERVISOR ESCALADOR N3',
  'INSPETOR DE SOLDAGEM': 'SOLDADOR CONVENCIONAL', 'INSPETOR': 'SOLDADOR CONVENCIONAL',
  'PINTOR INDUSTRIAL N1': 'PINTOR ESCALADOR N1', 'PINTOR INDUSTRIAL N2': 'PINTOR ESCALADOR N2',
  'PINTOR INDUSTRIAL N3': 'PINTOR ESCALADOR N3', 'PINTOR INDUSTRIAL': 'PINTOR CONVENCIONAL',
  'AJUDANTE': 'MEIO OFICIAL', 'ALMOXARIFE': 'MEIO OFICIAL',
  'OPERADOR DE MAQUINAS': 'MEIO OFICIAL', 'OPERADOR DE MÁQUINAS': 'MEIO OFICIAL',
  'OPERADOR DE MÁQUINAS PESADAS': 'MEIO OFICIAL', 'OPERADOR DE MAQUINAS PESADAS': 'MEIO OFICIAL',
  'N1': 'MEIO OFICIAL', 'N2': 'MEIO OFICIAL', 'N3': 'MEIO OFICIAL',
  'NÃO INFORMADO': 'MEIO OFICIAL', 'NAO INFORMADO': 'MEIO OFICIAL',
};

function normalizeFunction(input: string): string {
  if (!input) return '';
  const upper = input.trim().toUpperCase();
  return FUNCTION_SYNONYMS[upper] || upper;
}
