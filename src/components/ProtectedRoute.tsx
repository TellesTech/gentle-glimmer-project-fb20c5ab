import { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import { Loader2, Building2, Crown, MapPin, FolderKanban, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const { primarySiteId, sites, siteIds, companies, isLoading: isAccessLoading } = useAdminSiteAccess();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading || (role === 'admin' && isAccessLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Super admin → painel completo
  if (location.pathname === '/home' && role === 'super_admin') {
    return <Navigate to="/super-admin" replace />;
  }

  // Admin com 1 site direto
  if (location.pathname === '/home' && role === 'admin') {
    if (companies.length === 0 && !primarySiteId && !isAccessLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-2 p-6">
            <h2 className="text-lg font-semibold text-foreground">Nenhuma unidade atribuída</h2>
            <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador principal para que ele atribua uma unidade ao seu perfil.
            </p>
          </div>
        </div>
      );
    }

    if (companies.length === 0 && primarySiteId) {
      return <Navigate to={`/sites/${primarySiteId}/dashboard`} replace />;
    }
  }

  return <>{children}</>;
}
