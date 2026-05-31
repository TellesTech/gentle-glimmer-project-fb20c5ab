import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { ReportStatus } from '@/types';

interface UserRecentReportsProps {
  userId?: string;
}

export function UserRecentReports({ userId }: UserRecentReportsProps) {
  const navigate = useNavigate();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['user-recent-reports', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          date,
          status,
          shift,
          project:projects(name)
        `)
        .eq('created_by', userId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Últimos Relatórios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!reports?.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Últimos Relatórios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum relatório criado
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => navigate('/reports/new')}
            >
              Criar primeiro relatório
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const shiftLabels: Record<string, string> = {
    day: 'Diurno',
    night: 'Noturno',
  };

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Últimos Relatórios
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => navigate('/reports')}
          >
            Ver todos
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 sm:space-y-2">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => navigate(`/reports/${report.id}`)}
              className="w-full flex items-center justify-between gap-2 sm:gap-3 rounded-lg border bg-card p-2.5 sm:p-3 text-left transition-all hover:bg-accent/50 hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">
                  {report.project?.name || 'Projeto não encontrado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(report.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  {report.shift && ` • ${shiftLabels[report.shift] || report.shift}`}
                </p>
              </div>
              <StatusBadge status={report.status as ReportStatus} />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
