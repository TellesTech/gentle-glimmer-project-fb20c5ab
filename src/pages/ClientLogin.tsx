import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { validatePinWithRetry, isValidatePinFailure } from '@/lib/validatePin';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, ArrowLeft, ArrowRight, KeyRound, User, Building2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { isReservedSlug } from '@/lib/reservedSlugs';


interface CompanyInfo {
  id: string;
  name: string;
  logo_url: string | null;
  photo_url: string | null;
}

interface PortalSettings {
  client_primary_color: string | null;
  client_accent_color: string | null;
  client_logo_url: string | null;
  login_welcome_text: string | null;
  welcome_title: string | null;
}

interface CompanyStats {
  totalReports: number;
  totalSignatures: number;
  activeProjects: number;
}

interface ContactInfo {
  id: string;
  name: string;
  email: string;
  role: string | null;
  avatar_url: string | null;
  has_pin: boolean;
  has_auth: boolean;
}

interface CollaboratorInfo {
  id: string;
  name: string;
  avatar_url: string | null;
  job_title: string | null;
}

interface SiteWithCollaborator {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  photo_url: string | null;
  portal_collaborator_id: string | null;
}

type SiteInfo = SiteWithCollaborator;

type LoginMode = 'select' | 'pin' | 'email';

export default function ClientLogin() {
  const { slug, siteId, contactId } = useParams<{ slug: string; siteId?: string; contactId?: string }>();
  const navigate = useNavigate();
  const { settings: systemSettings } = useSystemSettings();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [collaborator, setCollaborator] = useState<CollaboratorInfo | null>(null);
  const [sites, setSites] = useState<SiteWithCollaborator[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteInfo | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats>({ totalReports: 0, totalSignatures: 0, activeProjects: 0 });
  const [mode, setMode] = useState<LoginMode>('select');
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Direct link contact data
  const [directContact, setDirectContact] = useState<ContactInfo | null>(null);

  useEffect(() => {
    if (slug) loadCompanyData(slug);
  }, [slug, siteId, contactId]);

  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  const loadCompanyData = async (slugOrId: string) => {
    setLoading(true);
    try {
      // Slugs reservados pertencem ao app interno — não tratar como portal do cliente.
      if (!isUUID(slugOrId) && isReservedSlug(slugOrId)) {
        navigate('/login', { replace: true });
        return;
      }

      let companyId = slugOrId;

      if (!isUUID(slugOrId)) {
        const { data: resolvedId } = await supabase.rpc('resolve_company_slug', { p_slug: slugOrId });
        if (!resolvedId) {
          toast({ title: 'Empresa não encontrada', variant: 'destructive' });
          navigate('/login');
          return;
        }
        companyId = resolvedId;
      }

      const { data: companyData } = await supabase.rpc('get_company_public_info', { p_company_id: companyId });
      if (!companyData || (companyData as any[]).length === 0) {
        toast({ title: 'Empresa não encontrada', variant: 'destructive' });
        navigate('/login');
        return;
      }
      const comp = (companyData as any[])[0];
      setCompany(comp);

      const { data: settingsData } = await supabase.rpc('get_company_portal_settings', { p_company_id: companyId });
      if (settingsData && (settingsData as any[]).length > 0) {
        setSettings((settingsData as any[])[0]);
      }

      // If direct link with contactId, load contact data and skip the rest
      if (contactId) {
        const { data: contactsData } = await supabase.rpc('get_company_login_contacts', { p_company_id: companyId });
        const allContacts = (contactsData as ContactInfo[]) || [];
        const found = allContacts.find(c => c.id === contactId);
        if (found) {
          setDirectContact(found);
          setSelectedContact(found);
          setMode('pin');
        } else {
          toast({ title: 'Contato não encontrado', variant: 'destructive' });
        }
        setLoading(false);
        return;
      }

      // Load sites (with portal_collaborator_id)
      const { data: sitesRaw } = await supabase
        .from('sites')
        .select('id, name, city, state, photo_url, portal_collaborator_id')
        .eq('company_id', companyId)
        .order('name');
      const loadedSites = (sitesRaw as SiteWithCollaborator[]) || [];
      setSites(loadedSites);

      let resolvedSiteId: string | null = null;
      if (siteId) {
        if (isUUID(siteId)) {
          resolvedSiteId = siteId;
        } else {
          const matchedSite = loadedSites.find(s => (s as any).slug === siteId.toLowerCase());
          if (matchedSite) {
            resolvedSiteId = matchedSite.id;
          } else {
            const { data: resolvedSite } = await supabase.rpc('resolve_site_slug', { p_company_id: companyId, p_slug: siteId });
            if (resolvedSite) resolvedSiteId = resolvedSite as string;
          }
        }
        if (resolvedSiteId && isUUID(resolvedSiteId)) {
          const site = loadedSites.find(s => s.id === resolvedSiteId);
          setSelectedSite(site || null);
          const { data: contactsData } = await supabase.rpc('get_company_login_contacts', { p_company_id: companyId, p_site_id: resolvedSiteId });
          setContacts((contactsData as ContactInfo[]) || []);
          // Load single portal collaborator
          if (site?.portal_collaborator_id) {
            const { data: collabData } = await supabase
              .rpc('get_portal_collaborator', { p_profile_id: site.portal_collaborator_id })
              .maybeSingle();
            setCollaborator(collabData as CollaboratorInfo | null);
          } else {
            setCollaborator(null);
          }
        } else {
          resolvedSiteId = null;
          const { data: contactsData } = await supabase.rpc('get_company_login_contacts', { p_company_id: companyId });
          setContacts((contactsData as ContactInfo[]) || []);
        }
      } else {
        if (loadedSites.length > 0) {
          setContacts([]);
        } else {
          const { data: contactsData } = await supabase.rpc('get_company_login_contacts', { p_company_id: companyId });
          setContacts((contactsData as ContactInfo[]) || []);
        }
      }

      const { data: statsData } = (resolvedSiteId && isUUID(resolvedSiteId))
        ? await supabase.rpc('get_site_login_stats', { p_site_id: resolvedSiteId })
        : await supabase.rpc('get_company_login_stats', { p_company_id: companyId });
      if (statsData) {
        const s = statsData as unknown as CompanyStats;
        setCompanyStats({
          totalReports: s.totalReports || 0,
          totalSignatures: s.totalSignatures || 0,
          activeProjects: s.activeProjects || 0,
        });
      }
    } catch (err: any) {
      console.error('Error loading company data:', err);
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contact: ContactInfo) => {
    if (!contact.has_auth && !contact.has_pin) {
      toast({ title: 'Convite pendente', description: 'Este contato ainda não recebeu o convite de acesso. Solicite ao administrador.', variant: 'destructive' });
      return;
    }
    setSelectedContact(contact);
    if (contact.has_pin) {
      setMode('pin');
      setPin('');
    } else {
      setMode('email');
      setEmail(contact.email);
    }
  };

  const handlePinLogin = async () => {
    if (!selectedContact || pin.length !== 4) return;
    setSubmitting(true);
    try {
      const data = await validatePinWithRetry({ email: selectedContact.email, pin });
      if (isValidatePinFailure(data)) throw new Error(data.error || 'PIN inválido');

      if (data?.token_hash) {
        const { error: otpError } = await (supabase as any).auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink'
        });
        if (otpError) throw otpError;
        navigate('/client/dashboard');
      }
    } catch (err: any) {
      toast({ title: 'PIN inválido', description: err.message, variant: 'destructive' });
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/client/dashboard');
    } catch (err: any) {
      toast({ title: 'Erro no login', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const getDisplayName = (fullName: string) => {
    const parts = fullName.split(' ');
    const preps = ['de', 'da', 'do', 'dos', 'das'];
    if (parts.length === 1) return parts[0];
    if (parts.length >= 3 && preps.includes(parts[1].toLowerCase())) return parts.slice(0, 3).join(' ');
    return parts.slice(0, 2).join(' ');
  };

  const primaryColor = settings?.client_primary_color || '#991919';
  const logoUrl = settings?.client_logo_url || company?.logo_url || company?.photo_url;
  const welcomeText = settings?.login_welcome_text || 'Acesse o portal da sua empresa';

  // Login is per UNIT (site), not per company. Always require a site selection
  // when the company has any sites and the URL doesn't include one.
  const showSiteSelection = !siteId && !contactId && sites.length > 0;
  const hasConfiguredContacts = contacts.some(c => c.has_pin || c.has_auth);

  // Default to email login only when a site is already selected (or there are no sites)
  // and the selected scope has no PIN/auth contacts configured.
  useEffect(() => {
    if (
      !loading &&
      !showSiteSelection &&
      !hasConfiguredContacts &&
      contacts.length === 0 &&
      mode === 'select'
    ) {
      setMode('email');
    }
  }, [loading, showSiteSelection, hasConfiguredContacts, contacts.length, mode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Empresa não encontrada</p>
      </div>
    );
  }

  // ===== DIRECT LINK VIEW (contactId present) =====
  if (contactId && directContact) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* Company Logo */}
          {logoUrl ? (
            <img src={logoUrl} alt={company.name} className="h-24 object-contain" />
          ) : (
            <div className="h-20 w-20 rounded-2xl flex items-center justify-center bg-primary/10">
              <span className="text-4xl font-bold text-primary">
                {company.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Contact Card */}
          <Card className="w-full border-0 shadow-xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5">
              {/* Avatar */}
              <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                {directContact.avatar_url ? (
                  <AvatarImage src={directContact.avatar_url} alt={directContact.name} />
                ) : null}
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {getInitials(directContact.name)}
                </AvatarFallback>
              </Avatar>

              {/* Name & Role */}
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-foreground">{directContact.name}</h2>
                {directContact.role && (
                  <p className="text-sm text-muted-foreground">{directContact.role}</p>
                )}
              </div>

              {/* PIN Input */}
              <div className="flex flex-col items-center gap-3 w-full mt-2">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Digite aqui o PIN de 4 dígitos enviado no seu convite
                </p>
                <div className="rounded-xl bg-red-50 border-2 border-dashed border-red-400 p-3 shadow-inner">
                  <InputOTP maxLength={4} value={pin} onChange={setPin} onComplete={handlePinLogin}>
                    <InputOTPGroup className="gap-3">
                      {[0,1,2,3].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-16 w-14 text-2xl font-bold !text-red-700 !border-2 !border-red-600 first:!border-l rounded-lg !bg-white shadow-md focus-within:!ring-4 focus-within:!ring-red-300"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  className="w-full mt-2"
                  size="lg"
                  onClick={handlePinLogin}
                  disabled={pin.length !== 4 || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Entrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===== STANDARD FLOW (no contactId) =====
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-accent p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative z-10">
          {(systemSettings?.login_logo_url || systemSettings?.logo_url) ? (
            <img src={systemSettings?.login_logo_url || systemSettings?.logo_url || ''} alt={systemSettings?.system_name || 'Sistema'} className="h-12 object-contain" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-foreground">
                  {(systemSettings?.system_name || 'RDO').charAt(0)}
                </span>
              </div>
              <div>
                <span className="text-2xl font-bold text-primary-foreground">{systemSettings?.system_name || 'Sistema RDO'}</span>
                <p className="text-sm text-primary-foreground/80">{systemSettings?.system_subtitle || 'Gestão de Atividades'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl xl:text-5xl font-bold text-primary-foreground leading-tight">
            {settings?.welcome_title || `Portal ${company.name}`}
          </h1>
          <p className="text-xl text-primary-foreground/80 max-w-md">
            {welcomeText}
          </p>
          {selectedSite && (
            <div className="flex items-center gap-2 text-primary-foreground/90 bg-primary-foreground/10 rounded-lg px-4 py-2 w-fit">
              <MapPin className="h-4 w-4" />
              <span className="font-medium">{selectedSite.name}</span>
              {selectedSite.city && <span className="text-primary-foreground/60">• {selectedSite.city}{selectedSite.state ? `/${selectedSite.state}` : ''}</span>}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary-foreground">
                {companyStats.totalReports}+
              </span>
              <span className="text-primary-foreground/70 text-sm">Relatórios</span>
            </div>
            <div className="w-px bg-primary-foreground/20" />
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary-foreground">
                {companyStats.totalSignatures}
              </span>
              <span className="text-primary-foreground/70 text-sm">Assinaturas</span>
            </div>
            <div className="w-px bg-primary-foreground/20" />
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary-foreground">
                {companyStats.activeProjects}
              </span>
              <span className="text-primary-foreground/70 text-sm">Atividades</span>
            </div>
          </div>

          {/* Portal Collaborator Profile */}
          {collaborator && (
            <button
              onClick={() => navigate(`/client/dashboard?company_id=${company?.id}${selectedSite?.id ? `&site_id=${selectedSite.id}` : ''}&portal_user=collaborator`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors group cursor-pointer"
            >
              <Avatar className="h-10 w-10 border border-primary-foreground/20">
                <AvatarImage src={collaborator.avatar_url || ''} alt={collaborator.name} />
                <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground font-bold text-xs">{getInitials(collaborator.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-primary-foreground text-sm truncate">{getDisplayName(collaborator.name)}</p>
                <p className="text-xs text-primary-foreground/60 truncate">
                  {collaborator.job_title ? `${collaborator.job_title} · ` : ''}WEES
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary-foreground/50 group-hover:text-primary-foreground transition-colors" />
            </button>
          )}
        </div>

        <div className="relative z-10 text-primary-foreground/60 text-sm">
          Portal do Cliente
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-4">
          {/* Mobile Logo + Stats */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-0">
            {logoUrl ? (
              <img src={logoUrl} alt={company.name} className="h-28 object-contain" />
            ) : (
              <div className="h-16 w-16 rounded-xl flex items-center justify-center bg-primary/10">
                <span className="text-3xl font-bold text-primary">
                  {company.name.charAt(0)}
                </span>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground text-center">{welcomeText}</p>
            {selectedSite && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
                <MapPin className="h-3 w-3" />
                <span className="font-medium">{selectedSite.name}</span>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{companyStats.totalReports}+</p>
                <p className="text-muted-foreground">Relatórios</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{companyStats.totalSignatures}</p>
                <p className="text-muted-foreground">Assinaturas</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{companyStats.activeProjects}</p>
                <p className="text-muted-foreground">Atividades</p>
              </div>
            </div>

            {/* Mobile - Portal Collaborator */}
            {collaborator && (
              <button
                onClick={() => navigate(`/client/dashboard?company_id=${company?.id}${selectedSite?.id ? `&site_id=${selectedSite.id}` : ''}&portal_user=collaborator`)}
                className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 w-full max-w-xs hover:bg-primary/10 transition-colors group cursor-pointer"
              >
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                  {collaborator.avatar_url ? <AvatarImage src={collaborator.avatar_url} alt={collaborator.name} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{getInitials(collaborator.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-sm truncate">{getDisplayName(collaborator.name)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {collaborator.job_title ? `${collaborator.job_title} · ` : ''}
                    <span className="font-bold tracking-wide text-primary">WEES</span>
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            )}
          </div>

          {/* Desktop - Company Logo above card */}
          <div className="hidden lg:flex flex-col items-center gap-0">
            {logoUrl ? (
              <img src={logoUrl} alt={company.name} className="h-32 object-contain" />
            ) : (
              <div className="h-16 w-16 rounded-xl flex items-center justify-center bg-primary/10">
                <span className="text-3xl font-bold text-primary">
                  {company.name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Site Selection Screen */}
          {showSiteSelection ? (
            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold">Selecione a Unidade</CardTitle>
                <CardDescription>
                  Escolha a unidade para acessar o portal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sites.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => navigate(`/${slug}/${site.id}`)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                  >
                    {site.photo_url ? (
                      <img src={site.photo_url} alt={site.name} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                        <Building2 className="h-6 w-6" style={{ color: primaryColor }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{site.name}</p>
                      {(site.city || site.state) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {[site.city, site.state].filter(Boolean).join(' / ')}
                        </p>
                      )}
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground text-center w-full">
                  O acesso ao portal é feito por unidade. Selecione a unidade desejada acima para continuar.
                </p>
              </CardFooter>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg">
              {mode === 'select' && (
                <>
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold">Acesso Rápido</CardTitle>
                    <CardDescription>Clique no seu nome abaixo e insira o PIN de 4 dígitos recebido por convite</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {contacts.filter(c => c.has_pin || c.has_auth).map((contact) => (
                      <Button
                        key={contact.id}
                        variant="outline"
                        className="w-full justify-start gap-3 h-auto py-3 px-4"
                        onClick={() => handleContactSelect(contact)}
                      >
                        <Avatar className="h-10 w-10">
                          {contact.avatar_url ? <AvatarImage src={contact.avatar_url} alt={contact.name} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(contact.name)}</AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="font-medium">{getDisplayName(contact.name)}</p>
                          {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                        </div>
                        {contact.has_pin ? <KeyRound className="h-4 w-4 ml-auto text-muted-foreground" /> : <Mail className="h-4 w-4 ml-auto text-muted-foreground" />}
                      </Button>
                     ))}

                   </CardContent>
                  <CardFooter className="flex flex-col gap-2 pt-2">
                    <div className="relative w-full">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
                    </div>
                    <Button variant="ghost" className="w-full" onClick={() => setMode('email')}>
                      <Mail className="h-4 w-4 mr-2" /> Prefere usar email e senha? Clique aqui
                    </Button>
                  </CardFooter>
                </>
              )}

              {mode === 'pin' && selectedContact && (
                <>
                  <CardHeader className="space-y-1 pb-4">
                    <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-2" onClick={() => { setMode('select'); setSelectedContact(null); setPin(''); }}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="h-16 w-16">
                        {selectedContact.avatar_url ? <AvatarImage src={selectedContact.avatar_url} alt={selectedContact.name} /> : null}
                        <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">{getInitials(selectedContact.name)}</AvatarFallback>
                      </Avatar>
                      <div className="text-center">
                        <CardTitle className="text-xl">{getDisplayName(selectedContact.name)}</CardTitle>
                        <CardDescription>Insira o PIN de 4 dígitos enviado no seu convite</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Digite aqui o PIN de 4 dígitos
                    </p>
                    <div className="rounded-xl bg-red-50 border-2 border-dashed border-red-400 p-3 shadow-inner">
                      <InputOTP maxLength={4} value={pin} onChange={setPin} onComplete={handlePinLogin}>
                        <InputOTPGroup className="gap-3">
                          {[0,1,2,3].map((i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="h-16 w-14 text-2xl font-bold !text-red-700 !border-2 !border-red-600 first:!border-l rounded-lg !bg-white shadow-md focus-within:!ring-4 focus-within:!ring-red-300"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <Button className="w-full" onClick={handlePinLogin} disabled={pin.length !== 4 || submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                      Entrar
                    </Button>
                  </CardContent>
                </>
              )}

              {mode === 'email' && (
                <>
                  <CardHeader className="space-y-1 pb-4">
                    {contacts.length > 0 && (
                      <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-2" onClick={() => { setMode('select'); setEmail(''); setPassword(''); }}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                      </Button>
                    )}
                    <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
                    <CardDescription>Use seu email e senha para acessar</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <Button className="w-full" onClick={handleEmailLogin} disabled={!email || !password || submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Entrar
                    </Button>
                  </CardContent>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
