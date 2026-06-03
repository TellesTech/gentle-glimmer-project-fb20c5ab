import { supabase } from '@/integrations/supabase/client';

/**
 * Recebe uma lista de user_ids candidatos e retorna um Set com apenas
 * os IDs que realmente existem em public.profiles. Útil para sanitizar
 * o user_id antes de inserir/atualizar report_attendance (FK -> profiles).
 */
export async function getValidProfileIds(userIds: Array<string | null | undefined>): Promise<Set<string>> {
  const ids = Array.from(new Set(userIds.filter((u): u is string => !!u)));
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', ids);
  if (error || !data) return new Set();
  return new Set(data.map((p: { id: string }) => p.id));
}
