import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseRdoDeterministic, sanitizeOmNumber } from "../_shared/rdoParser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractText(raw: any): string {
  if (!raw || typeof raw !== "object") return "";
  const candidates = [
    raw?.message?.conversation,
    raw?.message?.extendedTextMessage?.text,
    raw?.text?.message,
    raw?.message?.text,
    raw?.body,
    typeof raw?.text === "string" ? raw.text : null,
    raw?.caption,
    raw?.message?.imageMessage?.caption,
    raw?.content,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}

function isBadOmNumber(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toUpperCase();
  return s === "" || ["NA", "N/A", "NULL", "0", "SEM OM", "-"].includes(s);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dryRun !== false; // padrão: dry-run (nenhuma escrita)
    const format = body.format === "csv" ? "csv" : "json";
    const limit = Math.min(Number(body.limit) || 500, 2000);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Logs vinculados a reports, com texto original
    const { data: logs, error: logErr } = await admin
      .from("whatsapp_rdo_logs")
      .select("id, report_id, status, raw_payload, created_at")
      .not("report_id", "is", null)
      .limit(3000);
    if (logErr) throw logErr;

    // melhor log por report = maior texto
    const bestByReport = new Map<string, { logId: string; status: string; text: string }>();
    for (const l of logs ?? []) {
      const text = extractText(l.raw_payload);
      if (!text.trim()) continue;
      const prev = bestByReport.get(l.report_id as string);
      if (!prev || text.length > prev.text.length) {
        bestByReport.set(l.report_id as string, { logId: l.id, status: l.status ?? "", text });
      }
    }

    const reportIds = [...bestByReport.keys()].slice(0, limit);
    if (reportIds.length === 0) {
      return new Response(JSON.stringify({ dryRun, total: 0, rows: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reports, error: repErr } = await admin
      .from("reports")
      .select("id, date, maintenance_order_number, maintenance_order_title, project_id")
      .in("id", reportIds);
    if (repErr) throw repErr;

    const { data: acts, error: actErr } = await admin
      .from("report_activities")
      .select("id, report_id, completed, progress")
      .in("report_id", reportIds);
    if (actErr) throw actErr;

    const actsByReport = new Map<string, { total: number; done: number }>();
    for (const a of acts ?? []) {
      const cur = actsByReport.get(a.report_id) ?? { total: 0, done: 0 };
      cur.total++;
      if (a.completed === true || Number(a.progress ?? 0) > 0) cur.done++;
      actsByReport.set(a.report_id, cur);
    }

    const rows: any[] = [];
    let willFixOmNumber = 0, willFixOmTitle = 0, willFixActivities = 0, noChange = 0;

    for (const r of reports ?? []) {
      const log = bestByReport.get(r.id)!;
      const parsed = parseRdoDeterministic(log.text);
      const stats = actsByReport.get(r.id) ?? { total: 0, done: 0 };

      const newOmNumber = sanitizeOmNumber(parsed.numeroOM);
      const newOmTitle = parsed.tituloOM && parsed.tituloOM.trim() ? parsed.tituloOM.trim() : null;

      // regra segura: só preenche o que hoje está nulo/inválido
      const fixOmNumber = isBadOmNumber(r.maintenance_order_number) && !!newOmNumber;
      const fixOmTitle =
        (!r.maintenance_order_title || !String(r.maintenance_order_title).trim()) && !!newOmTitle;
      const fixActivities =
        stats.total > 0 && stats.done === 0 && parsed.atividades.length > 0;

      if (fixOmNumber) willFixOmNumber++;
      if (fixOmTitle) willFixOmTitle++;
      if (fixActivities) willFixActivities++;
      if (!fixOmNumber && !fixOmTitle && !fixActivities) noChange++;

      rows.push({
        report_id: r.id,
        date: r.date,
        log_status: log.status,
        text_len: log.text.length,
        om_number_before: r.maintenance_order_number,
        om_number_after: fixOmNumber ? newOmNumber : r.maintenance_order_number,
        om_title_before: r.maintenance_order_title,
        om_title_after: fixOmTitle ? newOmTitle : r.maintenance_order_title,
        activities_total: stats.total,
        activities_done_before: stats.done,
        activities_done_after: fixActivities ? stats.total : stats.done,
        parsed_activities: parsed.atividades.length,
        changes: [
          fixOmNumber ? "om_number" : null,
          fixOmTitle ? "om_title" : null,
          fixActivities ? "activities" : null,
        ].filter(Boolean).join("+") || "nenhuma",
      });

      if (!dryRun) {
        const patch: Record<string, unknown> = {};
        if (fixOmNumber) patch.maintenance_order_number = newOmNumber;
        if (fixOmTitle) patch.maintenance_order_title = newOmTitle;
        if (Object.keys(patch).length > 0) {
          await admin.from("reports").update(patch).eq("id", r.id);
        }
        if (fixActivities) {
          await admin
            .from("report_activities")
            .update({ completed: true, progress: 100 })
            .eq("report_id", r.id);
        }
      }
    }

    const summary = {
      dryRun,
      writes_performed: dryRun ? 0 : willFixOmNumber + willFixOmTitle + willFixActivities,
      reports_analyzed: rows.length,
      will_fix_om_number: willFixOmNumber,
      will_fix_om_title: willFixOmTitle,
      will_fix_activities: willFixActivities,
      no_change: noChange,
    };

    if (format === "csv") {
      const headers = Object.keys(rows[0] ?? { report_id: "" });
      const csv = [
        headers.join(","),
        ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")),
      ].join("\n");
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "X-Summary": JSON.stringify(summary),
        },
      });
    }

    return new Response(JSON.stringify({ ...summary, rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
