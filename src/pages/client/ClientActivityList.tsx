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
            className="gap-1.5 -ml-2 mb-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 sm:gap-10 py-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="w-24 h-32 sm:w-32 sm:h-40 rounded-lg" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground text-sm">
              Nenhum RDO desta atividade está disponível para você.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 sm:gap-10 py-4">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-center gap-3 group cursor-pointer"
                onClick={() => navigate(`/client/reports/${r.id}?${searchParams.toString()}`)}
              >
                <div className="relative w-20 h-26 sm:w-24 sm:h-32 transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-active:scale-95">
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
    </ClientLayout>
  );
}
