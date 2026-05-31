import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Building2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PortalSite {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  company_id: string;
  companies: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    photo_url: string | null;
  } | null;
}

export default function ClientPortalPicker() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const { data: sites, isLoading } = useQuery({
    queryKey: ['client-portal-picker-sites', user?.id, role],
    queryFn: async (): Promise<PortalSite[]> => {
      if (!user?.id) return [];

      // Super admin: acesso a todas as unidades
      if (role === 'super_admin') {
        const { data } = await supabase
          .from('sites')
          .select('id, name, city, state, company_id, companies(id, name, slug, logo_url, photo_url)')
          .order('name');
        return (data as any[]) || [];
      }

      const [{ data: paa }, { data: srs }] = await Promise.all([
        supabase.from('portal_admin_access').select('site_id').eq('user_id', user.id),
        supabase.from('site_responsibles').select('site_id').eq('user_id', user.id),
      ]);
      const siteIds = Array.from(new Set([
        ...((paa || []) as any[]).map((r) => r.site_id),
        ...((srs || []) as any[]).map((r) => r.site_id),
      ].filter(Boolean)));

      if (!siteIds.length) return [];

      const { data } = await supabase
        .from('sites')
        .select('id, name, city, state, company_id, companies(id, name, slug, logo_url, photo_url)')
        .in('id', siteIds)
        .order('name');
      return (data as any[]) || [];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const onlySite = useMemo(() => (sites && sites.length === 1 ? sites[0] : null), [sites]);

  useEffect(() => {
    if (onlySite) {
      navigate(
        `/client/dashboard?company_id=${onlySite.company_id}&site_id=${onlySite.id}`,
        { replace: true }
      );
    }
  }, [onlySite, navigate]);

  if (isLoading || onlySite) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Header = ({ subtitle }: { subtitle: string }) => (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/home')}
          className="h-8 px-2 text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Início
        </Button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl xs:text-2xl font-bold">Área de Assinatura do Cliente</h1>
        <Badge variant="outline" className="text-xs shrink-0">
          Selecione a Unidade
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );

  if (!sites || sites.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-3xl">
        <Header subtitle="Nenhuma unidade disponível para acesso." />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhuma unidade foi atribuída a você. Solicite ao super administrador o acesso ao portal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <Header subtitle="Escolha qual Área do Cliente deseja acessar." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {sites.map((site) => {
          const company = site.companies;
          const logo = company?.logo_url || company?.photo_url || null;
          const location = [site.city, site.state].filter(Boolean).join('/');
          return (
            <Card
              key={site.id}
              className="cursor-pointer transition-all sm:hover:shadow-xl sm:hover:scale-[1.02] active:scale-[0.99] group h-full relative overflow-hidden"
              onClick={() =>
                navigate(`/client/dashboard?company_id=${site.company_id}&site_id=${site.id}`)
              }
            >
              <Badge variant="secondary" className="absolute top-2 left-2 z-10 text-[10px] px-2 py-0.5">
                Unidade
              </Badge>

              <div className="aspect-[2/1] flex items-center justify-center bg-muted/30 p-4">
                {logo ? (
                  <img
                    src={logo}
                    alt={company?.name || site.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>

              <div className="p-3 pt-2 space-y-1.5">
                <button
                  type="button"
                  className="w-full py-2 px-3 rounded-lg bg-white/80 backdrop-blur-xl border border-gray-200 shadow-md text-sm font-semibold text-gray-800 hover:bg-white/90 hover:shadow-lg transition-all truncate"
                >
                  Acessar {site.name}
                </button>
                {(company?.name || location) && (
                  <p className="text-[11px] text-muted-foreground text-center truncate px-1">
                    {company?.name}
                    {location ? ` · ${location}` : ''}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
