import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import { Button } from '@/components/ui/button';

export function HomeRedirect() {
  const { role, isLoading, user, roleResolved, logout } = useAuth();
  const { primarySiteId, companies, isLoading: isAccessLoading, error: accessError } = useAdminSiteAccess();

  // Fallback: if the loader stays visible for more than 10s, show a manual escape hatch.
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 10000);
    return () => clearTimeout(t);
  }, []);

  const roleResolving = isLoading || (!!user && !roleResolved);

  // No role assigned after resolution — do not spin forever.
  if (!isLoading && user && roleResolved && role === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3 p-6 max-w-md">
          <h2 className="text-lg font-semibold text-foreground">Sua conta ainda não tem um papel atribuído</h2>
          <p className="text-sm text-muted-foreground">
            Peça ao administrador principal para atribuir um papel ao seu usuário. Se você já tem acesso, tente sair e entrar novamente.
          </p>
          <Button variant="outline" onClick={() => logout()}>Sair</Button>
        </div>
      </div>
    );
  }

  if (roleResolving || (role === 'admin' && isAccessLoading)) {
    if (slowLoad) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-3 p-6 max-w-md">
            <h2 className="text-lg font-semibold text-foreground">Demorando mais que o normal…</h2>
            <p className="text-sm text-muted-foreground">
              {accessError
                ? `Erro ao carregar unidades: ${accessError}`
                : 'Não conseguimos carregar seus dados de acesso. Tente recarregar a página.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>Recarregar</Button>
              <Button variant="outline" onClick={() => logout()}>Sair</Button>
            </div>
          </div>
        </div>
      );
    }
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