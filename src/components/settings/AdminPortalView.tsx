import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ClientContactsSection } from './ClientContactsSection';

interface AdminPortalViewProps {
  userId: string;
}

export function AdminPortalView({ userId }: AdminPortalViewProps) {
  const navigate = useNavigate();
  // Fetch sites this admin has access to
  const { data: accessData, isLoading: loadingAccess } = useQuery({
    queryKey: ['portal-admin-access', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('portal_admin_access')
        .select('site_id')
        .eq('user_id', userId);
      return (data as { site_id: string }[]) || [];
    },
  });

  const siteIds = accessData?.map(a => a.site_id) || [];

  // Fetch site details with company info
  const { data: sites, isLoading: loadingSites } = useQuery({
    queryKey: ['admin-portal-sites', siteIds],
    queryFn: async () => {
      if (siteIds.length === 0) return [];
      const { data } = await supabase
        .from('sites')
        .select('id, name, slug, city, state, company_id, companies(id, name, slug)')
        .in('id', siteIds)
        .order('name');
      return (data as any[]) || [];
    },
    enabled: siteIds.length > 0,
  });

  if (loadingAccess || loadingSites) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sites || sites.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhuma unidade foi atribuída a você. Solicite ao super administrador o acesso ao portal.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sites.map(site => {
        const company = site.companies;
        const companySlug = company?.slug;
        const siteSlug = site.slug;
        const portalUrl = companySlug && siteSlug
          ? `/${companySlug}/${siteSlug}`
          : `/${company?.id || site.company_id}/${site.id}`;

        const siteSlugs: Record<string, string> = {};
        if (site.slug) siteSlugs[site.id] = site.slug;

        return (
          <div key={site.id} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{site.name}</CardTitle>
                      <CardDescription>{company?.name}{site.city ? ` · ${site.city}` : ''}{site.state ? `/${site.state}` : ''}</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 bg-primary/85 backdrop-blur-sm border border-primary/20"
                    onClick={() => navigate(`/client/dashboard?company_id=${site.company_id}&site_id=${site.id}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Portal
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <ClientContactsSection
              companyId={site.company_id}
              companyName={company?.name || ''}
              companySlug={companySlug}
              contactSiteSlugs={siteSlugs}
            />
          </div>
        );
      })}
    </div>
  );
}
