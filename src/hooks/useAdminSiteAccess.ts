import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AdminSite {
  id: string;
  name: string;
  photoUrl: string | null;
  companyLogoUrl: string | null;
  companyPhotoUrl: string | null;
  companyName: string | null;
  companyId: string | null;
}

export interface AdminCompany {
  id: string;
  name: string;
  logoUrl: string | null;
  photoUrl: string | null;
  sites: AdminSite[];
  totalRdos: number;
  totalProjects: number;
}

interface AdminSiteAccess {
  siteIds: string[];
  sites: AdminSite[];
  companies: AdminCompany[];
  primarySiteId: string | null;
  activeSiteId: string | null;
  setActiveSiteId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function useAdminSiteAccess(): AdminSiteAccess {
  const { user, role } = useAuth();
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [activeSiteId, setActiveSiteIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || role !== 'admin') {
      setIsLoading(false);
      return;
    }

    const fetchSites = async () => {
      setIsLoading(true);
      setError(null);
      const { data, error: paaError } = await supabase
        .from('portal_admin_access')
        .select('site_id, sites(name, photo_url, company_id, companies(id, name, logo_url, photo_url))')
        .eq('user_id', user.id)
        .order('created_at');

      if (paaError) {
        console.warn('[useAdminSiteAccess] portal_admin_access error:', paaError);
        setError(paaError.message);
        setIsLoading(false);
        return;
      }

      const mapped: AdminSite[] = (data || []).map(d => {
        const site = d.sites as any;
        const company = site?.companies as any;
        return {
          id: d.site_id,
          name: site?.name || 'Sem nome',
          photoUrl: site?.photo_url || null,
          companyLogoUrl: company?.logo_url || null,
          companyPhotoUrl: company?.photo_url || null,
          companyName: company?.name || null,
          companyId: company?.id || site?.company_id || null,
        };
      });
      setSites(mapped);

      // Group by company
      const companyMap = new Map<string, AdminCompany>();
      for (const site of mapped) {
        const cId = site.companyId;
        if (!cId) continue;
        if (!companyMap.has(cId)) {
          companyMap.set(cId, {
            id: cId,
            name: site.companyName || 'Sem nome',
            logoUrl: site.companyLogoUrl,
            photoUrl: site.companyPhotoUrl,
            sites: [],
            totalRdos: 0,
            totalProjects: 0,
          });
        }
        companyMap.get(cId)!.sites.push(site);
      }

      // Fetch metrics per company
      const companyIds = Array.from(companyMap.keys());
      if (companyIds.length > 0) {
        const siteIds = mapped.map(s => s.id);
        const [projectsRes, reportsRes] = await Promise.all([
          supabase.from('projects').select('id, site_id').in('site_id', siteIds),
          supabase.from('reports').select('id, project_id, projects!inner(site_id)').in('projects.site_id', siteIds),
        ]);

        // Count projects per company
        for (const p of (projectsRes.data || [])) {
          const site = mapped.find(s => s.id === p.site_id);
          if (site?.companyId && companyMap.has(site.companyId)) {
            companyMap.get(site.companyId)!.totalProjects++;
          }
        }

        // Count RDOs per company
        for (const r of (reportsRes.data || []) as any[]) {
          const siteId = r.projects?.site_id;
          const site = mapped.find(s => s.id === siteId);
          if (site?.companyId && companyMap.has(site.companyId)) {
            companyMap.get(site.companyId)!.totalRdos++;
          }
        }
      }

      setCompanies(Array.from(companyMap.values()));

      if (mapped.length > 0 && !activeSiteId) {
        setActiveSiteIdState(mapped[0].id);
      }
      setIsLoading(false);
    };

    fetchSites().catch((err) => {
      console.warn('[useAdminSiteAccess] unexpected error:', err);
      setError(err?.message || 'Erro ao carregar unidades');
      setIsLoading(false);
    });
  }, [user, role]);

  const setActiveSiteId = useCallback((id: string) => {
    setActiveSiteIdState(id);
  }, []);

  const siteIds = sites.map(s => s.id);

  return {
    siteIds,
    sites,
    companies,
    primarySiteId: activeSiteId || siteIds[0] || null,
    activeSiteId,
    setActiveSiteId,
    isLoading: role === 'admin' ? isLoading : false,
    error,
  };
}
