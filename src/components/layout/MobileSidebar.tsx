import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home, Users, Building2, Settings, LogOut, Crown, Lightbulb,
  PenLine, HardDrive, FilePlus, ClipboardList, Activity, Sparkles,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ThemedLogo } from '@/components/shared/ThemedLogo';
import { Skeleton } from '@/components/ui/skeleton';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  roles?: string[];
}

const getMainNavItem = (role: string | null): NavItem => {
  if (role === 'admin' || role === 'super_admin') {
    return { icon: Crown, label: 'Painel Administrativo', href: '/super-admin' };
  }
  return { icon: Home, label: 'Início', href: '/home' };
};

const quickActionItems: NavItem[] = [
  { icon: FilePlus, label: 'Criar RDO', href: '/reports/new' },
  { icon: ClipboardList, label: 'Meus RDOs', href: '/reports' },
  { icon: PenLine, label: 'Assinaturas', href: '/client/select', roles: ['admin', 'super_admin', 'collaborator'] },
];

const managementNavItems: NavItem[] = [
  { icon: Users, label: 'Colaboradores', href: '/users', roles: ['admin', 'super_admin'] },
  { icon: HardDrive, label: 'Backup', href: '/admin/backup', roles: ['admin', 'super_admin'] },
  { icon: Activity, label: 'Qualidade de Dados', href: '/admin/data-quality', roles: ['super_admin'] },
];

const footerItems: NavItem[] = [
  { icon: Lightbulb, label: 'Sugestões', href: '/suggestions' },
  { icon: Settings, label: 'Configurações', href: '/settings' },
];

interface MobileSidebarProps {
  onClose: () => void;
}

export function MobileSidebar({ onClose }: MobileSidebarProps) {
  const location = useLocation();
  const { role, logout, isLoading, user } = useAuth();

  const isRoleLoading = isLoading || (user && role === null);

  const isActive = (href: string) => {
    const pathname = location.pathname;
    if (href === '/home' || href === '/super-admin') return pathname === '/home' || pathname === '/super-admin';
    if (href === '/reports/new') return pathname === '/reports/new';
    if (href === '/reports') return pathname === '/reports' || (pathname.startsWith('/reports/') && !pathname.includes('/new') && !pathname.includes('/quick'));
    return pathname === href;
  };

  const mainNavItem = getMainNavItem(role);
  const filteredQuickActions = quickActionItems.filter(i => !i.roles || (role && i.roles.includes(role)));
  const filteredManagement = managementNavItems.filter(i => !i.roles || (role && i.roles.includes(role)));

  const NavItem = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        to={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg glass-nav-item',
          active
            ? 'glass-nav-item-active text-sidebar-foreground'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border">
        <Link to="/home" onClick={onClose} className="flex items-center gap-2">
          <ThemedLogo collapsed={false} showText={false} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavItem item={mainNavItem} />
        <NavItem item={{ icon: Sparkles, label: 'Assistente IA', href: '/ai-assistant' }} />

        <Separator className="my-4 bg-border" />
        <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Ações Rápidas</p>
        {filteredQuickActions.map(item => <NavItem key={item.href} item={item} />)}

        {isRoleLoading ? (
          <>
            <Separator className="my-4 bg-border" />
            <div className="space-y-2 px-3">
              <Skeleton className="h-4 w-16 bg-muted-foreground/10" />
              <Skeleton className="h-10 w-full bg-muted-foreground/10" />
              <Skeleton className="h-10 w-full bg-muted-foreground/10" />
            </div>
          </>
        ) : filteredManagement.length > 0 && (
          <>
            <Separator className="my-4 bg-border" />
            <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Gestão</p>
            {filteredManagement.map(item => <NavItem key={item.href} item={item} />)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        {footerItems.map(item => <NavItem key={item.href} item={item} />)}
        <button
          onClick={() => { onClose(); logout(); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}
