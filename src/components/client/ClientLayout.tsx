import { ReactNode, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Copy } from 'lucide-react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  User,
  LogOut,
  PenTool,
  Sun,
  Moon,
  ArrowLeft,
  Briefcase,
  Users as UsersIcon,
  Loader2,
  KeyRound,
  ChevronLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WhatsAppIcon } from '@/components/shared/WhatsAppIcon';
import { useToast } from '@/hooks/use-toast';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useClientPortalSettings } from '@/hooks/useClientPortalSettings';

interface ClientLayoutProps {
  children: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const { clientProfile, signOut, user: clientUser } = useClientAuth();
  const { profile: adminProfile, user: adminUser, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { settings } = useClientPortalSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const currentTheme = resolvedTheme ?? 'light';
  const toggleTheme = () => setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  const { toast } = useToast();

  // Resolve company / site context for branding
  const urlCompanyId = searchParams.get('company_id');
  const urlSiteId = searchParams.get('site_id');
  const effectiveCompanyId = urlCompanyId || clientProfile?.company_id || null;
  const currentUserId = clientUser?.id || adminUser?.id || null;

  // Fetch site/company branding through a secure resolver so collaborator
  // portal access still gets the unit/company logo even without URL params.
  const { data: branding } = useQuery({
    queryKey: ['client-portal-branding', currentUserId, effectiveCompanyId, urlSiteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('resolve_client_portal_branding', {
        p_company_id: effectiveCompanyId,
        p_site_id: urlSiteId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      return row || null;
    },
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 5,
  });

  const brandingLogo = branding?.logo_url || null;
  const brandingName = branding?.name || null;
  const resolvedCompanyId = branding?.company_id || effectiveCompanyId;
  const resolvedSiteId = branding?.site_id || urlSiteId;

  // Preserve query params (company_id, site_id, portal_user) across navigation.
  const contextualParams = new URLSearchParams(searchParams);
  if (!contextualParams.get('company_id') && resolvedCompanyId) contextualParams.set('company_id', resolvedCompanyId);
  if (!contextualParams.get('site_id') && resolvedSiteId) contextualParams.set('site_id', resolvedSiteId);
  if (!contextualParams.get('portal_user') && role === 'collaborator' && resolvedSiteId) {
    contextualParams.set('portal_user', 'collaborator');
  }
  const preservedSearch = contextualParams.toString() ? `?${contextualParams.toString()}` : '';


  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const [inviteOpen, setInviteOpen] = useState(false);
  const [unitContacts, setUnitContacts] = useState<Array<{ id: string; name: string; email: string; has_pin: boolean }>>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [pinByContact, setPinByContact] = useState<Record<string, string>>({});
  const [generatedInvite, setGeneratedInvite] = useState<{
    contactName: string;
    text: string;
  } | null>(null);

  const portalName = brandingName ? `Portal ${brandingName}` : 'Portal do Cliente';

  const loadUnitContacts = async () => {
    if (!resolvedCompanyId) return;
    setLoadingContacts(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_company_login_contacts', {
        p_company_id: resolvedCompanyId,
        p_site_id: resolvedSiteId,
      });
      if (error) throw error;
      setUnitContacts((data || []).map((c: any) => ({
        id: c.id, name: c.name, email: c.email, has_pin: !!c.has_pin,
      })));
    } catch (e: any) {
      toast({ title: 'Erro ao carregar contatos', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingContacts(false);
    }
  };

  const openInvite = () => {
    setGeneratedInvite(null);
    setInviteOpen(true);
    loadUnitContacts();
  };

  const generateInviteFor = async (contact: { id: string; name: string; email: string }) => {
    const pin = (pinByContact[contact.id] || '').trim();
    if (!/^\d{4}$/.test(pin)) {
      toast({ title: 'PIN obrigatório', description: 'Digite um PIN de 4 dígitos antes de gerar o convite.', variant: 'destructive' });
      return;
    }
    setGeneratingFor(contact.id);
    try {
      const { data, error } = await (supabase as any).functions.invoke('send-client-invitation', {
        body: {
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email,
          companyName: brandingName || '',
          companyId: resolvedCompanyId,
          pin,
        },
      });
      if (error) throw error;
      const creds = data?.credentials;
      if (!creds?.loginUrl || !creds?.pin) throw new Error('Resposta inválida do servidor.');
      const text =
`Olá ${contact.name}! 👋

A *Equipe WEES* preparou seu acesso ao *${portalName}*.

Através do portal você acompanha os *Diários de Obra (RDOs)*, fotos, andamento e pode *aprovar relatórios* da sua obra.

🔹 *Acesse:* ${creds.loginUrl}
📧 *E-mail:* ${creds.email}
🔐 *PIN de acesso:* ${creds.pin}

Faça login com seu e-mail e digite o PIN de 4 dígitos acima.

Atenciosamente,
*Equipe WEES* 🏗️`;
      setGeneratedInvite({ contactName: contact.name, text });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar convite', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleCopyInvite = async () => {
    if (!generatedInvite) return;
    try {
      await navigator.clipboard.writeText(generatedInvite.text);
      toast({ title: 'Texto copiado!', description: 'Cole no WhatsApp do cliente.' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  // Botão "Área WEES" só aparece para usuários internos da equipe (super_admin/admin)
  const isInternalUser =
    !clientProfile &&
    !!adminUser &&
    (role === 'super_admin' || role === 'admin');

  const navItems = [
    { href: `/client/dashboard${preservedSearch}`, label: settings.dashboard_title || 'Dashboard', icon: LayoutDashboard },
    { href: `/client/profile${preservedSearch}`, label: settings.profile_title || 'Meu Perfil', icon: User },
    ...(isInternalUser
      ? [{ href: `/client/users${preservedSearch}`, label: 'Membros da Unidade', icon: UsersIcon }]
      : []),
  ];

  const isActive = (path: string) => location.pathname === path.split('?')[0];

  // Apply custom portal colors via inline style
  const portalStyle: React.CSSProperties = {};
  if (settings.client_primary_color && settings.client_primary_color !== '#991919') {
    portalStyle['--portal-primary' as string] = settings.client_primary_color;
  }

  return (
    <div className="min-h-screen bg-background" style={portalStyle}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Voltar"
              title="Voltar para a página anterior"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Link to={`/client/dashboard${preservedSearch}`} className="flex items-center" aria-label={brandingName || 'Portal'}>
              {brandingLogo ? (
                <img
                  src={brandingLogo}
                  alt={brandingName || ''}
                  className="h-12 w-auto max-h-12 max-w-[180px] object-contain"
                />
              ) : brandingName ? (
                <span className="text-base font-semibold text-foreground truncate max-w-[180px]">
                  {brandingName}
                </span>
              ) : null}
            </Link>
            <div className="hidden md:flex items-center gap-1 ml-6">
              {navItems.map((item) => (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive(item.href) ? 'secondary' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isInternalUser && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInvite}
                  className="gap-2 text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/10 hover:text-[#25D366]"
                  title="Copiar texto de convite para WhatsApp"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Convite</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="gap-2"
                  title="Voltar para a área administrativa WEES"
                >
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Área WEES</span>
                </Button>
              </>
            )}
            {clientProfile?.signature_data && (
              <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                <PenTool className="h-4 w-4 text-primary" />
                <span>Assinatura ativa</span>
              </div>
            )}
            <div className="hidden md:block text-sm text-muted-foreground">
              {clientProfile?.name || adminProfile?.name}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              title={currentTheme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {currentTheme === 'dark' ? (
                <Sun className="h-[1.1rem] w-[1.1rem]" />
              ) : (
                <Moon className="h-[1.1rem] w-[1.1rem]" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                size="sm"
                className="flex flex-col gap-1 h-auto py-2"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </Button>
            </Link>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2"
            onClick={toggleTheme}
            aria-label="Alternar tema"
          >
            {currentTheme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            <span className="text-xs">Tema</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-auto py-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            <span className="text-xs">Sair</span>
          </Button>
        </div>
      </nav>

      {/* Footer */}
      {(settings.footer_text || settings.support_email || settings.support_phone) && (
        <footer className="hidden md:block border-t bg-muted/30 mt-auto">
          <div className="container px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{settings.footer_text}</span>
            <div className="flex gap-4">
              {settings.support_email && <span>{settings.support_email}</span>}
              {settings.support_phone && <span>{settings.support_phone}</span>}
            </div>
          </div>
        </footer>
      )}

      {/* Main Content */}
      <main className="container px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      {isInternalUser && (
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="max-w-lg">
            {!generatedInvite ? (
              <>
                <DialogHeader>
                  <DialogTitle>Gerar Convite para Cliente</DialogTitle>
                  <DialogDescription>
                    Selecione o cliente desta unidade para gerar o link de acesso e o PIN.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-2">
                  {loadingContacts ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                    </div>
                  ) : unitContacts.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Nenhum cliente cadastrado nesta unidade.
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setInviteOpen(false);
                            navigate(`/client/users${preservedSearch}`);
                          }}
                        >
                          <UsersIcon className="h-4 w-4 mr-2" /> Cadastrar cliente
                        </Button>
                      </div>
                    </div>
                  ) : (
                    unitContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-col gap-2 rounded-md border p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                            <div className="mt-1">
                              {c.has_pin ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  <KeyRound className="h-3 w-3 mr-1" /> PIN definido (digite para redefinir)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  Defina um PIN
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => generateInviteFor(c)}
                            disabled={generatingFor === c.id || !/^\d{4}$/.test(pinByContact[c.id] || '')}
                            className="gap-2 bg-[#25D366] hover:bg-[#1eb955] text-white shrink-0"
                          >
                            {generatingFor === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <WhatsAppIcon className="h-4 w-4" />
                            )}
                            Gerar
                          </Button>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d{4}"
                          maxLength={4}
                          placeholder="PIN de 4 dígitos"
                          value={pinByContact[c.id] || ''}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setPinByContact((prev) => ({ ...prev, [c.id]: v }));
                          }}
                          className="w-full h-9 rounded-md border bg-background px-3 text-sm tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    ))
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInviteOpen(false);
                      navigate(`/client/users${preservedSearch}`);
                    }}
                    className="gap-2"
                  >
                    <UsersIcon className="h-4 w-4" /> Gerenciar clientes
                  </Button>
                  <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                    Fechar
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Convite para {generatedInvite.contactName}</DialogTitle>
                  <DialogDescription>
                    Copie o texto abaixo e envie no WhatsApp do cliente. O link e o PIN são reais e prontos para uso.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  readOnly
                  value={generatedInvite.text}
                  rows={14}
                  className="font-mono text-sm resize-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setGeneratedInvite(null)}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" /> Voltar
                  </Button>
                  <Button
                    onClick={handleCopyInvite}
                    className="gap-2 bg-[#25D366] hover:bg-[#1eb955] text-white"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar texto
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
