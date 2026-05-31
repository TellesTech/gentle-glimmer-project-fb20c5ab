import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEntityCounts } from '@/hooks/useEntityCounts';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserCog,
  Crown,
  Activity,
  BarChart3,
} from 'lucide-react';

interface ManagementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ManagementItem {
  icon: React.ElementType;
  label: string;
  href: string;
  roles: string[];
  countKey?: 'sites' | 'projects' | 'teams';
}

// Itens de gestão
const managementItems: ManagementItem[] = [
  { icon: UserCog, label: 'Usuários', href: '/users', roles: ['admin', 'super_admin'] },
  { icon: Users, label: 'Equipes', href: '/teams', roles: ['admin', 'super_admin'] },
];

const superAdminItems: ManagementItem[] = [
  { icon: Crown, label: 'Painel Administrativo', href: '/super-admin', roles: ['admin', 'super_admin'] },
  { icon: BarChart3, label: 'Métricas de Impacto', href: '/admin/impact', roles: ['admin', 'super_admin'] },
  { icon: Activity, label: 'Qualidade de Dados', href: '/admin/data-quality', roles: ['super_admin'] },
];

export function ManagementDrawer({ open, onOpenChange }: ManagementDrawerProps) {
  const { role, user, isLoading } = useAuth();
  const { counts } = useEntityCounts();
  const isRoleLoading = isLoading || (user && role === null);

  const filteredItems = managementItems.filter(
    item => role && item.roles.includes(role)
  );

  const filteredSuperAdminItems = superAdminItems.filter(
    item => role && item.roles.includes(role)
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-8 max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="text-center">Gestão</DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1 pb-4">
            {isRoleLoading ? (
              <>
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </>
            ) : (
              <>
                {/* Usuários primeiro */}
                {filteredItems.length > 0 && (
                  <>
                    {filteredItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <Icon className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
                
                {filteredSuperAdminItems.length > 0 && (
                  <>
                    <div className="pt-4 pb-2">
                      <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Administração
                      </p>
                    </div>
                    {filteredSuperAdminItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <Icon className="w-5 h-5 text-primary" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}