import { supabase } from '@/integrations/supabase/client';

/**
 * Sincroniza imediatamente as fotos de um RDO existente com a tabela
 * `report_photos`. Usado enquanto o usuário edita, para que as fotos
 * nunca dependam do clique em "Salvar".
 */
export async function syncReportPhotosNow(
  reportId: string,
  prevUrls: string[],
  nextUrls: string[],
): Promise<void> {
  const added = nextUrls.filter((u) => !prevUrls.includes(u));
  const removed = prevUrls.filter((u) => !nextUrls.includes(u));

  if (added.length > 0) {
    const { error } = await supabase
      .from('report_photos')
      .insert(added.map((url) => ({ report_id: reportId, url })));
    if (error) throw new Error(error.message);
  }

  if (removed.length > 0) {
    const { error } = await supabase
      .from('report_photos')
      .delete()
      .eq('report_id', reportId)
      .in('url', removed);
    if (error) throw new Error(error.message);
  }
}
