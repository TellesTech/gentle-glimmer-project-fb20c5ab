import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageBackHeaderProps {
  onBack: () => void;
  icon?: ReactNode;
  iconClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de navegação do portal: seta redonda discreta + ícone + título.
 * Mesmo padrão usado na pasta de mês do dashboard do cliente.
 */
export function PageBackHeader({
  onBack,
  icon,
  iconClassName,
  title,
  subtitle,
  actions,
  className,
}: PageBackHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-2', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onBack();
        }}
        aria-label="Voltar"
        className="h-9 w-9 p-0 rounded-full hover:bg-muted shrink-0"
      >
        <ChevronRight className="h-5 w-5 rotate-180" />
      </Button>
      <div className="flex items-center gap-2 min-w-0">
        {icon && (
          <div className={cn('p-2 rounded-lg bg-primary/10 text-primary shrink-0', iconClassName)}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-bold truncate">{title}</h2>
          {subtitle && <div className="text-sm text-muted-foreground truncate">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
