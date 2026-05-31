import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planning: { label: 'Planejamento', variant: 'secondary' },
  in_progress: { label: 'Em Andamento', variant: 'default' },
  completed: { label: 'Concluído', variant: 'outline' },
  on_hold: { label: 'Pausado', variant: 'destructive' },
};

export function UserProjectsList() {
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['user-projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          status,
          progress,
          site:sites(name),
          company:companies(name)
        `)
        .order('updated_at', { ascending: false })
        .limit(4);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Meus Projetos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!projects?.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Meus Projetos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum projeto associado
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
            <FolderOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Meus Projetos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => navigate('/reports/new')}
          >
            Ver todos
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3">
        {projects.map((project) => {
          const statusInfo = statusLabels[project.status || 'planning'];
          return (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="w-full flex flex-col gap-1.5 sm:gap-2 rounded-lg border bg-card p-2.5 sm:p-3 text-left transition-all hover:bg-accent/50 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {project.company?.name} • {project.site?.name}
                  </p>
                </div>
                <Badge variant={statusInfo.variant} className="text-[10px] shrink-0">
                  {statusInfo.label}
                </Badge>
              </div>
              {project.progress !== null && project.progress !== undefined && (
                <div className="flex items-center gap-2">
                  <Progress value={project.progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {project.progress}%
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
