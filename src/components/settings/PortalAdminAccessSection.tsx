import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, MapPin, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface PortalAdminAccessSectionProps {
  companies?: { id: string; name: string }[];
  companySites?: Record<string, { id: string; name: string; city: string | null; state: string | null }[]>;
  filterCompanyId?: string;
  /** When provided, renders only the inline admin selector for this single site (no Card/Collapsible wrapper). */
  siteId?: string;
}

export function PortalAdminAccessSection({ companies, companySites, filterCompanyId, siteId }: PortalAdminAccessSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: admins, isLoading: loadingAdmins } = useQuery({
    queryKey: ['portal-admins-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (!data || data.length === 0) return [];
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds)
        .order('name');
      return profiles || [];
    },
  });

  const { data: accessRecords, isLoading: loadingAccess } = useQuery({
    queryKey: ['portal-admin-access-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('portal_admin_access')
        .select('*');
      return (data as { id: string; user_id: string; site_id: string }[]) || [];
    },
  });

  const getAdminForSite = (siteId: string): string | undefined => {
    const record = accessRecords?.find(r => r.site_id === siteId);
    return record?.user_id;
  };

  const setAdminForSite = async (siteId: string, adminId: string | null) => {
    setSaving(siteId);
    try {
      // Delete existing records for this site
      const existing = accessRecords?.filter(r => r.site_id === siteId) || [];
      for (const rec of existing) {
        await supabase.from('portal_admin_access').delete().eq('id', rec.id);
      }
      // Insert new if adminId provided
      if (adminId) {
        await supabase.from('portal_admin_access').insert({ user_id: adminId, site_id: siteId });
      }
      queryClient.invalidateQueries({ queryKey: ['portal-admin-access-all'] });
    } catch (err) {
      toast({ title: 'Erro ao atualizar acesso', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  if (loadingAdmins || loadingAccess) {
    if (siteId) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!admins || admins.length === 0) {
    if (siteId) {
      return <span className="text-xs text-muted-foreground italic">Nenhum administrador disponível</span>;
    }
    return null;
  }

  // ===== INLINE SINGLE-SITE MODE =====
  if (siteId) {
    const currentAdmin = getAdminForSite(siteId);
    return saving === siteId ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : (
      <Select
        value={currentAdmin || '_none'}
        onValueChange={(val) => setAdminForSite(siteId, val === '_none' ? null : val)}
      >
        <SelectTrigger className="h-8 text-xs flex-1">
          <SelectValue placeholder="Selecionar administrador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">Nenhum</SelectItem>
          {admins.map(admin => (
            <SelectItem key={admin.id} value={admin.id}>
              {admin.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // ===== MULTI-SITE / COMPANY-SCOPED MODE (legacy) =====
  if (!companies || !companySites) return null;

  const filteredCompanies = filterCompanyId
    ? companies.filter(c => c.id === filterCompanyId)
    : companies;

  const companySiteEntries = filteredCompanies
    .map(c => ({ company: c, sites: companySites[c.id] || [] }))
    .filter(e => e.sites.length > 0);

  if (companySiteEntries.length === 0) return null;

  return (
    <Collapsible defaultOpen={!!filterCompanyId}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle>Administradores do Portal</CardTitle>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
            <CardDescription>Defina 1 administrador responsável por cada unidade</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-2">
              {companySiteEntries.map(({ company, sites }) =>
                sites.map(site => {
                  const currentAdmin = getAdminForSite(site.id);
                  return (
                    <div
                      key={site.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/30 bg-muted/20"
                    >
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{site.name}</span>
                        {!filterCompanyId && (
                          <span className="text-[10px] text-muted-foreground">{company.name}</span>
                        )}
                      </div>
                      {saving === site.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Select
                          value={currentAdmin || '_none'}
                          onValueChange={(val) => setAdminForSite(site.id, val === '_none' ? null : val)}
                        >
                          <SelectTrigger className="w-[200px] h-8 text-xs">
                            <SelectValue placeholder="Selecionar admin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {admins.map(admin => (
                              <SelectItem key={admin.id} value={admin.id}>
                                {admin.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
