import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RdoCoverPhoto {
  url: string;
  reportId: string;
  reportDate: string | null;
  rdoNumber: number | null;
  description: string | null;
}

interface Params {
  projectId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  enabled?: boolean;
  limit?: number;
}

/**
 * Lists recent RDO photos for a given project (optionally filtered by the
 * service report's date window). Used to suggest cover photos automatically.
 */
export function useRdoCoverPhotos({
  projectId,
  startDate,
  endDate,
  enabled = true,
  limit = 12,
}: Params) {
  const [photos, setPhotos] = useState<RdoCoverPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !projectId) {
      setPhotos([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        // Fetch reports of the project (optionally inside the date window).
        let reportsQuery = supabase
          .from("reports")
          .select("id, date, rdo_number")
          .eq("project_id", projectId)
          .order("date", { ascending: false })
          .limit(60);
        if (startDate) reportsQuery = reportsQuery.gte("date", startDate);
        if (endDate) reportsQuery = reportsQuery.lte("date", endDate);

        const { data: reports, error: rErr } = await reportsQuery;
        if (rErr) throw rErr;
        const reportIds = (reports || []).map((r: any) => r.id);
        if (reportIds.length === 0) {
          if (!cancelled) setPhotos([]);
          return;
        }

        const { data: pdata, error: pErr } = await supabase
          .from("report_photos")
          .select("url, description, report_id, created_at")
          .in("report_id", reportIds)
          .order("created_at", { ascending: false })
          .limit(limit * 3);
        if (pErr) throw pErr;

        const reportMap = new Map<string, { date: string | null; rdo: number | null }>();
        (reports || []).forEach((r: any) =>
          reportMap.set(r.id, { date: r.date ?? null, rdo: r.rdo_number ?? null }),
        );

        const seen = new Set<string>();
        const result: RdoCoverPhoto[] = [];
        for (const row of pdata || []) {
          const url = (row as any).url as string;
          if (!url || seen.has(url)) continue;
          seen.add(url);
          const meta = reportMap.get((row as any).report_id) || { date: null, rdo: null };
          result.push({
            url,
            reportId: (row as any).report_id,
            reportDate: meta.date,
            rdoNumber: meta.rdo,
            description: (row as any).description ?? null,
          });
          if (result.length >= limit) break;
        }
        if (!cancelled) setPhotos(result);
      } catch (e) {
        console.error("[useRdoCoverPhotos]", e);
        if (!cancelled) setPhotos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, startDate, endDate, enabled, limit]);

  return { photos, loading };
}
