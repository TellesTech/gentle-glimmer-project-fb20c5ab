import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2, FileEdit, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsCardsProps {
  userId?: string;
}

export function StatsCards({ userId }: StatsCardsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['user-stats', userId],
    queryFn: async () => {
      if (!userId) return null;

      const [reportsRes, projectsRes] = await Promise.all([
        supabase
          .from('reports')
          .select('status')
          .eq('created_by', userId),
        supabase
          .from('projects')
          .select('id')
          .eq('status', 'in_progress'),
      ]);

      const reports = reportsRes.data || [];
      
      return {
        draft: reports.filter(r => r.status === 'draft').length,
        completed: reports.filter(r => r.status === 'completed').length,
        total: reports.length,
        activeProjects: projectsRes.data?.length || 0,
      };
    },
    enabled: !!userId,
  });

  const statItems = [
    {
      label: 'Rascunhos',
      value: stats?.draft ?? 0,
      icon: FileEdit,
      color: 'text-foreground/70',
      bg: 'bg-muted/80',
    },
    {
      label: 'Concluídos',
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Total',
      value: stats?.total ?? 0,
      icon: Clock,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Obras Ativas',
      value: stats?.activeProjects ?? 0,
      icon: Building2,
      color: 'text-info',
      bg: 'bg-info/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Resumo Rápido</h2>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Resumo Rápido</h2>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex flex-col items-center justify-center rounded-xl border bg-card p-3 sm:p-4"
            >
              <div className={`mb-1.5 rounded-lg p-1.5 ${item.bg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <span className="text-lg font-bold text-foreground sm:text-xl">
                {item.value}
              </span>
              <span className="text-[10px] text-muted-foreground sm:text-xs">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
