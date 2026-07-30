import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseRdoDeterministic, sanitizeOmNumber, stripAccents } from "../_shared/rdoParser.ts";

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
  return s === "" || ["NA", "N/A", "N.A.", "NULL", "0", "SEM OM", "-", "--"].includes(s);
}

/** Normaliza descrição de atividade para comparação. */
function actKey(s: unknown): string {
  return stripAccents(String(s ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(s.split(" ").filter((t) => t.length > 3));
}

/** Atividade do banco está claramente presente na mensagem original? */
function matchesParsed(dbDesc: string, parsedKeys: string[]): boolean {
  const k = actKey(dbDesc);
  if (!k) return false;
  for (const p of parsedKeys) {
    if (!p) continue;
    if (p === k || p.includes(k) || k.includes(p)) return true;
    // sobreposição forte de tokens significativos
    const a = tokens(k);
    const b = tokens(p);
    if (a.size >= 2 && b.size >= 2) {
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      if (inter / Math.min(a.size, b.size) >= 0.8) return true;
    }
  }
  return false;
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
    const limit = Math.min(Number(body.limit) || 2000, 5000);
    const siteId: string | null = body.siteId ?? null;
    const companyId: string | null = body.companyId ?? null;
    const dateFrom: string | null = body.dateFrom ?? null;
    const dateTo: string | null = body.dateTo ?? null;
    const batchId = crypto.randomUUID();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- autorização: somente admin/super_admin (ou chamada com service role) ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceKey) {
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      const allowed = (roles ?? []).some((r: any) => ["admin", "super_admin"].includes(r.role));
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- escopo: restringe aos projetos de uma unidade/empresa (evita tocar outras) ---
    let scopedProjectIds: Set<string> | null = null;
    if (siteId || companyId) {
      let q = admin.from("projects").select("id, site_id, company_id");
      if (siteId) q = q.eq("site_id", siteId);
      if (companyId) q = q.eq("company_id", companyId);
      const { data: scoped, error: scopeErr } = await q;
      if (scopeErr) throw scopeErr;
      scopedProjectIds = new Set((scoped ?? []).map((p: any) => p.id));
      if (scopedProjectIds.size === 0) {
        return new Response(JSON.stringify({ dryRun, scope_empty: true, reports_analyzed: 0, rows: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Logs vinculados a reports, com texto original (paginado)
    const logs: any[] = [];
    const PAGE = 500;
    for (let from = 0; from < 8000; from += PAGE) {
      const { data, error } = await admin
        .from("whatsapp_rdo_logs")
        .select("id, report_id, status, raw_payload, created_at")
        .not("report_id", "is", null)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      logs.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    const bestByReport = new Map<string, { logId: string; status: string; text: string }>();
    for (const l of logs) {
      const text = extractText(l.raw_payload);
      if (!text.trim()) continue;
      const prev = bestByReport.get(l.report_id as string);
      if (!prev || text.length > prev.text.length) {
        bestByReport.set(l.report_id as string, { logId: l.id, status: l.status ?? "", text });
      }
    }

    const reportIds = [...bestByReport.keys()].slice(0, limit);
    if (reportIds.length === 0) {
      return new Response(JSON.stringify({ dryRun, reports_analyzed: 0, rows: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reports, error: repErr } = await admin
      .from("reports")
      .select(
        "id, date, status, sent_at, finalized_at, signed_pdf_url, maintenance_order_number, maintenance_order_title, location, shift, start_time, end_time, project_id",
      )
      .in("id", reportIds);
    if (repErr) throw repErr;

    const scopedReports = (reports ?? []).filter((r: any) => {
      if (scopedProjectIds && !scopedProjectIds.has(r.project_id)) return false;
      if (dateFrom && String(r.date) < dateFrom) return false;
      if (dateTo && String(r.date) > dateTo) return false;
      return true;
    });

    const { data: sigs } = await admin
      .from("report_signatures")
      .select("report_id")
      .in("report_id", reportIds);
    const signedSet = new Set((sigs ?? []).map((s: any) => s.report_id));

    const { data: acts, error: actErr } = await admin
      .from("report_activities")
      .select("id, report_id, description, completed, progress")
      .in("report_id", reportIds);
    if (actErr) throw actErr;

    const actsByReport = new Map<string, any[]>();
    for (const a of acts ?? []) {
      const arr = actsByReport.get(a.report_id) ?? [];
      arr.push(a);
      actsByReport.set(a.report_id, arr);
    }

    const rows: any[] = [];
    const backupRows: any[] = [];
    const manualReview: any[] = [];
    const missingActivities: any[] = [];
    const errors: any[] = [];

    let fixedOmNumber = 0, fixedOmTitle = 0, fixedActivities = 0, noChange = 0, skippedLocked = 0;
    let fixedLocation = 0, fixedShift = 0;

    for (const r of scopedReports) {
      const log = bestByReport.get(r.id)!;
      const parsed = parseRdoDeterministic(log.text);
      const dbActs = actsByReport.get(r.id) ?? [];
      const parsedKeys = parsed.atividades.map(actKey).filter(Boolean);

      const newOmNumber = sanitizeOmNumber(parsed.numeroOM);
      const newOmTitle = parsed.tituloOM && parsed.tituloOM.trim() ? parsed.tituloOM.trim() : null;

      const locked =
        ["sent", "signed", "finalized"].includes(String(r.status ?? "")) ||
        !!r.sent_at || !!r.finalized_at || !!r.signed_pdf_url || signedSet.has(r.id);

      const fixOmNumber = isBadOmNumber(r.maintenance_order_number) && !!newOmNumber;
      const fixOmTitle =
        (!r.maintenance_order_title || !String(r.maintenance_order_title).trim()) && !!newOmTitle;

      const newLocation = parsed.localAtividade && parsed.localAtividade.trim()
        ? parsed.localAtividade.trim()
        : null;
      const fixLocation = (!r.location || !String(r.location).trim()) && !!newLocation;
      const fixShift = !r.shift && !!parsed.turno;

      const actsToComplete = parsedKeys.length
        ? dbActs.filter(
            (a) =>
              !(a.completed === true && Number(a.progress ?? 0) >= 100) &&
              matchesParsed(a.description, parsedKeys),
          )
        : [];

      // RDOs sem atividades salvas, mas com atividades no texto original
      if (dbActs.length === 0 && parsed.atividades.length > 0) {
        missingActivities.push({
          report_id: r.id,
          date: r.date,
          om_number: r.maintenance_order_number,
          om_title: r.maintenance_order_title,
          recoverable_activities: parsed.atividades.length,
        });
      }

      const hasChange = fixOmNumber || fixOmTitle || fixLocation || fixShift || actsToComplete.length > 0;

      if (locked) {
        if (hasChange) {
          skippedLocked++;
          manualReview.push({
            report_id: r.id,
            date: r.date,
            reason: "enviado/assinado",
            status: r.status,
            would_fix: [
              fixOmNumber ? "om_number" : null,
              fixOmTitle ? "om_title" : null,
              fixLocation ? "location" : null,
              fixShift ? "shift" : null,
              actsToComplete.length ? "activities" : null,
            ].filter(Boolean).join("+"),
          });
        } else {
          noChange++;
        }
      } else if (!hasChange) {
        noChange++;
      }

      rows.push({
        report_id: r.id,
        date: r.date,
        log_status: log.status,
        locked: locked ? "sim" : "nao",
        om_number_before: r.maintenance_order_number,
        om_number_after: !locked && fixOmNumber ? newOmNumber : r.maintenance_order_number,
        om_title_before: r.maintenance_order_title,
        om_title_after: !locked && fixOmTitle ? newOmTitle : r.maintenance_order_title,
        location_before: r.location,
        location_after: !locked && fixLocation ? newLocation : r.location,
        shift_before: r.shift,
        shift_after: !locked && fixShift ? parsed.turno : r.shift,
        activities_total: dbActs.length,
        activities_to_complete: locked ? 0 : actsToComplete.length,
        parsed_activities: parsed.atividades.length,
        changes: locked
          ? (hasChange ? "ignorado (enviado/assinado)" : "nenhuma")
          : ([
              fixOmNumber ? "om_number" : null,
              fixOmTitle ? "om_title" : null,
              fixLocation ? "location" : null,
              fixShift ? "shift" : null,
              actsToComplete.length ? "activities" : null,
            ].filter(Boolean).join("+") || "nenhuma"),
      });

      if (dryRun) {
        if (!locked && fixOmNumber) fixedOmNumber++;
        if (!locked && fixOmTitle) fixedOmTitle++;
        if (!locked && fixLocation) fixedLocation++;
        if (!locked && fixShift) fixedShift++;
        if (!locked) fixedActivities += actsToComplete.length;
      }

      if (dryRun || locked || !hasChange) continue;

      // ---- escrita (com backup antes e rollback em caso de erro) ----
      const applied: Array<() => Promise<void>> = [];
      try {
        const patch: Record<string, unknown> = {};
        if (fixOmNumber) {
          backupRows.push({
            batch_id: batchId, report_id: r.id, entity: "reports", entity_id: r.id,
            field: "maintenance_order_number",
            value_before: r.maintenance_order_number ?? null, value_after: newOmNumber,
          });
          patch.maintenance_order_number = newOmNumber;
        }
        if (fixOmTitle) {
          backupRows.push({
            batch_id: batchId, report_id: r.id, entity: "reports", entity_id: r.id,
            field: "maintenance_order_title",
            value_before: r.maintenance_order_title ?? null, value_after: newOmTitle,
          });
          patch.maintenance_order_title = newOmTitle;
        }
        if (fixLocation) {
          backupRows.push({
            batch_id: batchId, report_id: r.id, entity: "reports", entity_id: r.id,
            field: "location",
            value_before: r.location ?? null, value_after: newLocation,
          });
          patch.location = newLocation;
        }
        if (fixShift) {
          backupRows.push({
            batch_id: batchId, report_id: r.id, entity: "reports", entity_id: r.id,
            field: "shift",
            value_before: r.shift ?? null, value_after: parsed.turno,
          });
          patch.shift = parsed.turno;
        }

        for (const a of actsToComplete) {
          backupRows.push({
            batch_id: batchId, report_id: r.id, entity: "report_activities", entity_id: a.id,
            field: "completed+progress",
            value_before: { completed: a.completed, progress: a.progress },
            value_after: { completed: true, progress: 100 },
          });
        }

        // grava backup ANTES de qualquer alteração
        const pending = backupRows.filter((b) => b.report_id === r.id);
        if (pending.length) {
          const { error: bkErr } = await admin.from("rdo_legacy_backup").insert(pending);
          if (bkErr) throw bkErr;
        }

        if (Object.keys(patch).length > 0) {
          const { error } = await admin.from("reports").update(patch).eq("id", r.id);
          if (error) throw error;
          applied.push(async () => {
            await admin.from("reports").update({
              maintenance_order_number: r.maintenance_order_number,
              maintenance_order_title: r.maintenance_order_title,
              location: r.location,
              shift: r.shift,
            }).eq("id", r.id);
          });
          if (fixOmNumber) fixedOmNumber++;
          if (fixOmTitle) fixedOmTitle++;
          if (fixLocation) fixedLocation++;
          if (fixShift) fixedShift++;
        }

        for (const a of actsToComplete) {
          const { error } = await admin
            .from("report_activities")
            .update({ completed: true, progress: 100 })
            .eq("id", a.id);
          if (error) throw error;
          applied.push(async () => {
            await admin.from("report_activities")
              .update({ completed: a.completed, progress: a.progress })
              .eq("id", a.id);
          });
          fixedActivities++;
        }
      } catch (e) {
        // rollback do que já foi aplicado neste report
        for (const undo of applied.reverse()) {
          try { await undo(); } catch (_) { /* ignore */ }
        }
        errors.push({ report_id: r.id, error: (e as Error).message });
      }
    }

    const summary = {
      dryRun,
      batch_id: dryRun ? null : batchId,
      scope: { siteId, companyId, dateFrom, dateTo },
      reports_analyzed: rows.length,
      om_number_filled: fixedOmNumber,
      om_title_filled: fixedOmTitle,
      location_filled: fixedLocation,
      shift_filled: fixedShift,
      activities_completed: fixedActivities,
      reports_skipped_sent_or_signed: skippedLocked,
      manual_review: manualReview.length,
      reports_without_saved_activities: missingActivities.length,
      no_change: noChange,
      errors: errors.length,
      writes_performed: dryRun
        ? 0
        : fixedOmNumber + fixedOmTitle + fixedLocation + fixedShift + fixedActivities,
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

    return new Response(
      JSON.stringify({ ...summary, manual_review_list: manualReview, missing_activities: missingActivities, error_list: errors, rows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
