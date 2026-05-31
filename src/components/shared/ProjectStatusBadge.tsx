import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const statusConfig: Record<ProjectStatus, { label: string; className: string; icon: string }> = {
  planning: {
    label: 'Planejamento',
    className: 'bg-warning/10 text-warning border-warning/20',
    icon: '🟡',
  },
  in_progress: {
    label: 'Em Andamento',
    className: 'bg-success/10 text-success border-success/20',
    icon: '🟢',
  },
  completed: {
    label: 'Finalizada',
    className: 'bg-primary/10 text-primary border-primary/20',
    icon: '🔵',
  },
  suspended: {
    label: 'Suspensa',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: '🔴',
  },
};

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status || 'Desconhecido',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    icon: '⚪',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}
