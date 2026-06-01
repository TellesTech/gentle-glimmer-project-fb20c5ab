import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SystemSettings {
  id: string;
  logo_url: string | null;
  pdf_logo_url: string | null;
  login_logo_url: string | null;
  favicon_url: string | null;
  system_name: string;
  system_subtitle: string;
  primary_color: string;
  accent_color: string;
  ai_avatar_url: string | null;
  // Optional/legacy fields not returned by get_public_branding RPC
  owner_name?: string | null;
  owner_email?: string | null;
  owner_role?: string | null;
  owner_phone?: string | null;
}

async function fetchSystemSettings(): Promise<SystemSettings | null> {
  try {
    const { data, error } = await (supabase as any).rpc('get_public_branding');

    if (error) {
      console.warn('Branding indisponível (modo degradado):', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as unknown as SystemSettings;
  } catch (err) {
    console.warn('Falha de rede ao carregar branding:', err);
    return null;
  }
}

export function useSystemSettings() {
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['system-settings'],
    queryFn: fetchSystemSettings,
    staleTime: 1000 * 60 * 5,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return { 
    settings: settings ?? null, 
    isLoading, 
    refetch 
  };
}
