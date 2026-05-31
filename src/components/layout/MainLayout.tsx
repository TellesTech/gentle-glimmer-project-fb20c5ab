import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { MobileSidebar } from './MobileSidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// Routes where BottomNav should be hidden (form pages with their own action bar)
const HIDE_BOTTOM_NAV_PATTERNS = [
  '/reports/create/',
  '/reports/full/new',
  '/edit-simple',
  '/edit',
];

export function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Check if current route should hide BottomNav
  const shouldHideBottomNav = HIDE_BOTTOM_NAV_PATTERNS.some(pattern => 
    location.pathname.includes(pattern)
  );

  const isAIAssistant = location.pathname === '/ai-assistant';

  return (
    <div className="flex min-h-screen w-full bg-background min-w-0">
      {/* Desktop Sidebar - FIXO */}
      <Sidebar />

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72 border-r-0 bg-sidebar">
          <MobileSidebar onClose={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content - com margem para compensar sidebar fixa */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden lg:ml-16">
        {/* Header - FIXO no topo */}
        <Header 
          sidebarCollapsed={true}
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
          mobileMenuOpen={mobileMenuOpen}
        />
        
        {/* Conteúdo que ROLA */}
        <main className={cn(
          'flex-1 p-3 sm:p-4 lg:p-6',
          'overflow-y-auto overflow-x-hidden',
          shouldHideBottomNav ? 'pb-6' : 'pb-36 lg:pb-6',
          isAIAssistant && (isDark ? 'bg-[hsl(240_10%_4%)]' : 'bg-muted/40')
        )}>
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation - hide on form pages */}
        {!shouldHideBottomNav && <BottomNav />}
      </div>

    </div>
  );
}
