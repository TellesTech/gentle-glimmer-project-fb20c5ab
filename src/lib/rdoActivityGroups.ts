/**
 * Agrupamento de RDOs em "atividades" (cards de Meus RDOs).
 * Regra: número da OM > título da OM > projeto, com fusão de títulos semelhantes.
 * Este módulo é compartilhado entre a tela Meus RDOs e a Base de Dados
 * para que os dois lugares mostrem exatamente os mesmos nomes.
 */

const INVALID_OM_VALUES = ['na', 'n/a', 'n.a', 'null', 'nao informado', 'não informado', '-', '--', 'sem om', '0'];

/** Retorna o número da OM limpo, ou null quando o valor for um placeholder ("NA", "N/A", "null"...). */
export function sanitizeOmNumber(value: string | null | undefined): string | null {
  const v = (value || '').trim();
  if (!v) return null;
  if (INVALID_OM_VALUES.includes(v.toLowerCase())) return null;
  return v;
}

/** Normaliza o número da OM para uso como chave de agrupamento. */
export function normalizeOmKeyNumber(value: string | null | undefined): string | null {
  const raw = sanitizeOmNumber(value);
  if (!raw) return null;
  const cleaned = raw
    .replace(/^\s*(om|o\.m\.?)\s*[:\-]?\s*/i, '')
    .replace(/^\s*[a-z]\s+/i, '')
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

/** Normaliza o título da OM (minúsculas, sem acentos, espaços colapsados). */
export function normalizeOmTitle(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TITLE_STOPWORDS = new Set([
  'e', 'de', 'da', 'do', 'das', 'dos', 'no', 'na', 'nos', 'nas', 'em', 'a', 'o', 'as', 'os',
  'com', 'para', 'por', 'um', 'uma', 'the', 's',
]);

/** Tokens significativos do título da OM (sem acento, sem stopwords, sem plural simples). */
export function omTitleTokens(value: string | null | undefined): Set<string> {
  const norm = normalizeOmTitle(value);
  return new Set(
    norm
      .split(' ')
      .map(t => t.replace(/s$/, ''))
      .filter(t => t.length > 1 && !TITLE_STOPWORDS.has(t))
  );
}

/** Similaridade de Jaccard entre dois conjuntos de tokens. */
export function tokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach(t => { if (b.has(t)) inter++; });
  return inter / (a.size + b.size - inter);
}

export const TITLE_MERGE_THRESHOLD = 0.8;

export function isGenericProjectName(name: string | null | undefined): boolean {
  const n = (name || '').trim();
  return !n || n === '*' || n.startsWith('Atividade criada via') || n.length <= 1;
}

export interface ActivityGroupInputReport {
  id: string;
  date: string;
  location?: string | null;
  maintenance_order_number?: string | null;
  maintenance_order_title?: string | null;
  project_id: string;
  project_name?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  company_name?: string | null;
}

export interface ActivityGroup {
  id: string;
  name: string;
  omNumber: string | null;
  omTitle: string | null;
  /** Todas as OMs (número) presentes nesta atividade. */
  omNumbers: string[];
  /** Todos os títulos de OM presentes nesta atividade. */
  omTitles: string[];
  reportIds: string[];
  projectIds: string[];
  siteIds: string[];
  siteName: string | null;
  companyName: string | null;
  lastDate: string | null;
  count: number;
  searchString: string;
}

interface InternalGroup extends ActivityGroup {
  titleCounts: Record<string, { label: string; count: number }>;
  locations: string[];
  projectNames: string[];
}

/**
 * Constrói os grupos de atividade (cards) a partir de uma lista de RDOs.
 * Um card = uma atividade (projeto). As OMs ficam listadas dentro do card.
 */
export function buildActivityGroups(
  reports: ActivityGroupInputReport[],
  customNames?: Map<string, string> | Record<string, string>,
): ActivityGroup[] {
  const byKey = new Map<string, InternalGroup>();

  reports.forEach((report) => {
    const omNum = normalizeOmKeyNumber(report.maintenance_order_number);
    const omTitle = (report.maintenance_order_title || '').trim();
    const omTitleKey = normalizeOmTitle(omTitle);
    const projectDisplayName = isGenericProjectName(report.project_name)
      ? (report.location || omTitle || report.project_name || 'Atividade')
      : (report.project_name as string);

    const key = `project:${report.project_id}`;

    let group = byKey.get(key);
    if (!group) {
      group = {
        id: key,
        name: projectDisplayName,
        omNumber: omNum,
        omTitle: omTitle || null,
        omNumbers: [],
        omTitles: [],
        reportIds: [],
        projectIds: [],
        siteIds: [],
        siteName: report.site_name || null,
        companyName: report.company_name || null,
        lastDate: null,
        count: 0,
        searchString: '',
        titleCounts: {},
        locations: [],
        projectNames: [],
      };
      byKey.set(key, group);
    }

    group.reportIds.push(report.id);
    group.count++;
    if (!group.projectIds.includes(report.project_id)) group.projectIds.push(report.project_id);
    if (report.site_id && !group.siteIds.includes(report.site_id)) group.siteIds.push(report.site_id);
    if (!group.siteName && report.site_name) group.siteName = report.site_name;
    if (!group.companyName && report.company_name) group.companyName = report.company_name;
    if (report.location && !group.locations.includes(report.location)) group.locations.push(report.location);
    if (projectDisplayName && !group.projectNames.includes(projectDisplayName)) group.projectNames.push(projectDisplayName);
    const rawOmNum = sanitizeOmNumber(report.maintenance_order_number);
    if (rawOmNum && !group.omNumbers.includes(rawOmNum)) group.omNumbers.push(rawOmNum);
    if (!group.omNumber && omNum) group.omNumber = omNum;
    if (omTitle) {
      if (!group.omTitles.includes(omTitle)) group.omTitles.push(omTitle);
      const k = omTitleKey || omTitle;
      group.titleCounts[k] = { label: omTitle, count: (group.titleCounts[k]?.count || 0) + 1 };
    }
    if (!group.lastDate || report.date > group.lastDate) group.lastDate = report.date;
  });

  const groups = Array.from(byKey.values());

  // Nome final: nome da atividade (fallback: título de OM mais frequente)
  groups.forEach((g) => {
    const best = Object.values(g.titleCounts).sort((a, b) => b.count - a.count)[0];
    const bestTitle = best?.label || g.omTitle || null;
    g.omTitle = bestTitle;
    g.name = g.projectNames[0] || bestTitle || 'Atividade';

    g.searchString = [
      g.name,
      ...g.omNumbers.map(n => `OM ${n}`),
      ...g.omTitles,
      ...g.locations,
      ...g.projectNames,
      g.siteName || '',
      g.companyName || '',
    ]
      .filter(Boolean)
      .join(' | ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  });

  return groups
    .sort((a, b) => {
      const da = a.lastDate || '';
      const db = b.lastDate || '';
      if (da !== db) return db.localeCompare(da);
      return b.count - a.count;
    })
    .map(({ titleCounts, locations, projectNames, ...rest }) => {
      const custom = customNames
        ? (customNames instanceof Map ? customNames.get(rest.id) : customNames[rest.id])
        : undefined;
      if (custom && custom.trim()) {
        const autoName = rest.name;
        return {
          ...rest,
          name: custom.trim(),
          searchString: `${rest.searchString} | ${custom.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()} | ${autoName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`,
        };
      }
      return rest;
    });
}
