import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Logo genérica para páginas de autenticação (login, register, etc.)
 * Exibe um ícone placeholder quando não há logo configurada
 */
export function AuthLogo({ className, size = 'md' }: AuthLogoProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn(
      "bg-primary/10 rounded-xl flex items-center justify-center",
      sizeClasses[size],
      className
    )}>
      <Building2 className={cn("text-primary", iconSizes[size])} />
    </div>
  );
}
