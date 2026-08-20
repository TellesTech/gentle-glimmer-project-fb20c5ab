/**
 * Comparação entre a pasta de origem (card clicado em "Meus RDOs") e o destino
 * efetivamente escolhido no wizard de criação de RDO.
 */
import { normalizeOmKeyNumber, normalizeOmTitle, omTitleTokens, tokenSimilarity, TITLE_MERGE_THRESHOLD } from './rdoActivityGroups';

export interface OmContext {
  omNumber?: string | null;
  omTitle?: string | null;
}

/** Rótulo amigável de uma OM/atividade. */
export function describeOmContext(ctx: OmContext | null | undefined, fallback?: string | null): string {
  const num = normalizeOmKeyNumber(ctx?.omNumber || null);
  const title = (ctx?.omTitle || '').trim();
  if (num && title) return `OM ${num} — ${title}`;
  if (num) return `OM ${num}`;
  if (title) return title;
  return (fallback || '').trim() || 'Atividade sem OM';
}

/**
 * Retorna true quando o destino selecionado não corresponde à pasta de origem.
 * Só considera divergência quando há contexto de origem informado.
 */
export function isOmContextMismatch(origin: OmContext | null | undefined, target: OmContext | null | undefined): boolean {
  const originNum = normalizeOmKeyNumber(origin?.omNumber || null);
  const originTitle = normalizeOmTitle(origin?.omTitle || null);
  if (!originNum && !originTitle) return false;

  const targetNum = normalizeOmKeyNumber(target?.omNumber || null);
  const targetTitle = normalizeOmTitle(target?.omTitle || null);

  if (originNum) {
    // Sem OM no destino ou OM diferente => divergência
    return targetNum !== originNum;
  }

  if (!targetTitle) return true;
  if (targetTitle === originTitle) return false;
  return tokenSimilarity(omTitleTokens(origin?.omTitle), omTitleTokens(target?.omTitle)) < TITLE_MERGE_THRESHOLD;
}
