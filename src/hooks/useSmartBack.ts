import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Há uma página anterior dentro do app no histórico do navegador? */
export function hasAppHistory() {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  return idx > 0;
}

/**
 * Voltar inteligente: volta de verdade no histórico do app quando possível
 * (sem empilhar cópias). Sem histórico (link direto / recarga), usa a origem
 * informada (state.from) ou a rota "pai" de fallback, substituindo a tela atual.
 */
export function useSmartBack(fallback: string = '/reports') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (hasAppHistory()) {
      navigate(-1);
      return;
    }
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from !== location.pathname + location.search) {
      navigate(from, { replace: true });
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, location, fallback]);
}

/**
 * Para fluxos pós-salvar: volta no histórico se houver página anterior;
 * senão substitui a tela atual pelo destino informado.
 */
export function useGoBackOr() {
  const navigate = useNavigate();
  return useCallback(
    (target: string) => {
      if (hasAppHistory()) {
        navigate(-1);
        return;
      }
      navigate(target, { replace: true });
    },
    [navigate]
  );
}

/** State para anexar a navegações, registrando a página de origem. */
export function useFromState() {
  const location = useLocation();
  return { from: location.pathname + location.search };
}
