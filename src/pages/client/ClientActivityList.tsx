import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, getYear, getMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight, CheckCircle2, Clock, Wrench, Pencil, Plus } from 'lucide-react';
import { buildActivityGroups, type ActivityGroupInputReport } from '@/lib/rdoActivityGroups';
import { useActivityNames } from '@/hooks/useActivityNames';
import { RenameActivityDialog, type RenameActivityTarget } from '@/components/reports/RenameActivityDialog';

import { ClientLayout } from '@/components/client/ClientLayout';
import { PageBackHeader } from '@/components/client/PageBackHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCard } from '@/components/ui/file-card';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ActivityReport {
  id: string;
  rdo_number: number | null;
  date: string;
  shift: string | null;
  status: string;
  approverStatus: string;
  signedCount: number;
  totalApprovers: number;
}

const shiftLabel: Record<string, string> = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' };

export default function ClientActivityList() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clientProfile } = useClientAuth();
  const { role, user } = useAuth();
  const isInternalUser = role === 'admin' || role === 'super_admin' || role === 'collaborator';
  const isAdminView = isInternalUser && !clientProfile;

  const urlSiteId = searchParams.get('site_id');
  const urlYear = searchParams.get('year');
  const urlMonth = searchParams.get('month');

  // Project info (name)
  const { data: activityInfo } = useQuery({
    queryKey: ['client-activity-info', projectId, clientProfile?.id, isAdminView, urlSiteId, urlYear, urlMonth],
    enabled: !!projectId && (!!clientProfile?.id || isAdminView),
    queryFn: async () => {
      if (!user?.id) return null;

      // 1) Get all sites allowed for this user
      let siteIds: string[] = [];
      if (isAdminView) {
        // Para admin no portal, buscamos os sites que ele tem acesso
        const [{ data: paa }, { data: srs }] = await Promise.all([
          supabase.from('portal_admin_access').select('site_id').eq('user_id', user.id),
          supabase.from('site_responsibles').select('site_id').eq('user_id', user.id),
        ]);
        siteIds = Array.from(new Set([
          ...((paa || []) as any[]).map((r) => r.site_id),
          ...((srs || []) as any[]).map((r) => r.site_id),
        ].filter(Boolean)));
        // O dashboard escopa pela unidade da URL — replicamos aqui para gerar
        // exatamente os mesmos grupos de atividade.
        if (urlSiteId) {
          siteIds = role === 'super_admin' || siteIds.includes(urlSiteId) ? [urlSiteId] : [];
          if (!siteIds.length) return null;
        }
      } else {
        // Para cliente, usamos a RPC existente
        const { data: siteRows } = await (supabase as any).rpc('portal_user_site_ids', {
          _user_id: user.id,
        });
        siteIds = (siteRows || [])
          .map((s: any) => (typeof s === 'string' ? s : s?.portal_user_site_ids))
          .filter(Boolean);
      }
      
      let query = supabase
        .from('reports')
        .select('id, date, maintenance_order_number, maintenance_order_title, location, project:projects(id, name, site_id, company:companies(id, name))')
        .in('status', ['sent', 'signed', 'finalized']);
      
      if (siteIds.length > 0) {
        const { data: projRows } = await supabase.from('projects').select('id').in('site_id', siteIds);
        const pIds = (projRows || []).map(p => p.id);
        if (pIds.length > 0) query = query.in('project_id', pIds);
      } else if (!isInternalUser || role !== 'super_admin') {
        // Se não for super admin e não tiver sites vinculados, não vê nada
        return null;
      }

      const { data: allReports } = await query;
      if (!allReports) return null;

      // O dashboard agrupa MÊS A MÊS; para obter os mesmos ids de grupo,
      // restringimos ao mesmo período antes de agrupar.
      const scoped = (urlYear && urlMonth)
        ? allReports.filter((r: any) => {
            if (!r.date) return false;
            const d = new Date(`${r.date}T00:00:00`);
            return d.getFullYear() === Number(urlYear) && d.getMonth() === Number(urlMonth);
          })
        : allReports;

      const inputReports: ActivityGroupInputReport[] = scoped.map(r => ({
        id: r.id,
        date: r.date,
        location: r.location,
        maintenance_order_number: r.maintenance_order_number,
        maintenance_order_title: r.maintenance_order_title,
        project_id: r.project?.id || '',
        project_name: r.project?.name || '',
        site_name: (r.project as any)?.site?.name || '',
        company_name: (r.project as any)?.site?.company?.name || '',
      }));

      const groups = buildActivityGroups(inputReports);
      let group = groups.find(g => g.id === projectId);
      if (!group && scoped.length !== allReports.length) {
        // Fallback: link sem período ou período divergente — agrupa tudo.
        const allGroups = buildActivityGroups(allReports.map(r => ({
          id: r.id,
          date: r.date,
          location: r.location,
          maintenance_order_number: r.maintenance_order_number,
          maintenance_order_title: r.maintenance_order_title,
          project_id: r.project?.id || '',
          project_name: r.project?.name || '',
          site_name: (r.project as any)?.site?.name || '',
          company_name: (r.project as any)?.site?.company?.name || '',
        })));
        group = allGroups.find(g => g.id === projectId);
      }
      
      if (group) {
        const groupSiteId =
          (scoped.find((r: any) => group!.reportIds.includes(r.id))?.project as any)?.site_id ??
          (allReports.find((r: any) => group!.reportIds.includes(r.id))?.project as any)?.site_id ??
          urlSiteId ??
          null;
        return { 
          name: group.name, 
          reportIds: group.reportIds, 
          siteId: groupSiteId as string | null,
          siteName: group.siteName,
          companyId: (scoped.find((r: any) => group!.reportIds.includes(r.id))?.project as any)?.site?.company?.id || null,
          companyName: group.companyName,
          omNumber: group.omNumber,
          omTitle: group.omTitle
        };
      }

      // Fallback: maybe it's a direct project UUID (legacy link)
      const { data: proj } = await supabase.from('projects').select('id, name, site_id').eq('id', projectId!).maybeSingle();
      if (proj) {
        const { data: rds } = await supabase.from('reports').select('id').eq('project_id', proj.id).in('status', ['sent', 'signed', 'finalized']);
        return { name: proj.name, reportIds: (rds || []).map(r => r.id), siteId: (proj as any).site_id ?? null, omNumber: null, omTitle: null };
      }

      return null;
    },
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['client-activity-reports', projectId, clientProfile?.id, isAdminView, activityInfo?.reportIds],
    enabled: !!projectId && (!!clientProfile?.id || isAdminView) && !!activityInfo,
    queryFn: async (): Promise<ActivityReport[]> => {
      const reportIds = activityInfo?.reportIds || [];
      if (!reportIds.length) return [];

      // 2) Fetch report data + approver counts
      const { data: rs } = await supabase
        .from('reports')
        .select('id, rdo_number, date, shift, status')
        .in('id', reportIds)
        .order('date', { ascending: false });

      const [{ data: ccApr }, { data: ccApr2 }, { data: sigRows }] = await Promise.all([
        supabase.from('report_client_approvers').select('report_id, status').in('report_id', reportIds),
        supabase.from('report_company_approvers').select('report_id, status').in('report_id', reportIds),
        supabase.from('report_signatures').select('report_id, signature_data').in('report_id', reportIds),
      ]);

      // Assinaturas internas (equipe WEES) — ficam em report_signatures.
      const internalSigned = new Map<string, number>();
      (sigRows || []).forEach((s: any) => {
        if (!s.signature_data) return;
        internalSigned.set(s.report_id, (internalSigned.get(s.report_id) || 0) + 1);
      });

      const counts = new Map<string, { total: number; signed: number }>();
      [...(ccApr || []), ...(ccApr2 || [])].forEach((a: any) => {
        const cur = counts.get(a.report_id) || { total: 0, signed: 0 };
        cur.total += 1;
        if (a.status === 'approved') cur.signed += 1;
        counts.set(a.report_id, cur);
      });

      return (rs || [])
        // Portal do cliente: RDOs enviados para assinatura e assinados.
        .filter((r: any) => r.status === 'sent' || r.status === 'signed' || r.status === 'finalized')
        .map((r: any) => {
          const c = counts.get(r.id) || { total: 0, signed: 0 };
          const externallySigned = r.status === 'signed' || r.status === 'finalized';
          const weesSigned = internalSigned.get(r.id) || 0;

          let approverStatus: string = 'pending';
          let signedCount = c.signed + weesSigned;
          let totalApprovers = c.total + weesSigned;

          if (externallySigned) {
            approverStatus = 'completed';
            if (totalApprovers === 0) {
              totalApprovers = 1;
              signedCount = 1;
            } else if (signedCount < totalApprovers) {
              signedCount = totalApprovers;
            }
          } else if (c.total > 0 && c.signed === c.total) {
            approverStatus = 'completed';
          } else if (c.signed > 0 || weesSigned > 0) {
            // WEES já assinou, mas o cliente ainda não → assinatura parcial.
            approverStatus = 'partial';
          }

          return {
            id: r.id,
            rdo_number: r.rdo_number,
            date: r.date,
            shift: r.shift,
            status: r.status,
            approverStatus,
            signedCount,
            totalApprovers,
          };
        });
    },
  });

  const stats = useMemo(() => {
    const total = reports.length;
    const completed = reports.filter((r) => r.approverStatus === 'completed').length;
    const partial = reports.filter((r) => r.approverStatus === 'partial').length;
    const pending = reports.filter((r) => r.approverStatus === 'pending').length;
    return { total, completed, partial, pending };
  }, [reports]);

  const getStatusBadge = (s: string) => {
    if (s === 'completed') return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-transparent gap-1"><CheckCircle2 className="h-3 w-3" />Assinado</Badge>;
    if (s === 'partial') return <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-transparent gap-1"><Clock className="h-3 w-3" />Parcial</Badge>;
    return <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white border-transparent gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
  };

  const activitySiteIds = useMemo(
    () => (activityInfo?.siteId ? [activityInfo.siteId] : []),
    [activityInfo?.siteId],
  );
  const { names: activityNames, rename: renameActivity, resetName: resetActivityName, isSaving: renamingActivity } =
    useActivityNames(activitySiteIds);
  const [renameOpen, setRenameOpen] = useState(false);
  const customName = projectId ? activityNames.get(projectId) : undefined;
  const displayName = customName || activityInfo?.name || 'Atividade';

  return (
    <ClientLayout>
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Assinados</p><p className="text-2xl font-bold text-[hsl(var(--success))]">{stats.completed}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Parciais</p><p className="text-2xl font-bold">{stats.partial}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold text-primary">{stats.pending}</p></CardContent></Card>
        </div>

        <PageBackHeader
          onBack={() => navigate(`/client/dashboard?${searchParams.toString()}`)}
          icon={<Wrench className="h-5 w-5" />}
          title={displayName}
          className="mb-0"
          actions={
            <div className="flex items-center gap-2">
              {isAdminView && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    navigate('/reports/new', {
                      state: {
                        companyId: activityInfo?.companyId,
                        companyName: activityInfo?.companyName,
                        siteId: activityInfo?.siteId,
                        siteName: activityInfo?.siteName,
                        omNumber: activityInfo?.omNumber || null,
                        omTitle: activityInfo?.omTitle || activityInfo?.name || null,
                      }
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Relatório
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setRenameOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Renomear
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assinado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assinatura Parcial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pendente</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 sm:gap-10 pt-1 pb-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="w-24 h-32 sm:w-32 sm:h-40 rounded-lg" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground text-sm">
              <p>Nenhum RDO desta atividade está disponível para você.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 sm:gap-10 pt-1 pb-4">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-center gap-3 group cursor-pointer"
                onClick={() => navigate(`/client/reports/${r.id}?${searchParams.toString()}`)}
              >
                <div className="relative w-20 h-[6.5rem] sm:w-24 sm:h-32 transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-active:scale-95">
                  {/* Paper sheet */}
                  <div className="absolute inset-0 bg-white border border-border rounded-sm shadow-md overflow-hidden">
                    {/* Status stripe */}
                    <div className={cn(
                      "h-1.5 w-full",
                      r.approverStatus === 'completed' ? "bg-emerald-500" : r.approverStatus === 'pending' ? "bg-red-500" : "bg-amber-500"
                    )} />
                    <div className="flex flex-col items-center justify-center pt-3">
                      <div className="text-[8px] sm:text-[9px] font-bold text-gray-500 tracking-widest leading-none">
                        RDO
                      </div>
                      <div className="text-[13px] sm:text-[16px] font-black text-gray-900 leading-none mt-1">
                        #{(r.rdo_number ?? 0).toString().padStart(3, '0')}
                      </div>
                    </div>
                    {/* Text lines */}
                    <div className="mt-3 px-3 space-y-1">
                      <div className="h-[2px] w-full bg-gray-200 rounded-full" />
                      <div className="h-[2px] w-5/6 bg-gray-200 rounded-full" />
                      <div className="h-[2px] w-full bg-gray-200 rounded-full" />
                      <div className="h-[2px] w-2/3 bg-gray-200 rounded-full" />
                    </div>
                  </div>
                  {/* Folded corner */}
                  <div className="absolute top-0 right-0 w-4 h-4 bg-muted border-l border-b border-border rounded-bl-sm shadow-sm" />

                  {/* Status Indicator */}
                  <div className="absolute -top-1 -right-1 z-30">
                    {r.approverStatus === 'completed' ? (
                      <div className="bg-emerald-500 rounded-full p-0.5 shadow-sm">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <div className={cn("rounded-full p-0.5 shadow-sm", r.approverStatus === 'pending' ? "bg-red-500" : "bg-amber-500")}>
                        <Clock className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center min-w-0 px-1 w-full">
                  <p className={cn(
                    "font-bold text-sm truncate transition-colors",
                    r.approverStatus === 'pending' ? "text-red-600 group-hover:text-red-700" : "text-foreground group-hover:text-primary"
                  )}>
                    RDO #{(r.rdo_number ?? 0).toString().padStart(3, '0')}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                    {format(parseISO(r.date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RenameActivityDialog
        target={
          renameOpen
            ? {
                groupKey: projectId || '',
                siteId: activityInfo?.siteId ?? null,
                currentName: displayName,
                hasCustomName: !!customName,
              }
            : null
        }
        isSaving={renamingActivity}
        onOpenChange={(open) => setRenameOpen(open)}
        onSave={async (name) => {
          if (!activityInfo?.siteId || !projectId) return;
          await renameActivity({ siteId: activityInfo.siteId, groupKey: projectId, name });
          setRenameOpen(false);
        }}
        onReset={async () => {
          if (!activityInfo?.siteId || !projectId) return;
          await resetActivityName({ siteId: activityInfo.siteId, groupKey: projectId });
          setRenameOpen(false);
        }}
      />
    </ClientLayout>
  );
}
