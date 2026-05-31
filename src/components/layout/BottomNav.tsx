import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ManagementDrawer } from './ManagementDrawer';
import { 
  Home,
  Plus,
  Settings,
  Wrench,
  Database,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  action?: 'management';
  roles?: string[];
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Início', href: '/home' },
  { icon: Plus, label: 'Novo', href: '/reports/new' },
  { icon: Sparkles, label: 'IA', href: '/ai-assistant' },
  { icon: Wrench, label: 'Gestão', action: 'management', roles: ['admin', 'super_admin'] },
  { icon: Settings, label: 'Config', href: '/settings' },
];

export function BottomNav() {
  const location = useLocation();
  const { role } = useAuth();
  const [showManagement, setShowManagement] = useState(false);

  const filteredItems = navItems.filter(
    item => !item.roles || (role && item.roles.includes(role))
  );

  const displayItems = filteredItems.slice(0, 5);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === '/home') {
      return location.pathname === '/home' || location.pathname.startsWith('/companies') || location.pathname.startsWith('/sites') || location.pathname.startsWith('/projects');
    }
    return location.pathname.startsWith(href);
  };

  const handleItemClick = (item: NavItem) => {
    if (item.action === 'management') {
      setShowManagement(true);
    }
  };

  return (
    <>
      <nav className="mobile-nav lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {displayItems.map((item) => {
            const Icon = item.icon;
            const active = item.href ? isActive(item.href) : false;
            const isNewButton = item.href === '/reports/quick';

            if (isNewButton) {
              return (
                <Link
                  key={item.href}
                  to={item.href!}
                  className="flex flex-col items-center justify-center -mt-4"
                >
                  <div className="p-3.5 bg-primary rounded-full shadow-lg shadow-primary/30 active:scale-95 transition-transform">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                </Link>
              );
            }

            if (item.action) {
              return (
                <button
                  key={item.label}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg glass-nav-item min-w-[60px]',
                    'text-muted-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                to={item.href!}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg glass-nav-item min-w-[60px]',
                  active ? 'glass-nav-item-active text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('w-5 h-5', active && 'text-primary')} />
                <span className={cn(
                  'text-xs font-medium',
                  active && 'text-primary'
                )}>
                  {item.label}
                </span>
                {active && (
                  <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      
      <ManagementDrawer 
        open={showManagement} 
        onOpenChange={setShowManagement} 
      />
    </>
  );
}
