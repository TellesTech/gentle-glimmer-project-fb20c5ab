import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type HiddenMode = 'hidden' | 'removed';

interface HiddenMonthRow {
  id: string;
  company_id: string | null;
  site_id: string | null;
  year: number;
  month: number;
  mode: string | null;
}

interface HiddenReportRow {
  id: string;
  report_id: string;
  company_id: string | null;
  site_id: string | null;
  mode: string | null;
}

interface Options {
  companyId?: string | null;
  siteId?: string | null;
  /** Desativa a edição (ex.: modo de pré-visualização de cliente) */
  disabled?: boolean;
}

export const monthKey = (year: number, month: number) => `${year}-${month}`;

/**
 * Controla o que a WEES esconde ou remove da área do cliente:
 * pastas de mês (portal_hidden_months) e RDOs individuais (portal_hidden_reports).
 */
export function usePortalHidden({ companyId, siteId, disabled }: Options) {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  const canManage = (role === 'super_admin' || role === 'admin') && !disabled;

  const { data: hiddenMonths } = useQuery({
    queryKey: ['portal-hidden-months', companyId, siteId],
    queryFn: async () => {
      let q = supabase
        .from('portal_hidden_months')
        .select('id, company_id, site_id, year, month, mode');
      if (siteId) q = q.eq('site_id', siteId);
      else if (companyId) q = q.eq('company_id', companyId);
      const { data } = await q;
      return (data || []) as HiddenMonthRow[];
    },
    enabled: !!companyId || !!siteId,
  });

  const { data: hiddenReports } = useQuery({
    queryKey: ['portal-hidden-reports', companyId, siteId],
    queryFn: async () => {
      let q = supabase
        .from('portal_hidden_reports')
        .select('id, report_id, company_id, site_id, mode');
      if (siteId) q = q.eq('site_id', siteId);
      else if (companyId) q = q.eq('company_id', companyId);
      const { data } = await q;
      return (data || []) as HiddenReportRow[];
    },
    enabled: !!companyId || !!siteId,
  });

  const hiddenMonthKeys = useMemo(
    () => new Map((hiddenMonths || []).map(h => [monthKey(h.year, h.month), (h.mode || 'hidden') as HiddenMode])),
    [hiddenMonths],
  );

  const hiddenReportIds = useMemo(
    () => new Map((hiddenReports || []).map(h => [h.report_id, (h.mode || 'hidden') as HiddenMode])),
    [hiddenReports],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['portal-hidden-months'] });
    queryClient.invalidateQueries({ queryKey: ['portal-hidden-reports'] });
    queryClient.invalidateQueries({ queryKey: ['client-dashboard-reports'] });
    queryClient.invalidateQueries({ queryKey: ['client-activity-reports'] });
  }, [queryClient]);

  const setMonthHidden = useCallback(
    async (year: number, month: number, mode: HiddenMode | null) => {
      if (!canManage || !siteId) return;
      try {
        if (mode === null) {
          const { error } = await supabase
            .from('portal_hidden_months')
            .delete()
            .eq('site_id', siteId)
            .eq('year', year)
            .eq('month', month);
          if (error) throw error;
          toast.success('Pasta voltou a aparecer para o cliente');
        } else {
          const existing = hiddenMonthKeys.has(monthKey(year, month));
          if (existing) {
            const { error } = await supabase
              .from('portal_hidden_months')
              .update({ mode })
              .eq('site_id', siteId)
              .eq('year', year)
              .eq('month', month);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('portal_hidden_months').insert({
              company_id: companyId ?? null,
              site_id: siteId,
              year,
              month,
              mode,
              hidden_by: user?.id ?? null,
            } as any);
            if (error) throw error;
          }
          toast.success(mode === 'removed' ? 'Pasta removida do portal do cliente' : 'Pasta ocultada do cliente');
        }
        invalidate();
      } catch (err: any) {
        toast.error(err?.message || 'Não foi possível alterar a visibilidade.');
      }
    },
    [canManage, siteId, companyId, hiddenMonthKeys, user?.id, invalidate],
  );

  const setReportHidden = useCallback(
    async (reportId: string, mode: HiddenMode | null, reportSiteId?: string | null) => {
      if (!canManage) return;
      try {
        if (mode === null) {
          const { error } = await supabase.from('portal_hidden_reports').delete().eq('report_id', reportId);
          if (error) throw error;
          toast.success('RDO voltou a aparecer para o cliente');
        } else {
          const { error } = await supabase
            .from('portal_hidden_reports')
            .upsert(
              {
                report_id: reportId,
                company_id: companyId ?? null,
                site_id: reportSiteId ?? siteId ?? null,
                mode,
                hidden_by: user?.id ?? null,
              } as any,
              { onConflict: 'report_id' },
            );
          if (error) throw error;
          toast.success(mode === 'removed' ? 'RDO removido do portal do cliente' : 'RDO ocultado do cliente');
        }
        invalidate();
      } catch (err: any) {
        toast.error(err?.message || 'Não foi possível alterar a visibilidade do RDO.');
      }
    },
    [canManage, companyId, siteId, user?.id, invalidate],
  );

  return {
    canManage,
    hiddenMonthKeys,
    hiddenReportIds,
    setMonthHidden,
    setReportHidden,
  };
}
