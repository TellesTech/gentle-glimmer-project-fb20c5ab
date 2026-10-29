import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/loose-client';
import { useAuth } from '@/contexts/AuthContext';

/** Faixa de aviso para super admins quando o WhatsApp está desconectado. */
export function WhatsAppStatusBanner() {
  const { role } = useAuth() as any;
  const isSuperAdmin = role === 'super_admin';
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['whatsapp-connection-status'],
    enabled: isSuperAdmin,
    refetchInterval: (query) =>
      query.state.data?.connection_status === 'disconnected' ? 15_000 : 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_integration_settings')
        .select('connection_status, connection_changed_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { connection_status: string | null; connection_changed_at: string | null } | null;
    },
  });

  // Some na hora ao reconectar: escuta mudanças de status em tempo real.
  useEffect(() => {
    if (!isSuperAdmin) return;
    const channel = supabase
      .channel('whatsapp-connection-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_integration_settings' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-connection-status'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, queryClient]);

  if (!isSuperAdmin || data?.connection_status !== 'disconnected') return null;

  const since = data.connection_changed_at
    ? new Date(data.connection_changed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">
        WhatsApp desconectado{since ? ` desde ${since}` : ''}. Os RDOs enviados pelo WhatsApp não estão entrando no sistema.
      </span>
      <Link
        to="/settings?tab=whatsapp"
        className="rounded-md bg-background px-3 py-1 font-medium text-foreground hover:opacity-90"
      >
        Ler QR Code
      </Link>
    </div>
  );
}
