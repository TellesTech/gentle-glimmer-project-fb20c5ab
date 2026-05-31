import { Building2 } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function SystemLogo({ size = 'md', showText = true }: SystemLogoProps) {
  const { settings, isLoading } = useSystemSettings();

  const sizeClasses = {
    sm: { icon: 'h-6 w-6', container: 'h-10 w-10', text: 'text-lg', subtitle: 'text-xs' },
    md: { icon: 'h-7 w-7', container: 'h-12 w-12', text: 'text-2xl', subtitle: 'text-sm' },
    lg: { icon: 'h-10 w-10', container: 'h-16 w-16', text: 'text-3xl', subtitle: 'text-base' },
  };

  const classes = sizeClasses[size];

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className={`${classes.container} rounded-xl`} />
        {showText && (
          <div className="space-y-1">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {settings?.logo_url ? (
        <img
          src={settings.logo_url}
          alt={settings.system_name || 'Logo'}
          className={`${classes.container} object-contain`}
        />
      ) : (
        <div className={`${classes.container} bg-primary/10 rounded-xl flex items-center justify-center`}>
          <Building2 className={`${classes.icon} text-primary`} />
        </div>
      )}
      
      {showText && (
        <div>
          <span className={`${classes.text} font-bold text-foreground`}>
            {settings?.system_name || 'Sistema RDO'}
          </span>
          <p className={`${classes.subtitle} text-muted-foreground`}>
            {settings?.system_subtitle || 'Gestão de Atividades'}
          </p>
        </div>
      )}
    </div>
  );
}
