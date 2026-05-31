import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Bell, Menu, Settings, LogOut, User, Sun, Moon, CheckCheck } from 'lucide-react';
import { WhatsAppIcon } from '@/components/shared/WhatsAppIcon';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { ThemedLogo } from '@/components/shared/ThemedLogo';
import { toast } from 'sonner';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  mobileMenuOpen?: boolean;
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  collaborator: 'Operacional',
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-gray-900/85 backdrop-blur-xl border border-gray-700 shadow-md text-white',
  admin: 'bg-primary text-primary-foreground',
  collaborator: 'bg-muted text-muted-foreground',
};

export function Header({ onMobileMenuToggle, sidebarCollapsed, onSidebarToggle, mobileMenuOpen }: HeaderProps) {
  const { user, profile, role, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const currentTheme = resolvedTheme ?? 'light';
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleCopyWhatsAppTemplate = () => {
    const template = `📌 RELATÓRIO DIÁRIO DE OBRA (RDO)

📆 Data:
🧰 Equipe:
📍 Local da Atividade:
⏰ Período de Trabalho:
🔊 Faixa de Rádio (WEES):
🔊 Faixa de Rádio (Operação):
📄 Título da OM (obrigatório):
🚨 Ponto de Ambulância:
🚨 Ponto de Encontro:

⏱️ Controle de Liberação:
Chegada à sala do liberador:
Liberação da documentação:
Revalidação de bloqueio:

🛠️ Atividades Executadas:

📌 Desvios / Ocorrências:

🧗‍♂️ Efetivo do Dia:
1.
2.
3.
4.
5.`;
    navigator.clipboard.writeText(template).then(() => {
      toast.success('Relatório copiado! Cole no WhatsApp.');
    }).catch(() => {
      toast.error('Erro ao copiar relatório.');
    });
  };
  const userInitials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border/50 bg-background/95 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between h-full px-2 xs:px-3 sm:px-4 lg:px-6">
        {/* Left side - Menu buttons and Logo */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={onMobileMenuToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          {/* Mobile Logo - hidden when mobile menu is open */}
          <div className={cn(
            "lg:hidden max-w-[160px] min-w-0 overflow-hidden transition-opacity duration-200",
            mobileMenuOpen ? "opacity-0" : "opacity-100"
          )}>
            <ThemedLogo showText={false} className="min-w-0" />
          </div>
          {/* Desktop sidebar toggle - visible when sidebar is collapsed */}
          {sidebarCollapsed && onSidebarToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={onSidebarToggle}
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* WhatsApp Template */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="shrink-0 h-9 px-2 sm:px-3 sm:h-10 rounded-full text-green-600 dark:text-green-400"
                  onClick={handleCopyWhatsAppTemplate}
                >
                  <WhatsAppIcon className="h-[1.1rem] w-[1.1rem]" />
                  <span className="hidden sm:inline text-xs ml-1">Modelo de Relatório</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar Relatório para WhatsApp</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full"
            onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
            title={currentTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {currentTheme === 'dark' ? (
              <Sun className="h-[1.1rem] w-[1.1rem]" />
            ) : (
              <Moon className="h-[1.1rem] w-[1.1rem]" />
            )}
            <span className="sr-only">
              {currentTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            </span>
          </Button>

          {/* Notifications */}
          <Sheet open={notificationsOpen} onOpenChange={(open) => {
            setNotificationsOpen(open);
            if (open && unreadCount > 0) markAllAsRead();
          }}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative shrink-0 h-9 w-9 sm:h-10 sm:w-10">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-destructive text-destructive-foreground text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>Notificações</SheetTitle>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={markAllAsRead}>
                      <CheckCheck className="w-3.5 h-3.5" />
                      Marcar todas como lidas
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
                {notifications.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>
                )}
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 rounded-lg border transition-colors cursor-pointer',
                      !notification.read && 'bg-primary/5 border-primary/20'
                    )}
                    onClick={() => {
                      if (!notification.read) markAsRead(notification.id);
                      if (notification.link) {
                        setNotificationsOpen(false);
                        window.location.href = notification.link;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-2 h-2 mt-2 rounded-full shrink-0',
                        notification.type === 'success' && 'bg-success',
                        notification.type === 'error' && 'bg-destructive',
                        notification.type === 'warning' && 'bg-warning',
                        notification.type === 'info' && 'bg-info'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center">
                {/* Mobile: icon button only */}
                <Button variant="ghost" size="icon" className="sm:hidden h-9 w-9 shrink-0">
                  <Avatar className="w-7 h-7">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.name || ''} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
                {/* Desktop: button with avatar + name */}
                <Button variant="ghost" className="hidden sm:flex gap-2 pl-2 pr-3 shrink-0">
                  <Avatar className="w-8 h-8">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.name || ''} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">
                      {profile?.name?.split(' ')[0] || user?.email?.split('@')[0]}
                    </span>
                    {role && (
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {roleLabels[role] || role}
                      </span>
                    )}
                  </div>
                </Button>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{profile?.name || user?.email}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Meu Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={logout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
