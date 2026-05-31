import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ClientContactsSection } from './ClientContactsSection';
import { PortalAdminAccessSection } from './PortalAdminAccessSection';
import { AdminPortalView } from './AdminPortalView';
import { MapPin, Loader2, ExternalLink, Building2, ArrowLeft, Pencil, Users, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClientPortalSettingsTabProps {
  role: string;
  userId: string;
}

export function ClientPortalSettingsTab({ role, userId }: ClientPortalSettingsTabProps) {
  const isSuperAdmin = role === 'super_admin';
  if (!isSuperAdmin) {
    return <AdminPortalView userId={userId} />;
  }
  return <SuperAdminPortalView />;
}

const getPublicImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/company-photos/${url}`;
};

function SuperAdminPortalView() {
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  const { data: companies, refetch: refetchCompanies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name, logo_url, slug, photo_url').order('name');
      return data || [];
    },
  });

  const { data: companySites, refetch: refetchSites } = useQuery({
    queryKey: ['companies-sites-all', companies?.map(c => c.id)],
    queryFn: async () => {
      if (!companies || companies.length === 0) return {};
      const result: Record<string, { id: string; name: string; slug: string | null; city: string | null; state: string | null }[]> = {};
      for (const c of companies) {
        const { data } = await supabase.from('sites').select('id, name, slug, city, state').eq('company_id', c.id).order('name');
        result[c.id] = (data as any[]) || [];
      }
      return result;
    },
    enabled: !!companies && companies.length > 0,
  });

  const editingCompany = companies?.find(c => c.id === editingCompanyId);

  // ===== EDIT VIEW (compact unit table) =====
  if (editingCompanyId && editingCompany) {
    const sites = companySites?.[editingCompanyId] || [];
    return (
      <CompanyEditView
        company={editingCompany}
        sites={sites}
        onBack={() => setEditingCompanyId(null)}
        onSlugSaved={() => { refetchCompanies(); refetchSites(); }}
      />
    );
  }

  // ===== CARD GRID VIEW =====
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {companies?.map((company) => {
          const portalUrl = company.slug ? `/${company.slug}` : `/${company.id}`;
          return (
            <Card
              key={company.id}
              className="cursor-pointer transition-all sm:hover:shadow-xl sm:hover:scale-[1.02] active:scale-[0.99] group h-full relative overflow-hidden"
              onClick={() => window.open(portalUrl, '_blank')}
            >
              <Badge variant="secondary" className="absolute top-2 left-2 z-10 text-[10px] px-2 py-0.5">
                Portal
              </Badge>

              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 z-10 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCompanyId(company.id);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>

              <div className="aspect-[2/1] flex items-center justify-center bg-muted/30 p-4">
                {(company.logo_url || company.photo_url) ? (
                  <img
                    src={getPublicImageUrl(company.logo_url || company.photo_url)}
                    alt={company.name}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>

              <div className="p-3 pt-2">
                <button className="w-full py-2 px-3 rounded-lg bg-background/80 backdrop-blur-xl border border-border shadow-md text-sm font-semibold text-foreground hover:bg-background/90 hover:shadow-lg transition-all">
                  {company.name}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Compact unit-table edit view
// ============================================================
interface CompanyEditViewProps {
  company: { id: string; name: string; slug: string | null; logo_url: string | null; photo_url: string | null };
  sites: { id: string; name: string; slug: string | null; city: string | null; state: string | null }[];
  onBack: () => void;
  onSlugSaved: () => void;
}

function CompanyEditView({ company, sites, onBack, onSlugSaved }: CompanyEditViewProps) {
  const navigate = useNavigate();
  const [contactsDialogSiteId, setContactsDialogSiteId] = useState<string | null>(null);

  // Contact counts per site (for the badge)
  const { data: contactCounts } = useQuery({
    queryKey: ['site-contact-counts', sites.map(s => s.id)],
    queryFn: async () => {
      if (sites.length === 0) return {} as Record<string, number>;
      const { data } = await supabase
        .from('contact_sites')
        .select('site_id')
        .in('site_id', sites.map(s => s.id));
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.site_id] = (counts[row.site_id] || 0) + 1;
      });
      return counts;
    },
    enabled: sites.length > 0,
  });

  const dialogSite = sites.find(s => s.id === contactsDialogSiteId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {(company.logo_url || company.photo_url) ? (
          <img
            src={getPublicImageUrl(company.logo_url || company.photo_url)}
            alt={company.name}
            className="h-9 w-9 rounded object-contain shrink-0"
          />
        ) : (
          <Building2 className="h-7 w-7 text-muted-foreground shrink-0" />
        )}
        <h2 className="text-lg font-semibold truncate flex-1">{company.name}</h2>
      </div>

      {/* Global company slug — auto-save on blur */}
      <div className="flex items-center gap-2 px-1 text-sm">
        <span className="text-muted-foreground font-mono shrink-0">rdo.wees.com.br/</span>
        <SlugAutoInput
          initial={company.slug || ''}
          placeholder="slug-da-empresa"
          onSave={async (val) => {
            const { error } = await supabase.from('companies').update({ slug: val || null }).eq('id', company.id);
            if (error) throw error;
            onSlugSaved();
          }}
        />
      </div>

      {/* Units table */}
      {sites.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma unidade cadastrada para esta empresa.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(180px,1.2fr)_minmax(180px,1.4fr)_auto] gap-3 px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border/40 bg-muted/30">
            <span>Unidade</span>
            <span>Slug</span>
            <span>Administrador</span>
            <span className="text-right pr-1">Contatos</span>
          </div>

          {sites.map((site, idx) => {
            const count = contactCounts?.[site.id] ?? 0;
            const portalReady = !!company.slug && !!site.slug;
            return (
              <div
                key={site.id}
                className={`grid grid-cols-[minmax(220px,1.5fr)_minmax(180px,1.2fr)_minmax(180px,1.4fr)_auto] gap-3 px-4 py-3 items-start ${idx > 0 ? 'border-t border-border/40' : ''} hover:bg-muted/20 transition-colors`}
              >
                {/* Unit name */}
                <div className="flex items-start gap-2 min-w-0 pt-1.5">
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="font-medium text-sm break-words leading-snug">{site.name}</span>
                  {portalReady && (
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({ company_id: company.id, site_id: site.id });
                        navigate(`/client/dashboard?${params.toString()}`);
                      }}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5 shrink-0"
                      title="Acessar portal"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Slug auto-save */}
                <SlugAutoInput
                  initial={site.slug || ''}
                  placeholder="slug-unidade"
                  onSave={async (val) => {
                    const { error } = await supabase.from('sites').update({ slug: val || null }).eq('id', site.id);
                    if (error) throw error;
                    onSlugSaved();
                  }}
                />

                {/* Admin select */}
                <PortalAdminAccessSection siteId={site.id} />

                {/* Contacts button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 shrink-0"
                  onClick={() => setContactsDialogSiteId(site.id)}
                >
                  <Users className="h-3.5 w-3.5" />
                  <Badge variant={count > 0 ? 'default' : 'secondary'} className="h-4 px-1.5 text-[10px]">
                    {count}
                  </Badge>
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Contacts dialog */}
      <Dialog open={!!contactsDialogSiteId} onOpenChange={(open) => !open && setContactsDialogSiteId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Contatos — {dialogSite?.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie os contatos do cliente que terão acesso a esta unidade.
            </DialogDescription>
          </DialogHeader>

          {dialogSite && (
            <ClientContactsSection
              companyId={company.id}
              companyName={company.name}
              companySlug={company.slug || undefined}
              contactSiteSlugs={dialogSite.slug ? { [dialogSite.id]: dialogSite.slug } : undefined}
              siteId={dialogSite.id}
              siteName={dialogSite.name}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Slug input with debounced auto-save (800ms)
// ============================================================
interface SlugAutoInputProps {
  initial: string;
  placeholder?: string;
  onSave: (val: string) => Promise<void>;
}

function SlugAutoInput({ initial, placeholder, onSave }: SlugAutoInputProps) {
  const { toast } = useToast();
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initial);

  useEffect(() => {
    setValue(initial);
    lastSavedRef.current = initial;
  }, [initial]);

  const triggerSave = (val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (val === lastSavedRef.current) return;
      setStatus('saving');
      try {
        await onSave(val);
        lastSavedRef.current = val;
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 1500);
      } catch (err: any) {
        setStatus('idle');
        toast({ title: 'Erro ao salvar', description: err?.message || 'Tente novamente', variant: 'destructive' });
      }
    }, 800);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => {
          const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
          setValue(v);
          triggerSave(v);
        }}
        placeholder={placeholder}
        className="h-8 text-xs font-mono pr-7"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        {status === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {status === 'saved' && <Check className="h-3.5 w-3.5 text-primary" />}
      </span>
    </div>
  );
}
