import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ClientPortalSettings {
  id: string;
  company_id: string | null;
  welcome_title: string;
  welcome_subtitle: string;
  client_logo_url: string | null;
  client_primary_color: string;
  client_accent_color: string;
  show_stats_cards: boolean;
  show_approval_rate: boolean;
  show_rejection_stats: boolean;
  show_supersign_alert: boolean;
  show_project_filter: boolean;
  dashboard_title: string;
  reports_title: string;
  signatures_title: string;
  profile_title: string;
  pending_message: string;
  all_clear_message: string;
  no_signature_alert_title: string;
  no_signature_alert_message: string;
  support_email: string | null;
  support_phone: string | null;
  footer_text: string | null;
  login_welcome_text: string | null;
}

const DEFAULTS: Omit<ClientPortalSettings, 'id'> = {
  company_id: null,
  welcome_title: 'Bem-vindo ao Portal',
  welcome_subtitle: 'Acompanhe seus relatórios e aprovações',
  client_logo_url: null,
  client_primary_color: '#991919',
  client_accent_color: '#1e1e1e',
  show_stats_cards: true,
  show_approval_rate: true,
  show_rejection_stats: true,
  show_supersign_alert: true,
  show_project_filter: true,
  dashboard_title: 'Dashboard',
  reports_title: 'Relatórios',
  signatures_title: 'Assinaturas',
  profile_title: 'Meu Perfil',
  pending_message: '{count} relatório(s) aguardando aprovação.',
  all_clear_message: 'Todos os relatórios estão em dia.',
  no_signature_alert_title: 'Assinatura WEES não configurada',
  no_signature_alert_message: 'Configure sua assinatura digital para aprovar relatórios.',
  support_email: null,
  support_phone: null,
  footer_text: null,
  login_welcome_text: null,
};

async function fetchSettings(companyId?: string): Promise<ClientPortalSettings> {
  let query = supabase.from('client_portal_settings').select('*');

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error('Erro ao carregar configurações do portal:', error);
    return { id: '', ...DEFAULTS };
  }

  if (!data) {
    return { id: '', ...DEFAULTS, company_id: companyId || null };
  }

  return data as unknown as ClientPortalSettings;
}

export function useClientPortalSettings(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['client-portal-settings', companyId || 'global'];

  const { data: settings, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSettings(companyId),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<ClientPortalSettings>) => {
      const { id, ...rest } = updates;
      const updateData = { 
        ...rest, 
        updated_at: new Date().toISOString(),
        ...(companyId ? { company_id: companyId } : {}),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('client_portal_settings')
          .update(updateData)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_portal_settings')
          .insert(updateData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Configurações do portal salvas!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar configurações',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });

  return {
    settings: settings ?? { id: '', ...DEFAULTS },
    isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
