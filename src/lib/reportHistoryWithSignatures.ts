import { supabase } from '@/integrations/supabase/client';

export interface MergedHistoryEntry {
  id: string;
  action: string;
  action_at: string;
  details?: unknown;
  old_values?: unknown;
  new_values?: unknown;
  actor?: { id: string; name: string; avatar_url?: string | null } | null;
}

/**
 * Carrega o histórico do RDO e mescla as assinaturas registradas
 * (report_signatures) como eventos próprios da linha do tempo.
 */
export async function fetchReportHistoryWithSignatures(
  reportId: string
): Promise<MergedHistoryEntry[]> {
  const [historyRes, signaturesRes] = await Promise.all([
    supabase
      .from('report_history')
      .select(`
        id,
        action,
        action_at,
        details,
        old_values,
        new_values,
        actor:profiles!action_by(id, name, avatar_url)
      `)
      .eq('report_id', reportId)
      .order('action_at', { ascending: true }),
    supabase
      .from('report_signatures')
      .select('id, signer_name, signer_role, signer_email, signed_at, signer_user_id')
      .eq('report_id', reportId)
      .not('signed_at', 'is', null)
      .order('signed_at', { ascending: true }),
  ]);

  if (historyRes.error) throw historyRes.error;

  const history = (historyRes.data || []) as unknown as MergedHistoryEntry[];

  const signatureEntries: MergedHistoryEntry[] = (signaturesRes.data || []).map((s: any) => ({
    id: `signature-${s.id}`,
    action: 'signed',
    action_at: s.signed_at as string,
    details: {
      signer_name: s.signer_name,
      signer_role: s.signer_role,
      signer_email: s.signer_email,
      is_internal: !!s.signer_user_id,
    },
    actor: s.signer_name
      ? { id: s.signer_user_id || `signer-${s.id}`, name: s.signer_name, avatar_url: null }
      : null,
  }));

  return [...history, ...signatureEntries].sort(
    (a, b) => new Date(a.action_at).getTime() - new Date(b.action_at).getTime()
  );
}
