import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  super_admin: {
    label: 'Super Admin',
    className: 'bg-primary/15 text-primary border-primary/25 backdrop-blur-sm',
  },
  admin: {
    label: 'Administrador',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  collaborator: {
    label: 'Operacional',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role] || roleConfig.collaborator;
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
