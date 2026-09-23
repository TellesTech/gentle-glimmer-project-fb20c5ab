import { supabase } from '@/integrations/supabase/loose-client';

/**
 * Sincroniza as fotos uma única vez, durante o salvamento do RDO.
 * As exclusões usam o id da linha e só acontecem depois que as inclusões
 * foram confirmadas. No fim, relê o banco para não informar sucesso parcial.
 */
export async function saveReportPhotos(
  reportId: string,
  desiredUrls: string[],
): Promise<void> {
  const desired = [...new Set(desiredUrls.filter(Boolean))];
  const { data: existing, error: fetchError } = await supabase
    .from('report_photos')
    .select('id, url')
    .eq('report_id', reportId);
  if (fetchError) throw new Error(`Erro ao carregar fotos: ${fetchError.message}`);

  const existingUrls = new Set((existing || []).map((photo: any) => photo.url));
  const added = desired.filter((url) => !existingUrls.has(url));
  const removedIds = (existing || [])
    .filter((photo: any) => !desired.includes(photo.url))
    .map((photo: any) => photo.id);

  if (added.length > 0) {
    const { error } = await supabase
      .from('report_photos')
      .insert(added.map((url) => ({ report_id: reportId, url })));
    if (error) throw new Error(`Não foi possível vincular as fotos: ${error.message}`);
  }

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('report_photos')
      .delete()
      .in('id', removedIds);
    if (error) throw new Error(`Não foi possível remover as fotos: ${error.message}`);
  }

  const { data: confirmed, error: confirmError } = await supabase
    .from('report_photos')
    .select('url')
    .eq('report_id', reportId);
  if (confirmError) throw new Error(`Erro ao confirmar fotos: ${confirmError.message}`);

  const confirmedUrls = new Set((confirmed || []).map((photo: any) => photo.url));
  const missing = desired.filter((url) => !confirmedUrls.has(url));
  if (missing.length > 0 || confirmedUrls.size !== desired.length) {
    throw new Error('As fotos não foram vinculadas por completo. Tente salvar novamente.');
  }
}
