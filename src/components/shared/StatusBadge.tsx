import { cn } from '@/lib/utils';
import type { ReportStatus } from '@/types';

interface StatusBadgeProps {
  status: ReportStatus;
  className?: string;
}

const statusConfig: Record<ReportStatus, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-muted text-muted-foreground border-border',
  },
  completed: {
    label: 'Concluído',
    className: 'bg-success/10 text-success border-success/20',
  },
  finalized: {
    label: 'Finalizado',
    className: 'bg-success/10 text-success border-success/20',
  },
  sent: {
    label: 'Enviado',
    className: 'bg-info/10 text-info border-info/20',
  },
  signed: {
    label: 'Assinado',
    className: 'bg-success/10 text-success border-success/20',
  },
};

const fallbackConfig = {
  label: 'Desconhecido',
  className: 'bg-muted text-muted-foreground border-border',
};

export function NoActivityBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        'bg-destructive/10 text-destructive border-destructive/20',
        className
      )}
    >
      Sem Atividade
    </span>
  );
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || fallbackConfig;
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
