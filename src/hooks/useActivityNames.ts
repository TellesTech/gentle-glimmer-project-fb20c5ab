import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Nomes personalizados das pastas de atividade (RDOs agrupados por OM).
 * Compartilhado entre o portal do cliente e a área WEES: renomear em um
 * lugar reflete no outro.
 */
export function useActivityNames(siteIds: string[] | undefined) {
  const queryClient = useQueryClient();
  const ids = (siteIds || []).filter(Boolean).slice().sort();

  const { data: result } = useQuery({
    queryKey: ['rdo-activity-names', ids],
    queryFn: async () => {
      const map = new Map<string, string>();
      const bySite = new Map<string, string>();
      if (!ids.length) return { map, bySite };
      const { data, error } = await (supabase as any)
        .from('rdo_activity_names')
        .select('site_id, group_key, custom_name')
        .in('site_id', ids);
      if (error) {
        console.warn('useActivityNames:', error.message);
        return { map, bySite };
      }
      (data || []).forEach((row: any) => {
        if (!row.group_key || !row.custom_name) return;
        map.set(row.group_key, row.custom_name);
        bySite.set(`${row.site_id}::${row.group_key}`, row.custom_name);
      });
      return { map, bySite };
    },
    enabled: ids.length > 0,
    staleTime: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rdo-activity-names'] });
  };

  const rename = useMutation({
    mutationFn: async ({ siteId, groupKey, name }: { siteId: string; groupKey: string; name: string }) => {
      const trimmed = name.trim();
      if (!siteId) throw new Error('Unidade não identificada para esta atividade.');
      if (!trimmed) throw new Error('Informe um nome para a pasta.');
      if (trimmed.length > 150) throw new Error('O nome deve ter no máximo 150 caracteres.');
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('rdo_activity_names')
        .upsert(
          {
            site_id: siteId,
            group_key: groupKey,
            custom_name: trimmed,
            created_by: userData?.user?.id ?? null,
          },
          { onConflict: 'site_id,group_key' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Nome da pasta atualizado');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível renomear a pasta'),
  });

  const resetName = useMutation({
    mutationFn: async ({ siteId, groupKey }: { siteId: string; groupKey: string }) => {
      const { error } = await (supabase as any)
        .from('rdo_activity_names')
        .delete()
        .eq('site_id', siteId)
        .eq('group_key', groupKey);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Nome automático restaurado');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível restaurar o nome'),
  });

  return {
    names: result?.map ?? new Map<string, string>(),
    namesBySite: result?.bySite ?? new Map<string, string>(),
    rename: rename.mutateAsync,
    resetName: resetName.mutateAsync,
    isSaving: rename.isPending || resetName.isPending,
  };
}