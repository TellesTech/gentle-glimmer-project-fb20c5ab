// Primeiros segmentos de URL usados pelo app interno.
// Qualquer slug que bata com algum destes NÃO deve ser tratado
// como slug de empresa pelo portal do cliente (ClientLogin).
export const RESERVED_SLUGS = new Set<string>([
  'admin',
  'home',
  'super-admin',
  'reports',
  'service-reports',
  'users',
  'teams',
  'settings',
  'sites',
  'projects',
  'companies',
  'companies-manage',
  'workforce-database',
  'ai-assistant',
  'suggestions',
  'client',
  'login',
  'register',
  'setup',
  'forgot-password',
  'reset-password',
  'pv',
  'diagnostico',
]);

export function isReservedSlug(slug: string | undefined | null): boolean {
  if (!slug) return false;
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
