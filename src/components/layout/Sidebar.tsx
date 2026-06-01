import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import { 
  Home,
  Users,
  Settings,
  LogOut,
  Crown,
  Lightbulb,
  PenLine,
  HardDrive,
  FilePlus,
  ClipboardList,
  Activity,
  FileText,
  Database,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ThemedLogo } from '@/components/shared/ThemedLogo';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  roles?: string[];
}

const quickActionItems: NavItem[] = [
  { icon: FilePlus, label: 'Criar RDO', href: '/reports/new' },
  { icon: ClipboardList, label: 'Meus RDOs', href: '/reports' },
  { icon: FileText, label: 'Relatórios de Serviço', href: '/service-reports' },
  { icon: PenLine, label: 'Assinaturas', href: '/client/select', roles: ['admin', 'super_admin', 'collaborator'] },
];

const managementNavItems: NavItem[] = [
  { icon: Database, label: 'Base de Dados HH', href: '/workforce-database', roles: ['admin', 'super_admin'] },
  { icon: Users, label: 'Colaboradores', href: '/users', roles: ['admin', 'super_admin'] },
  { icon: HardDrive, label: 'Backup', href: '/admin/backup', roles: ['admin', 'super_admin'] },
  { icon: Activity, label: 'Qualidade de Dados', href: '/admin/data-quality', roles: ['super_admin'] },
  { icon: KeyRound, label: 'Chaves de API', href: '/admin/api-keys', roles: ['super_admin'] },
];

export function Sidebar() {
  const [hovered, setHovered] = useState(false);
  const location = useLocation();
  const { user, role, logout, isLoading } = useAuth();
  const { primarySiteId, companies } = useAdminSiteAccess();
  
  const expanded = hovered;
  const isRoleLoading = isLoading || (user && role === null);

  const isActive = (href: string) => {
    const pathname = location.pathname;
    if (href === '/home' || href === '/super-admin' || href.startsWith('/sites/')) {
      return pathname === '/home' || pathname === '/super-admin' || pathname.startsWith('/sites/');
    }
    if (href === '/reports/new') return pathname === '/reports/new';
    if (href === '/service-reports') return pathname.startsWith('/service-reports');
    if (href === '/reports') {
      return pathname === '/reports' || 
             (pathname.startsWith('/reports/') && 
              !pathname.includes('/new') && 
              !pathname.includes('/quick'));
    }
    return pathname === href;
  };

  const getMainNavItem = (): NavItem => {
    if (role === 'super_admin') {
      return { icon: Crown, label: 'Painel Administrativo', href: '/super-admin' };
    }
    if (role === 'admin') {
      if (companies.length > 1) {
        return { icon: Home, label: 'Minha Unidade', href: '/home' };
      }
      if (primarySiteId) {
        return { icon: Home, label: 'Minha Unidade', href: `/sites/${primarySiteId}/dashboard` };
      }
    }
    return { icon: Home, label: 'Início', href: '/home' };
  };

  const mainNavItem = getMainNavItem();

  const filteredQuickActionItems = quickActionItems.filter(
    item => !item.roles || (role && item.roles.includes(role))
  );
  const filteredManagementItems = managementNavItems.filter(
    item => !item.roles || (role && item.roles.includes(role))
  );

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    const content = (
      <Link
        to={item.href}
        className={cn(
          'flex items-center rounded-lg glass-nav-item relative z-10 transition-colors duration-200',
          active
            ? 'glass-nav-item-active text-sidebar-foreground'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground',
          expanded ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className={cn(
          'font-medium whitespace-nowrap overflow-hidden transition-all duration-300',
          expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
        )}>
          {item.label}
        </span>
      </Link>
    );

    if (!expanded) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };


  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'hidden lg:flex flex-col fixed top-0 left-0 h-screen z-50 bg-sidebar border-r border-border transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]',
        expanded ? 'w-64 shadow-xl' : 'w-16'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center border-b border-border overflow-hidden',
        expanded ? 'h-16 px-4' : 'h-16 justify-center'
      )}>
        <Link to="/home" className="flex items-center justify-center w-full">
          <ThemedLogo collapsed={!expanded} showText={false} />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto relative">
        <NavItemComponent item={mainNavItem} />
        <NavItemComponent item={{ icon: Sparkles, label: 'Assistente IA', href: '/ai-assistant' }} />

        <Separator className="my-4 bg-border" />
        {expanded && (
          <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Ações Rápidas
          </p>
        )}
        {filteredQuickActionItems.map((item) => (
          <NavItemComponent key={item.href} item={item} />
        ))}

        {isRoleLoading ? (
          <>
            <Separator className="my-4 bg-border" />
            <div className="space-y-2 px-3">
              {expanded && <Skeleton className="h-4 w-16 bg-muted-foreground/10" />}
              <Skeleton className={cn("h-10 bg-muted-foreground/10", !expanded ? "w-10" : "w-full")} />
              <Skeleton className={cn("h-10 bg-muted-foreground/10", !expanded ? "w-10" : "w-full")} />
            </div>
          </>
        ) : (
          <>
            {filteredManagementItems.length > 0 && (
              <>
                <Separator className="my-4 bg-border" />
                {expanded && (
                  <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                    Gestão
                  </p>
                )}
                {filteredManagementItems.map((item) => (
                  <NavItemComponent 
                    key={item.href} 
                    item={item} 
                  />
                ))}
              </>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1 relative">
        <NavItemComponent 
          item={{ icon: Lightbulb, label: 'Sugestões', href: '/suggestions' }} 
        />
        <NavItemComponent 
          item={{ icon: Settings, label: 'Configurações', href: '/settings' }} 
        />
        
        {!expanded ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className="flex items-center justify-center w-full px-2 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Sair
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium whitespace-nowrap overflow-hidden transition-all duration-300 opacity-100">Sair</span>
          </button>
        )}
      </div>
    </aside>
  );
}