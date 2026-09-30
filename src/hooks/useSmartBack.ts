import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Voltar inteligente: usa a origem informada (state.from), senão o histórico do app,
 * senão uma rota "pai" de fallback. Nunca joga para o início sem motivo.
 */
export function useSmartBack(fallback: string = '/reports') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from !== location.pathname + location.search) {
      navigate(from);
      return;
    }
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, location, fallback]);
}

/** State para anexar a navegações, registrando a página de origem. */
export function useFromState() {
  const location = useLocation();
  return { from: location.pathname + location.search };
}
