import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PortalPerson {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  avatar_url: string | null;
  hasSignature: boolean;
  source: 'wees' | 'client';
  companyName: string | null;
}

interface Params {
  companyId?: string | null;
  siteIds?: string[];
}

/**
 * Lists the people responsible for the client portal:
 * - WEES side: internal users with access to the company's sites.
 *   `companyName` resolves to the WEES brand from `system_settings`.
 * - Client side: contacts and client_profiles linked to the company.
 *   `companyName` resolves to the actual client company name.
 */
export function usePortalResponsibles({ companyId, siteIds }: Params) {
  return useQuery({
    queryKey: ['portal-responsibles', companyId, (siteIds || []).join(',')],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ wees: PortalPerson[]; client: PortalPerson[]; weesCompanyName: string; clientCompanyName: string | null }> => {
      if (!companyId) return { wees: [], client: [], weesCompanyName: 'WEES', clientCompanyName: null };

      // 0) Resolve company names (WEES brand + client company)
      const [{ data: branding }, { data: companyRow }] = await Promise.all([
        (supabase as any).rpc('get_public_branding'),
        supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
      ]);
      const weesCompanyName = (branding?.[0] as any)?.system_name || 'WEES';
      const clientCompanyName = (companyRow as any)?.name || null;

      // 1) WEES responsibles via SECURITY DEFINER RPC (works for clients too,
      //    bypassing RLS on portal_admin_access / profiles in a controlled way).
      const { data: weesRows } = await (supabase as any)
        .rpc('get_portal_wees_responsibles', { _company_id: companyId });

      const wees: PortalPerson[] = ((weesRows || []) as any[])
        .map((p) => ({
          id: p.id,
          name: p.name || 'Sem nome',
          role: p.job_title || 'Equipe WEES',
          email: null,
          avatar_url: p.avatar_url,
          hasSignature: !!p.has_signature,
          source: 'wees' as const,
          companyName: weesCompanyName,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      // 3) Client contacts (company_contacts) + client_profiles
      const [{ data: contacts }, { data: clients }] = await Promise.all([
        supabase
          .from('company_contacts')
          .select('id, name, email, role, avatar_url, signature_data, can_approve, is_active')
          .eq('company_id', companyId)
          .eq('is_active', true),
        supabase
          .from('client_profiles')
          .select('id, name, email, role, signature_data, is_active, company_id, company')
          .eq('company_id', companyId)
          .eq('is_active', true),
      ]);

      const client: PortalPerson[] = [
        ...((contacts || []) as any[]).map((c) => ({
          id: `cc-${c.id}`,
          name: c.name || 'Sem nome',
          role: c.role || 'Cliente',
          email: c.email,
          avatar_url: c.avatar_url || null,
          hasSignature: !!c.signature_data,
          source: 'client' as const,
          companyName: clientCompanyName,
        })),
        ...((clients || []) as any[]).map((c) => ({
          id: `cp-${c.id}`,
          name: c.name || 'Sem nome',
          role: c.role || 'Cliente',
          email: c.email,
          avatar_url: null,
          hasSignature: !!c.signature_data,
          source: 'client' as const,
          companyName: clientCompanyName || c.company || null,
        })),
      ]
        .reduce((acc: PortalPerson[], cur) => {
          const dup = cur.email && acc.find((p) => p.email && p.email.toLowerCase() === cur.email!.toLowerCase());
          if (!dup) acc.push(cur);
          return acc;
        }, [])
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      return { wees, client, weesCompanyName, clientCompanyName };
    },
  });
}
