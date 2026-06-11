import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ImpactSettings {
  id: string;
  company_id: string | null;
  manual_time_per_rdo: number;
  system_time_per_rdo: number;
  hourly_salary: number;
  work_hours_per_day: number;
  work_days_per_month: number;
  document_search_time: number;
  hh_calculation_time: number;
}

export interface MonthlyCategoryPoint {
  month: string; // YYYY-MM
  rdoHours: number;
  reportHours: number;
  hhHours: number;
}

interface PeriodStats {
  totalReports: number;
  completedReports: number;
  distinctProjects: number;
  completedActivities: number;
  finalizedProjects: number;
  /** Unique worker-month pairs in the period (refined HH base). */
  workerMonths: number;
  monthlyBreakdown: { month: string; count: number }[];
  /** Per-month hours saved decomposed by category. */
  monthlySavings: MonthlyCategoryPoint[];
  periodStart: string | null;
  periodEnd: string;
}

export type PeriodFilter = '7d' | '30d' | '90d' | 'month' | 'year' | 'all';

function getDateRange(period: PeriodFilter): { start: string | null; end: string } {
  const now = new Date();
  const end = now.toISOString();

  switch (period) {
    case '7d':
      return { start: new Date(now.getTime() - 7 * 86400000).toISOString(), end };
    case '30d':
      return { start: new Date(now.getTime() - 30 * 86400000).toISOString(), end };
    case '90d':
      return { start: new Date(now.getTime() - 90 * 86400000).toISOString(), end };
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end };
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1).toISOString(), end };
    case 'all':
      return { start: null, end };
  }
}

export function useImpactSettings() {
  return useQuery({
    queryKey: ['impact-settings'],
    queryFn: async (): Promise<ImpactSettings> => {
      const { data, error } = await (supabase as any)
        .from('impact_settings')
        .select('*')
        .is('company_id', null)
        .single();

      if (error) throw error;
      return data as ImpactSettings;
    },
  });
}

export function useUpdateImpactSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<ImpactSettings> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await (supabase as any)
        .from('impact_settings')
        .update(rest)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['impact-settings'] });
      toast.success('Configurações salvas');
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });
}

export type ScopeFilter = 'completed' | 'all';

function monthKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeName(n: string | null | undefined): string {
  // unaccent + lower + collapse de espaços — espelha link_workforce_to_profiles
  return (n || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function useImpactStats(period: PeriodFilter, scope: ScopeFilter = 'completed', settings?: ImpactSettings | null) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['impact-stats', period, scope, settings?.manual_time_per_rdo, settings?.system_time_per_rdo, settings?.document_search_time, settings?.hh_calculation_time],
    queryFn: async (): Promise<PeriodStats> => {
      // 1) Completed projects (status OR functional 100%)
      const [{ data: byStatus, error: projError }, { data: byProgress, error: progError }] = await Promise.all([
        supabase.from('projects').select('id').eq('status', 'completed'),
        supabase.from('reports').select('project_id').gte('daily_progress', 100),
      ]);

      if (projError) throw projError;
      if (progError) throw progError;

      const completedProjectIds = new Set<string>([
        ...((byStatus || []).map(p => p.id)),
        ...((byProgress || []).map((r: any) => r.project_id).filter(Boolean)),
      ]);

      // 2) Period-filtered reports
      let query = supabase
        .from('reports')
        .select('id, status, project_id, created_at, date, daily_progress');

      if (start) query = query.gte('created_at', start);
      query = query.lte('created_at', end);

      const { data, error } = await query;
      if (error) throw error;

      const allReports = data || [];
      const reports = scope === 'all'
        ? allReports
        : allReports.filter(r => completedProjectIds.has(r.project_id));

      const totalReports = reports.length;
      const completedReports = reports.filter(r => r.status !== 'draft').length;
      const distinctProjects = new Set(reports.map(r => r.project_id)).size;
      const completedActivities = scope === 'all'
        ? distinctProjects
        : new Set(reports.filter(r => completedProjectIds.has(r.project_id)).map(r => r.project_id)).size;

      // 3) Finalized projects in period (always uses status OR 100%)
      const reportProjectIds = new Set(allReports.map(r => r.project_id));
      const finalizedProjects = Array.from(reportProjectIds).filter(id => completedProjectIds.has(id)).length;

      // 4) Refined HH base: unique (worker, month) pairs in period
      // Uses report_attendance joined with the period reports we already have
      const finalizedReportIds = allReports
        .filter(r => completedProjectIds.has(r.project_id))
        .map(r => r.id);
      const reportDateMap = new Map<string, string>();
      // Preferimos `date` (data do RDO) sobre `created_at` (lançamento)
      allReports.forEach((r: any) => reportDateMap.set(r.id, r.date || r.created_at));

      let workerMonths = 0;
      const workerMonthSet = new Set<string>();

      if (finalizedReportIds.length > 0) {
        // Page through to avoid the 1000-row limit
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data: page, error: attErr } = await (supabase as any)
            .from('report_attendance')
            .select('report_id, user_id, user_name')
            .in('report_id', finalizedReportIds)
            .range(from, from + pageSize - 1);
          if (attErr) throw attErr;
          if (!page || page.length === 0) break;
          for (const row of page) {
            const reportDate = reportDateMap.get(row.report_id);
            if (!reportDate) continue;
            // Chave: prioriza user_id; fallback para nome normalizado quando o id está nulo
            const workerKey = row.user_id
              ? `id:${row.user_id}`
              : `name:${normalizeName(row.user_name)}`;
            if (workerKey === 'name:') continue;
            const key = `${workerKey}|${monthKey(reportDate)}`;
            workerMonthSet.add(key);
          }
          if (page.length < pageSize) break;
          from += pageSize;
        }
        workerMonths = workerMonthSet.size;
      }

      // 5) Monthly breakdown (RDO count per month) + per-category savings curve
      const monthMap = new Map<string, number>();
      reports.forEach(r => {
        const d = (r as any).date || r.created_at;
        monthMap.set(monthKey(d), (monthMap.get(monthKey(d)) || 0) + 1);
      });
      const monthlyBreakdown = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));

      // Per-month finalized projects (within the period reports of completed projects)
      const monthFinalizedSet = new Map<string, Set<string>>();
      allReports.forEach(r => {
        if (!completedProjectIds.has(r.project_id)) return;
        const k = monthKey((r as any).date || r.created_at);
        if (!monthFinalizedSet.has(k)) monthFinalizedSet.set(k, new Set());
        monthFinalizedSet.get(k)!.add(r.project_id);
      });

      // Per-month worker-months
      const monthWorkerSet = new Map<string, Set<string>>();
      workerMonthSet.forEach(key => {
        const [, mk] = key.split('|');
        if (!monthWorkerSet.has(mk)) monthWorkerSet.set(mk, new Set());
        monthWorkerSet.get(mk)!.add(key);
      });

      const manualPerRdo = settings?.manual_time_per_rdo ?? 10;
      const systemPerRdo = settings?.system_time_per_rdo ?? 1;
      const docSearchTime = settings?.document_search_time ?? 60;
      const hhTime = settings?.hh_calculation_time ?? 30;

      const allMonths = new Set<string>([
        ...monthMap.keys(),
        ...monthFinalizedSet.keys(),
        ...monthWorkerSet.keys(),
      ]);
      const monthlySavings: MonthlyCategoryPoint[] = Array.from(allMonths)
        .sort((a, b) => a.localeCompare(b))
        .map(month => {
          const rdoCount = monthMap.get(month) || 0;
          const finalCount = monthFinalizedSet.get(month)?.size || 0;
          const wmCount = monthWorkerSet.get(month)?.size || 0;
          return {
            month,
            rdoHours: ((manualPerRdo - systemPerRdo) * rdoCount) / 60,
            reportHours: (docSearchTime * finalCount) / 60,
            hhHours: (hhTime * wmCount) / 60,
          };
        });

      return {
        totalReports,
        completedReports,
        distinctProjects,
        completedActivities,
        finalizedProjects,
        workerMonths,
        monthlyBreakdown,
        monthlySavings,
        periodStart: start,
        periodEnd: end,
      };
    },
  });
}
