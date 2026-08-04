import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Modo "ver como cliente": alterna na mesma tela via ?view=client.
 * Disponível apenas para usuários internos WEES (super_admin/admin).
 */
export function useClientPreviewMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();

  const canPreviewAsClient = !!user && (role === 'super_admin' || role === 'admin');
  const isClientPreview = canPreviewAsClient && searchParams.get('view') === 'client';

  const setClientPreview = useCallback(
    (enabled: boolean) => {
      const next = new URLSearchParams(searchParams);
      if (enabled) next.set('view', 'client');
      else next.delete('view');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const toggleClientPreview = useCallback(
    () => setClientPreview(!isClientPreview),
    [isClientPreview, setClientPreview],
  );

  return { canPreviewAsClient, isClientPreview, setClientPreview, toggleClientPreview };
}
