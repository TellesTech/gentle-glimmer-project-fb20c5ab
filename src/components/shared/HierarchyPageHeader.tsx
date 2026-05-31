import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface HierarchyPageHeaderProps {
  /** Breadcrumb items - last one is current (no link) */
  breadcrumbs?: BreadcrumbItem[];
  /** Icon for the badge */
  badgeIcon: LucideIcon;
  /** Badge label text */
  badgeLabel: string;
  /** Page title (H1) */
  title: string;
  /** Subtitle text */
  subtitle?: string;
  /** Action buttons (e.g., "Nova Unidade") */
  actions?: React.ReactNode;
}

export function HierarchyPageHeader({
  breadcrumbs,
  badgeIcon: BadgeIcon,
  badgeLabel,
  title,
  subtitle,
  actions,
}: HierarchyPageHeaderProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Breadcrumb - sempre em 1 linha, com truncation */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-nowrap overflow-hidden min-w-0">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isFirst = index === 0;
            
            return (
              <div key={index} className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0 last:shrink last:min-w-0">
                {item.to ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    asChild 
                    className={cn(
                      "h-7 px-1.5 sm:h-8 sm:px-2",
                      !isFirst && "max-w-[80px] xs:max-w-[120px] sm:max-w-none"
                    )}
                  >
                    <Link to={item.to} className="flex items-center gap-1 truncate">
                      {isFirst && <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />}
                      <span className={cn(isFirst && "hidden xs:inline", "truncate")}>{item.label}</span>
                    </Link>
                  </Button>
                ) : (
                  <span className={cn(
                    "font-medium text-foreground",
                    isLast ? "truncate min-w-0" : "shrink-0"
                  )}>
                    {item.label}
                  </span>
                )}
                {!isLast && <span className="shrink-0">/</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Título principal - padrão fixo */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant="secondary" 
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-primary/10 text-primary border-primary/20 shrink-0"
            >
              <BadgeIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              {badgeLabel}
            </Badge>
          </div>
          <h1 className="text-xl xs:text-2xl font-bold truncate">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm truncate">{subtitle}</p>
          )}
        </div>
        
        {actions}
      </div>
    </div>
  );
}
