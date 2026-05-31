import { useQuery } from '@tanstack/react-query';
import { FileText, Clock, CheckCircle2, Send, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface UserDashboardStatsProps {
  userId?: string;
}

export function UserDashboardStats({ userId }: UserDashboardStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['user-dashboard-stats', userId],
    queryFn: async () => {
      if (!userId) return null;

      const [reportsRes, projectsRes] = await Promise.all([
        supabase
          .from('reports')
          .select('status')
          .eq('created_by', userId),
        supabase
          .from('projects')
          .select('id, status'),
      ]);

      const reports = reportsRes.data || [];
      const projects = projectsRes.data || [];

      return {
        totalReports: reports.length,
        drafts: reports.filter(r => r.status === 'draft').length,
        completed: reports.filter(r => r.status === 'completed' || r.status === 'finalized').length,
        sent: reports.filter(r => r.status === 'sent' || r.status === 'signed').length,
        activeProjects: projects.filter(p => p.status === 'in_progress').length,
      };
    },
    enabled: !!userId,
  });

  const statItems = [
    {
      label: 'Total Relatórios',
      value: stats?.totalReports ?? 0,
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Rascunhos',
      value: stats?.drafts ?? 0,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Concluídos',
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Enviados',
      value: stats?.sent ?? 0,
      icon: Send,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Projetos Ativos',
      value: stats?.activeProjects ?? 0,
      icon: Building2,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-500/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Meu Resumo</h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5 auto-rows-fr">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className={cn("h-20 sm:h-24 rounded-xl", i === 5 && "col-span-2 sm:col-span-1")} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <h2 className="text-xs sm:text-sm font-medium text-muted-foreground">Meu Resumo</h2>
      <div className="grid grid-cols-2 gap-1.5 xs:gap-2 sm:gap-3 xs:grid-cols-3 lg:grid-cols-5 auto-rows-fr">
        {statItems.map((item, index) => {
          const Icon = item.icon;
          const isLastOdd = index === statItems.length - 1 && statItems.length % 2 === 1;
          return (
            <div
              key={item.label}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg sm:rounded-xl border bg-card p-2 xs:p-2.5 sm:p-3 md:p-4 transition-all hover:shadow-md h-full",
                isLastOdd && "col-span-2 xs:col-span-1"
              )}
            >
              <div className={`mb-1 sm:mb-1.5 md:mb-2 rounded-md sm:rounded-lg p-1 xs:p-1.5 sm:p-2 ${item.bg}`}>
                <Icon className={`h-3.5 w-3.5 xs:h-4 xs:w-4 sm:h-5 sm:w-5 ${item.color}`} />
              </div>
              <span className="text-lg xs:text-xl sm:text-2xl font-bold text-foreground">
                {item.value}
              </span>
              <span className="text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground text-center leading-tight">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
