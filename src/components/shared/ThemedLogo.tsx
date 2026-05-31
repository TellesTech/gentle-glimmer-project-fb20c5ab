import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Skeleton } from '@/components/ui/skeleton';

interface ThemedLogoProps {
  className?: string;
  collapsed?: boolean;
  showText?: boolean;
  logoUrl?: string | null;
  companyName?: string | null;
  useLoginLogo?: boolean;
}

export function ThemedLogo({ 
  className, 
  collapsed, 
  showText = true,
  logoUrl,
  companyName,
  useLoginLogo = false
}: ThemedLogoProps) {
  const { settings, isLoading } = useSystemSettings();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  // Resolve logo URL based on theme:
  // - Login screen (dark red bg): keep login_logo_url priority
  // - Dark theme: prefer pdf_logo_url (white logo) → fallback to logo_url
  // - Light theme: use logo_url (colored) → fallback to pdf_logo_url
  const finalLogoUrl =
    logoUrl ??
    (useLoginLogo
      ? (settings?.login_logo_url || settings?.logo_url)
      : isDark
        ? (settings?.pdf_logo_url || settings?.logo_url)
        : (settings?.logo_url || settings?.pdf_logo_url));
  const finalCompanyName = companyName ?? settings?.system_name;

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Skeleton className="h-10 w-20 sm:w-24 rounded-lg" />
        {!collapsed && showText && <Skeleton className="h-5 w-24" />}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 transition-opacity duration-300",
      className
    )}>
      {finalLogoUrl ? (
        <img 
          src={finalLogoUrl} 
          alt={finalCompanyName || 'Logo'} 
          className={cn(
            "object-contain transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
            collapsed ? "h-14 w-14" : "h-10 max-h-10 w-auto max-w-[120px] sm:max-w-[180px]"
          )}
        />
      ) : (
        <div className={cn(
          "bg-primary/10 rounded-lg flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
          collapsed ? "h-12 w-12" : "h-14 w-14"
        )}>
          <Building2 className={cn(
            "text-primary",
            collapsed ? "h-6 w-6" : "h-8 w-8"
          )} />
        </div>
      )}
      {!collapsed && showText && finalCompanyName && (
        <div className="flex flex-col leading-none">
          <span className="font-bold text-xl tracking-tight text-foreground truncate max-w-[140px]">
            {finalCompanyName}
          </span>
        </div>
      )}
    </div>
  );
}
