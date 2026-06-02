import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';

export function HomeRedirect() {
  const { role, isLoading, user } = useAuth();
  const { primarySiteId, companies, isLoading: isAccessLoading } = useAdminSiteAccess();
  const roleResolving = isLoading || (user && role === null);

  if (roleResolving || (role === 'admin' && isAccessLoading)) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'super_admin') return <Navigate to="/super-admin" replace />;

  if (role === 'admin') {
    if (companies.length > 1) return <Navigate to="/super-admin" replace />;
    if (primarySiteId) return <Navigate to={`/sites/${primarySiteId}/dashboard`} replace />;
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-2 p-6">
          <h2 className="text-lg font-semibold text-foreground">Nenhuma unidade atribuída</h2>
          <p className="text-sm text-muted-foreground">
            Entre em contato com o administrador principal para que ele atribua uma unidade ao seu perfil.
          </p>
        </div>
      </div>
    );
  }

  return <Navigate to="/reports" replace />;
}