import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, ChevronRight, CheckCircle2, Clock, Wrench } from 'lucide-react';

import { ClientLayout } from '@/components/client/ClientLayout';
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
  const { role } = useAuth();
  const isInternalUser = role === 'admin' || role === 'super_admin' || role === 'collaborator';
  const isAdminView = isInternalUser && !clientProfile;

  // Project info (name)
  const { data: project } = useQuery({
    queryKey: ['client-activity-project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').eq('id', projectId!).maybeSingle();
      return data;
    },
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['client-activity-reports', projectId, clientProfile?.id, isAdminView],
    enabled: !!projectId && (!!clientProfile?.id || isAdminView),
    queryFn: async (): Promise<ActivityReport[]> => {
      // 1) Resolve which report IDs the user is allowed to see for this project.
      let reportIds: string[] = [];

      if (clientProfile) {
        const isContact = clientProfile._source === 'company_contacts';
        const table = isContact ? 'report_company_approvers' : 'report_client_approvers';
        const idField = isContact ? 'contact_id' : 'client_id';
        const { data: ap } = await (supabase as any)
          .from(table)
          .select('report_id, report:reports!inner(id, project_id)')
          .eq(idField, clientProfile.id);
        reportIds = (ap || [])
          .filter((a: any) => a.report?.project_id === projectId)
          .map((a: any) => a.report_id);
      } else if (isAdminView) {
        // Admin/colaborador no portal segue o mesmo escopo do cliente:
        // apenas RDOs assinados.
        const { data: projReports } = await supabase
          .from('reports')
          .select('id')
          .eq('project_id', projectId!)
          .in('status', ['signed', 'finalized']);
        reportIds = (projReports || []).map((r: any) => r.id);
      }

      if (!reportIds.length) return [];

      // 2) Fetch report data + approver counts
      const { data: rs } = await supabase
        .from('reports')
        .select('id, rdo_number, date, shift, status')
        .in('id', reportIds)
        .order('date', { ascending: false });

      const [{ data: ccApr }, { data: ccApr2 }] = await Promise.all([
        supabase.from('report_client_approvers').select('report_id, status').in('report_id', reportIds),
        supabase.from('report_company_approvers').select('report_id, status').in('report_id', reportIds),
      ]);

      const counts = new Map<string, { total: number; signed: number }>();
      [...(ccApr || []), ...(ccApr2 || [])].forEach((a: any) => {
        const cur = counts.get(a.report_id) || { total: 0, signed: 0 };
        cur.total += 1;
        if (a.status === 'approved') cur.signed += 1;
        counts.set(a.report_id, cur);
      });

      return (rs || [])
        // REGRA OBRIGATÓRIA: portal do cliente exibe SOMENTE RDOs assinados.
        .filter((r: any) => r.status === 'signed' || r.status === 'finalized')
        .map((r: any) => {
          const c = counts.get(r.id) || { total: 0, signed: 0 };
          const externallySigned = r.status === 'signed' || r.status === 'finalized';

          let approverStatus: string = 'pending';
          let signedCount = c.signed;
          let totalApprovers = c.total;

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
          } else if (c.signed > 0) {
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

  return (
    <ClientLayout>
      <div className="space-y-5">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/client/dashboard?${searchParams.toString()}`)}
            className="gap-1 -ml-2 mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate(`/client/dashboard?${searchParams.toString()}`)} className="hover:text-foreground">
              Atividades
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate">{project?.name || '...'}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{project?.name || 'Atividade'}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Assinados</p><p className="text-2xl font-bold text-[hsl(var(--success))]">{stats.completed}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Parciais</p><p className="text-2xl font-bold">{stats.partial}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold text-primary">{stats.pending}</p></CardContent></Card>
        </div>

        {isLoading ? (
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground text-sm">
              Nenhum RDO desta atividade está disponível para você.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
            {reports.map((r) => (
              <FileCard
                key={r.id}
                format="pdf"
                onClick={() => navigate(`/client/reports/${r.id}?${searchParams.toString()}`)}
                badge={getStatusBadge(r.approverStatus)}
                title={`RDO Nº ${(r.rdo_number ?? 0).toString().padStart(3, '0')}`}
                subtitle={format(parseISO(r.date), "dd/MM/yyyy", { locale: ptBR })}
                footer={`${r.signedCount}/${r.totalApprovers || '—'} assinaturas`}
              />
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
