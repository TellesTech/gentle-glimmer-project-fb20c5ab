import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, UserCheck, UserX, Mail, Link2, Copy, Check, KeyRound, Save, X, MapPin, Eye, ShieldCheck, ShieldX, Pencil, Building2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validatePinWithRetry, isValidatePinFailure } from '@/lib/validatePin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users } from 'lucide-react';

interface Contact {
  id: string;
  company_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  can_approve: boolean;
  is_active: boolean;
  signature_data: string | null;
  user_id: string | null;
  invitation_sent_at: string | null;
  invitation_count: number | null;
  avatar_url: string | null;
  pin_hash: string | null;
  created_at: string;
}

interface Site {
  id: string;
  name: string;
  company_id?: string;
  companyName?: string | null;
}

interface GeneratedCredentials {
  contactName: string;
  email: string;
  password: string;
  loginUrl: string;
  pin: string;
}

interface EditingState {
  [contactId: string]: {
    name: string;
    email: string;
    phone: string;
    role: string;
    pin: string;
    avatar_url: string;
    can_approve: boolean;
    is_active: boolean;
    siteIds: string[];
    dirty: boolean;
  };
}

interface ClientContactsSectionProps {
  companyId: string;
  companyName: string;
  companySlug?: string;
  contactSiteSlugs?: Record<string, string>;
  companies?: { id: string; name: string; logo_url: string | null; slug: string | null }[];
  companySites?: Record<string, { id: string; name: string; slug: string | null; city: string | null; state: string | null }[]>;
  selectedCompanyId?: string;
  onCompanyChange?: (id: string) => void;
  selectedSiteId?: string;
  onSiteChange?: (id: string) => void;
  onOpenPortal?: (companyId: string, siteId?: string) => void;
  /** When provided, the component renders ONLY contacts of this site, hides headers/wrappers, and pre-assigns new contacts to this site. */
  siteId?: string;
  /** Optional name for the unit, used in empty states when siteId is set. */
  siteName?: string;
  /** When true (used with siteId inside a Dialog), hides the internal header row entirely. */
  embedded?: boolean;
}

export function ClientContactsSection({ companyId, companyName, companySlug, contactSiteSlugs, companies, companySites, selectedCompanyId, onCompanyChange, selectedSiteId, onSiteChange, onOpenPortal, siteId, siteName, embedded }: ClientContactsSectionProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contactSiteMap, setContactSiteMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>({});
  const pinsStorageKey = `client_contact_pins_v1::${companyId || 'none'}`;
  const [savedPins, setSavedPins] = useState<Record<string, string>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(pinsStorageKey) : null;
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(pinsStorageKey, JSON.stringify(savedPins));
      }
    } catch {}
  }, [savedPins, pinsStorageKey]);
  const [inlinePin, setInlinePin] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', role: '', pin: '', avatar_url: '', can_approve: true, is_active: true, siteIds: [] as string[] });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [credentialsDialog, setCredentialsDialog] = useState<{ open: boolean; credentials: GeneratedCredentials | null }>({ open: false, credentials: null });
  const [copied, setCopied] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState<string | null>(null);
  const [verifyPinInput, setVerifyPinInput] = useState<Record<string, string>>({});
  const [verifyResult, setVerifyResult] = useState<Record<string, 'ok' | 'fail' | null>>({});

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [contactsRes, sitesRes] = await Promise.all([
        supabase.from('company_contacts').select('*').eq('company_id', companyId).order('name'),
        supabase.from('sites').select('id, name, company_id, companies(name)').eq('company_id', companyId).order('name'),
      ]);
      if (contactsRes.error) throw contactsRes.error;
      if (sitesRes.error) throw sitesRes.error;

      const contactsList = contactsRes.data || [];
      setContacts(contactsList);

      const companySites: Site[] = (sitesRes.data || []).map((s: any) => ({
        id: s.id, name: s.name, company_id: s.company_id, companyName: null,
      }));

      // Fetch contact_sites
      let map: Record<string, string[]> = {};
      if (contactsList.length > 0) {
        const contactIds = contactsList.map(c => c.id);
        const { data: csData } = await supabase
          .from('contact_sites')
          .select('contact_id, site_id')
          .in('contact_id', contactIds);
        (csData || []).forEach(cs => {
          if (!map[cs.contact_id]) map[cs.contact_id] = [];
          map[cs.contact_id].push(cs.site_id);
        });

        // Find site IDs from other companies
        const companySiteIds = new Set(companySites.map(s => s.id));
        const otherSiteIds = [...new Set((csData || []).map(cs => cs.site_id).filter(id => !companySiteIds.has(id)))];

        if (otherSiteIds.length > 0) {
          const { data: otherSites } = await supabase
            .from('sites')
            .select('id, name, company_id, companies(name)')
            .in('id', otherSiteIds);
          if (otherSites) {
            otherSites.forEach((s: any) => {
              companySites.push({
                id: s.id,
                name: s.name,
                company_id: s.company_id,
                companyName: (s.companies as any)?.name || null,
              });
            });
          }
        }
      }

      setSites(companySites);
      setContactSiteMap(map);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar contatos', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId, fetchData]);

  // Pre-assign siteId when in single-site mode and starting create
  useEffect(() => {
    if (siteId && isCreating && newContact.siteIds[0] !== siteId) {
      setNewContact(p => ({ ...p, siteIds: [siteId] }));
    }
  }, [siteId, isCreating]);

  const startEditing = (contact: Contact) => {
    setEditing(prev => ({
      ...prev,
      [contact.id]: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone || '',
        role: contact.role || '',
        pin: savedPins[contact.id] || '',
        avatar_url: contact.avatar_url || '',
        can_approve: contact.can_approve,
        is_active: contact.is_active,
        siteIds: contactSiteMap[contact.id] || [],
        dirty: false,
      }
    }));
  };

  const cancelEditing = (contactId: string) => {
    setEditing(prev => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
  };

  const updateField = (contactId: string, field: string, value: any) => {
    setEditing(prev => ({
      ...prev,
      [contactId]: { ...prev[contactId], [field]: value, dirty: true }
    }));
  };

  const selectSite = (contactId: string, siteId: string) => {
    setEditing(prev => ({
      ...prev,
      [contactId]: { ...prev[contactId], siteIds: [siteId], dirty: true },
    }));
  };

  const saveContact = async (contactId: string) => {
    const data = editing[contactId];
    if (!data || !data.name || !data.email) {
      toast({ title: 'Erro', description: 'Nome e email são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(contactId);
    try {
      // Handle PIN
      let pinHashValue = undefined;
      if (data.pin && data.pin.length === 4) {
        const contact = contacts.find(c => c.id === contactId);
        const { data: pinData } = await supabase.functions.invoke('set-pin', {
          body: { pin: data.pin, contactId: contactId }
        });
        pinHashValue = pinData?.pin_hash;
      }

      const updatePayload: any = {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        role: data.role || null,
        can_approve: data.can_approve,
        is_active: data.is_active,
        avatar_url: data.avatar_url || null,
      };
      const { error } = await supabase.from('company_contacts').update(updatePayload).eq('id', contactId);
      if (error) throw error;

      // Sync contact_sites
      const oldSiteIds = contactSiteMap[contactId] || [];
      const newSiteIds = data.siteIds;
      const toDelete = oldSiteIds.filter(id => !newSiteIds.includes(id));
      const toInsert = newSiteIds.filter(id => !oldSiteIds.includes(id));

      if (toDelete.length > 0) {
        await supabase.from('contact_sites').delete().eq('contact_id', contactId).in('site_id', toDelete);
      }
      if (toInsert.length > 0) {
        await supabase.from('contact_sites').insert(toInsert.map(siteId => ({ contact_id: contactId, site_id: siteId })));
      }

      // Preserve the PIN in savedPins so it's available for "Gerar Convite"
      if (data.pin && data.pin.length === 4) {
        setSavedPins(prev => ({ ...prev, [contactId]: data.pin }));
      }
      toast({ title: 'Contato atualizado', description: data.pin && data.pin.length === 4 ? `PIN configurado: ${data.pin}` : undefined });
      cancelEditing(contactId);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleCreate = async () => {
    if (!newContact.name || !newContact.email) {
      toast({ title: 'Erro', description: 'Nome e email são obrigatórios', variant: 'destructive' });
      return;
    }
    if (sites.length > 0 && newContact.siteIds.length === 0) {
      toast({ title: 'Selecione uma unidade', description: 'O cliente precisa estar vinculado a uma unidade para acessar o portal', variant: 'destructive' });
      return;
    }
    if (!newContact.pin || newContact.pin.length !== 4) {
      toast({ title: 'PIN obrigatório', description: 'Defina um PIN de 4 dígitos para o cliente', variant: 'destructive' });
      return;
    }
    setSaving('new');
    try {
      // Provisionar contato + auth user via edge function (cria user_id em auth.users)
      const { data, error } = await supabase.functions.invoke('register-client-contact', {
        body: {
          companyId,
          siteId: newContact.siteIds[0] || null,
          name: newContact.name,
          email: newContact.email,
          pin: newContact.pin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const contactId = data?.contactId;
      if (contactId) {
        // Atualizar campos não cobertos pela edge function
        await supabase.from('company_contacts').update({
          phone: newContact.phone || null,
          role: newContact.role || null,
          avatar_url: newContact.avatar_url || null,
          is_active: newContact.is_active,
          can_approve: newContact.can_approve,
        }).eq('id', contactId);

        // Vincular sites adicionais (se mais de um foi selecionado)
        if (newContact.siteIds.length > 1) {
          await supabase.from('contact_sites').upsert(
            newContact.siteIds.slice(1).map(siteId => ({ contact_id: contactId, site_id: siteId })),
            { onConflict: 'contact_id,site_id' }
          );
        }
      }

      // Preserve PIN para que apareça visível no card e no botão "Convite"
      if (contactId && newContact.pin && newContact.pin.length === 4) {
        setSavedPins(prev => ({ ...prev, [contactId]: newContact.pin }));
      }

      toast({ title: 'Contato adicionado', description: `PIN configurado: ${newContact.pin}` });
      setIsCreating(false);
      setNewContact({ name: '', email: '', phone: '', role: '', pin: '', avatar_url: '', can_approve: true, is_active: true, siteIds: [] });
      fetchData();
    } catch (error: any) {
      const msg = error?.message?.includes('duplicate') || error?.message?.includes('already')
        ? 'Já existe um contato com este email nesta empresa'
        : (error?.message || 'Erro ao criar contato');
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.contact) return;
    setSaving(deleteConfirm.contact.id);
    try {
      const { error } = await supabase.from('company_contacts').delete().eq('id', deleteConfirm.contact.id);
      if (error) throw error;
      toast({ title: 'Contato removido' });
      setDeleteConfirm({ open: false, contact: null });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleGenerateInvite = async (contact: Contact) => {
    // Check savedPins first, then inlinePin, then editing state
    const pinToPass = savedPins[contact.id] || inlinePin[contact.id] || editing[contact.id]?.pin;
    if (!pinToPass || !/^\d{4}$/.test(pinToPass)) {
      toast({ title: 'PIN obrigatório', description: 'Digite o PIN de 4 dígitos do contato', variant: 'destructive' });
      return;
    }
    setGeneratingInvite(contact.id);
    try {
      // If PIN comes from inlinePin (not from savedPins), sync hash in DB first
      const isFromInline = !savedPins[contact.id] && inlinePin[contact.id];
      if (isFromInline) {
        const { error: pinError } = await supabase.functions.invoke('set-pin', {
          body: { pin: pinToPass, contactId: contact.id }
        });
        if (pinError) throw pinError;
        setSavedPins(prev => ({ ...prev, [contact.id]: pinToPass }));
      }

      const { data, error } = await supabase.functions.invoke('send-client-invitation', {
        body: { 
          contactId: contact.id, 
          contactName: contact.name, 
          contactEmail: contact.email, 
          companyName, 
          companyId,
          pin: pinToPass,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.credentials) {
        setCredentialsDialog({
          open: true,
          credentials: { contactName: contact.name, email: data.credentials.email, password: data.credentials.password, loginUrl: data.credentials.loginUrl, pin: data.credentials.pin || '' },
        });
      }
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro ao gerar convite', description: error.message, variant: 'destructive' });
    } finally {
      setGeneratingInvite(null);
    }
  };

  const getWhatsAppMessage = () => {
    if (!credentialsDialog.credentials) return '';
    const { contactName, pin, loginUrl } = credentialsDialog.credentials;
    return `Olá, *${contactName}*! 👋

A *Equipe WEES* preparou seu acesso ao *Portal ${companyName}*.

Através dele, você poderá acompanhar os *Diários de Obra (RDOs)*, visualizar o andamento das atividades, fotos e aprovar relatórios da sua obra.

🔐 *Seu PIN de acesso:* ${pin}
🔹 *Acesse aqui:* ${loginUrl}

Abra o link acima, selecione seu perfil e digite o PIN informado para entrar no portal.

Atenciosamente,
*Equipe WEES* 🏗️`;
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(getWhatsAppMessage());
      setCopied(true);
      toast({ title: 'Copiado!', description: 'Mensagem copiada para a área de transferência' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const formatInvitationStatus = (contact: Contact) => {
    if (contact.invitation_sent_at) {
      const date = format(new Date(contact.invitation_sent_at), "dd/MM/yyyy", { locale: ptBR });
      const count = contact.invitation_count || 1;
      return { sent: true, text: `Enviado em ${date}`, count };
    }
    return { sent: false, text: 'Não enviado', count: 0 };
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const renderContactCard = (contact: Contact) => {
    const isEditing = !!editing[contact.id];
    const ed = editing[contact.id];
    const inviteStatus = formatInvitationStatus(contact);
    const isGenerating = generatingInvite === contact.id;
    const isSaving = saving === contact.id;
    const assignedSites = contactSiteMap[contact.id] || [];

    return (
      <Card key={contact.id} className={`transition-all overflow-hidden relative ${isEditing ? 'ring-2 ring-primary/30' : 'hover:shadow-md'}`}>
        <CardContent className="p-5 space-y-0 min-h-[160px]">
          {/* === Top-right action buttons (absolute) === */}
          <div className="absolute top-2 right-2 flex items-center gap-0.5 z-10">
            {isEditing ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelEditing(contact.id)} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(contact)}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ open: true, contact })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          {/* === HEADER VERTICAL: Avatar centralizado, nome e email em largura total === */}
          <div className="flex flex-col items-center text-center pt-2 pb-3">
            <AvatarUpload
              currentUrl={isEditing ? ed.avatar_url : contact.avatar_url}
              name={contact.name}
              size="md"
              onUpload={async (url) => {
                if (isEditing) {
                  updateField(contact.id, 'avatar_url', url);
                } else {
                  await supabase.from('company_contacts').update({ avatar_url: url }).eq('id', contact.id);
                  setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, avatar_url: url } : c));
                  toast({ title: 'Foto atualizada' });
                }
              }}
            />
            <div className="w-full mt-3 space-y-1.5">
              {isEditing ? (
                <Input value={ed.name} onChange={e => updateField(contact.id, 'name', e.target.value)} className="h-9 text-sm font-semibold text-center" placeholder="Nome completo" />
              ) : (
                <span className="font-semibold text-sm block break-words leading-tight">{contact.name}</span>
              )}
              {isEditing ? (
                <Input value={ed.email} onChange={e => updateField(contact.id, 'email', e.target.value)} className="h-9 text-sm text-center" placeholder="Email" type="email" />
              ) : (
                <p className="text-xs text-muted-foreground break-all leading-tight">{contact.email}</p>
              )}
              {!isEditing && contact.role && (
                <p className="text-[11px] text-muted-foreground/70 break-words">{contact.role}</p>
              )}
            </div>
          </div>

          {/* === EDITING FIELDS === */}
          {isEditing && (
            <div className="space-y-3 pt-3 border-t">
              <div>
                <Label className="text-xs text-muted-foreground">Cargo</Label>
                <Input value={ed.role} onChange={e => updateField(contact.id, 'role', e.target.value)} className="h-9 text-sm" placeholder="Ex: Engenheiro de Obras" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <PhoneInput value={ed.phone} onChange={v => updateField(contact.id, 'phone', v)} className="h-9 text-sm" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">PIN (4 dígitos)</Label>
                <Input
                  type="text" inputMode="numeric" maxLength={4}
                  value={ed.pin}
                  onChange={e => updateField(contact.id, 'pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="h-9 text-sm tracking-widest"
                  placeholder={contact.pin_hash ? '••••' : 'Definir PIN'}
                />
              </div>
              {sites.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3" /> Unidade
                  </Label>
                  <RadioGroup
                    value={ed.siteIds[0] || ''}
                    onValueChange={(v) => selectSite(contact.id, v)}
                    className="space-y-1 max-h-32 overflow-y-auto"
                  >
                    {sites.map(site => (
                      <label key={site.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-1">
                        <RadioGroupItem value={site.id} />
                        <span className="break-words">{site.name}{site.companyName ? ` (${site.companyName})` : ''}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm pt-1">
                <Switch checked={ed.is_active} onCheckedChange={v => updateField(contact.id, 'is_active', v)} />
                Ativo
              </label>
              <Button
                onClick={() => saveContact(contact.id)}
                disabled={isSaving}
                className="w-full mt-2"
                size="default"
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </div>
          )}

          {/* === COMPACT INFO + ACTIONS (view mode only) === */}
          {!isEditing && (
            <div className="pt-2 mt-2 border-t space-y-2">
              {/* Row 1: Status indicators as small inline text */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground overflow-hidden">
                {contact.pin_hash ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        <KeyRound className="h-3 w-3 text-amber-500" />
                        <span>PIN {savedPins[contact.id] || '••••'}</span>
                      </button>
                    </PopoverTrigger>
                    {!savedPins[contact.id] && (
                      <PopoverContent className="w-48 p-3" side="top">
                        <p className="text-xs text-muted-foreground mb-2">Verificar PIN</p>
                        <div className="flex gap-1.5">
                          <Input
                            type="text" inputMode="numeric" maxLength={4}
                            value={verifyPinInput[contact.id] || ''}
                            onChange={e => setVerifyPinInput(prev => ({ ...prev, [contact.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            className="h-7 text-xs text-center tracking-widest"
                            placeholder="0000"
                            autoFocus
                          />
                          <Button
                            variant="outline" size="sm" className="h-7 px-2"
                            disabled={!verifyPinInput[contact.id] || verifyPinInput[contact.id]?.length !== 4}
                            onClick={async () => {
                              try {
                                const data = await validatePinWithRetry({ email: contact.email, pin: verifyPinInput[contact.id] });
                                if (!isValidatePinFailure(data)) {
                                  setVerifyResult(prev => ({ ...prev, [contact.id]: 'ok' }));
                                  setSavedPins(prev => ({ ...prev, [contact.id]: verifyPinInput[contact.id] }));
                                  toast({ title: '✅ PIN correto!' });
                                } else {
                                  setVerifyResult(prev => ({ ...prev, [contact.id]: 'fail' }));
                                  toast({ title: data.retryable ? '⚠️ Sistema indisponível' : '❌ PIN incorreto', description: data.error, variant: 'destructive' });
                                }
                              } catch {
                                setVerifyResult(prev => ({ ...prev, [contact.id]: 'fail' }));
                                toast({ title: '❌ PIN incorreto', variant: 'destructive' });
                              }
                            }}
                          >
                            {verifyResult[contact.id] === 'ok' ? <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> :
                             verifyResult[contact.id] === 'fail' ? <ShieldX className="h-3.5 w-3.5 text-destructive" /> :
                             <Check className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/50">
                    <KeyRound className="h-3 w-3" /> Sem PIN
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 ${contact.is_active ? 'text-green-600' : 'text-muted-foreground/50'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${contact.is_active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  {contact.is_active ? 'Ativo' : 'Inativo'}
                </span>
                {assignedSites.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {assignedSites.length} unid.
                  </span>
                )}
              </div>

              {/* Row 2: Action buttons - vertical, prominent */}
              <div className="flex flex-col gap-2 w-full">
                {(() => {
                  const hasPinInMemory = !!(savedPins[contact.id] && /^\d{4}$/.test(savedPins[contact.id]));
                  const needsInlinePin = !hasPinInMemory && !!contact.pin_hash;
                  const noPinAtAll = !hasPinInMemory && !contact.pin_hash;

                  if (noPinAtAll) {
                    return (
                      <div className="flex flex-col gap-1.5 w-full">
                        <Button
                          variant="default"
                          className="w-full bg-black text-white hover:bg-black/90 gap-2"
                          onClick={() => { startEditing(contact); toast({ title: 'Defina um PIN', description: 'Configure um PIN de 4 dígitos para gerar o convite' }); }}
                        >
                          <KeyRound className="h-4 w-4 shrink-0" />
                          Configurar PIN
                        </Button>
                        <p className="text-[11px] text-muted-foreground text-center leading-tight px-1">
                          Defina um PIN de 4 dígitos para liberar o convite
                        </p>
                      </div>
                    );
                  }

                  if (needsInlinePin) {
                    return (
                      <div className="flex flex-col gap-1.5 w-full">
                        <Input
                          type="text" inputMode="numeric" maxLength={4}
                          value={inlinePin[contact.id] || ''}
                          onChange={e => setInlinePin(prev => ({ ...prev, [contact.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                          className="h-9 text-sm w-full text-center tracking-widest"
                          placeholder="Digite o PIN de 4 dígitos"
                        />
                        <Button
                          variant="default"
                          className="w-full bg-black text-white hover:bg-black/90 gap-2"
                          disabled={isGenerating || !inlinePin[contact.id] || inlinePin[contact.id]?.length !== 4}
                          onClick={() => handleGenerateInvite(contact)}
                        >
                          {isGenerating ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Link2 className="h-4 w-4 shrink-0" />}
                          Gerar texto de convite
                        </Button>
                        <p className="text-[11px] text-muted-foreground text-center leading-tight px-1">
                          Copiar o texto gerado e colar no WhatsApp do cliente
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-1.5 w-full">
                      <Button
                        variant="default"
                        className="w-full bg-black text-white hover:bg-black/90 gap-2"
                        disabled={isGenerating}
                        onClick={() => handleGenerateInvite(contact)}
                      >
                        {isGenerating ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Link2 className="h-4 w-4 shrink-0" />}
                        Gerar texto de convite
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center leading-tight px-1">
                        Copiar o texto gerado e colar no WhatsApp do cliente
                      </p>
                    </div>
                  );
                })()}

                {contact.is_active && companySlug && (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-muted-foreground self-center"
                    onClick={() => {
                      const siteIds = contactSiteMap[contact.id] || [];
                      const firstSiteSlug = siteIds.length > 0 && contactSiteSlugs ? contactSiteSlugs[siteIds[0]] : undefined;
                      const portalUrl = firstSiteSlug
                        ? `/${companySlug}/${firstSiteSlug}/c/${contact.id}`
                        : `/${companySlug}/c/${contact.id}`;
                      window.open(portalUrl, '_blank');
                    }}
                  >
                    <Eye className="h-3 w-3" /> Ver portal
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ============= NEW CONTACT FORM (shared) =============
  const renderNewContactCard = () => (
    <Card className="ring-2 ring-primary/30">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Novo Contato</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsCreating(false)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nome completo *</Label>
            <Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} className="h-9 text-sm" placeholder="Nome completo" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email *</Label>
            <Input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className="h-9 text-sm" placeholder="email@empresa.com" type="email" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cargo</Label>
            <Input value={newContact.role} onChange={e => setNewContact(p => ({ ...p, role: e.target.value }))} className="h-9 text-sm" placeholder="Ex: Engenheiro de Obras" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <PhoneInput value={newContact.phone} onChange={v => setNewContact(p => ({ ...p, phone: v }))} className="h-9 text-sm" placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">PIN (4 dígitos) *</Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={newContact.pin}
              onChange={e => setNewContact(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              className="h-9 text-sm tracking-widest"
              placeholder="Definir PIN"
            />
          </div>
          {!siteId && sites.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <MapPin className="h-3 w-3" /> Unidade
              </Label>
              <RadioGroup
                value={newContact.siteIds[0] || ''}
                onValueChange={(v) => setNewContact(p => ({ ...p, siteIds: [v] }))}
                className="space-y-1 max-h-32 overflow-y-auto"
              >
                {sites.map(site => (
                  <label key={site.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-1">
                    <RadioGroupItem value={site.id} />
                    <span className="break-words">{site.name}{site.companyName ? ` (${site.companyName})` : ''}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm pt-1">
            <Switch checked={newContact.is_active} onCheckedChange={v => setNewContact(p => ({ ...p, is_active: v }))} />
            Ativo
          </label>
        </div>
        <Button onClick={handleCreate} disabled={saving === 'new'} className="w-full mt-2" size="default">
          {saving === 'new' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );

  // ============= SHARED DIALOGS =============
  const renderSharedDialogs = () => (
    <>
      <Dialog open={credentialsDialog.open} onOpenChange={(open) => { setCredentialsDialog({ open, credentials: open ? credentialsDialog.credentials : null }); setCopied(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convite Gerado</DialogTitle>
            <DialogDescription>Copie a mensagem abaixo e envie via WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea readOnly value={getWhatsAppMessage()} className="min-h-[200px] font-mono text-sm resize-none" />
            <Button onClick={handleCopyMessage} className="w-full" variant={copied ? "secondary" : "default"}>
              {copied ? <><Check className="h-4 w-4 mr-2" />Copiado!</> : <><Copy className="h-4 w-4 mr-2" />Copiar Mensagem</>}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialog({ open: false, credentials: null })}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, contact: open ? deleteConfirm.contact : null })}
        title="Remover Contato"
        description={`Tem certeza que deseja remover ${deleteConfirm.contact?.name}? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );

  // ============= SINGLE-SITE MODE =============
  if (siteId) {
    const siteContacts = contacts.filter(c => (contactSiteMap[c.id] || []).includes(siteId));
    return (
      <TooltipProvider>
        <div className="space-y-3">
          {!embedded && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Contatos</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {siteContacts.length}
                </Badge>
              </div>
              <Button onClick={() => setIsCreating(true)} size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" />
                Novo Contato
              </Button>
            </div>
          )}
          {embedded && (
            <div className="flex items-center justify-end">
              <Button onClick={() => setIsCreating(true)} size="sm" variant="outline" className="h-8 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" />
                Novo Contato
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {isCreating && (
                <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {renderNewContactCard()}
                </div>
              )}
              {siteContacts.length === 0 && !isCreating ? (
                <div className="text-xs text-muted-foreground italic px-3 py-4 border border-dashed border-border/40 rounded-lg text-center">
                  Nenhum contato nesta unidade — clique em "Novo Contato" para adicionar.
                </div>
              ) : siteContacts.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {siteContacts.map(renderContactCard)}
                </div>
              ) : null}
            </div>
          )}
        </div>
        {renderSharedDialogs()}
      </TooltipProvider>
    );
  }

  // ============= LEGACY FULL-CARD MODE =============
  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {companies ? <Building2 className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
              <div>
                <CardTitle>Contatos do Cliente</CardTitle>
                <CardDescription>Gerencie contatos, acessos por unidade, senhas e PINs</CardDescription>
              </div>
            </div>
            {companyId && (
              <Button onClick={() => setIsCreating(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Contato
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company / Site selectors (super admin only) */}
          {companies && onCompanyChange && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedCompanyId || ''} onValueChange={onCompanyChange}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCompanyId && companySites?.[selectedCompanyId]?.length > 0 && (
                  <Select value={selectedSiteId || ''} onValueChange={onSiteChange!}>
                    <SelectTrigger className="max-w-[220px]">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySites[selectedCompanyId].map((site) => (
                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedCompanyId && onOpenPortal && (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 bg-primary/85 backdrop-blur-sm border border-primary/20"
                    onClick={() => onOpenPortal(selectedCompanyId, selectedSiteId || undefined)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Portal
                  </Button>
                )}
              </div>
              {companyId && <Separator />}
            </>
          )}

          {!companyId ? (
            companies ? (
              <div className="text-center py-8 text-muted-foreground">
                Selecione uma empresa acima para ver os contatos
              </div>
            ) : null
          ) : (
          <>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 && !isCreating ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum contato cadastrado para esta empresa
            </div>
          ) : (
            <div className="space-y-6">
              {isCreating && (
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                  {renderNewContactCard()}
                </div>
              )}

              {/* Grouped by unit (site) */}
              {(() => {
                const orphanContacts = contacts.filter(c => (contactSiteMap[c.id] || []).length === 0);
                return (
                  <>
                    {sites.map(site => {
                      const siteContacts = contacts.filter(c => (contactSiteMap[c.id] || []).includes(site.id));
                      return (
                        <div key={site.id} className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <h3 className="font-semibold text-sm">
                              {site.name}
                              {site.companyName ? <span className="text-muted-foreground font-normal"> · {site.companyName}</span> : null}
                            </h3>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {siteContacts.length} {siteContacts.length === 1 ? 'contato' : 'contatos'}
                            </Badge>
                          </div>
                          {siteContacts.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic px-3 py-4 border border-dashed border-border/40 rounded-lg text-center">
                              Nenhum contato — clique em "Novo Contato" para adicionar.
                            </div>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                              {siteContacts.map(renderContactCard)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {orphanContacts.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <ShieldX className="h-4 w-4 text-destructive shrink-0" />
                          <h3 className="font-semibold text-sm text-destructive">Sem unidade atribuída</h3>
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            {orphanContacts.length} {orphanContacts.length === 1 ? 'contato' : 'contatos'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground px-1">
                          Estes contatos não têm acesso ao portal. Edite cada um e selecione uma unidade.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                          {orphanContacts.map(renderContactCard)}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialog.open} onOpenChange={(open) => { setCredentialsDialog({ open, credentials: open ? credentialsDialog.credentials : null }); setCopied(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convite Gerado</DialogTitle>
            <DialogDescription>Copie a mensagem abaixo e envie via WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea readOnly value={getWhatsAppMessage()} className="min-h-[200px] font-mono text-sm resize-none" />
            <Button onClick={handleCopyMessage} className="w-full" variant={copied ? "secondary" : "default"}>
              {copied ? <><Check className="h-4 w-4 mr-2" />Copiado!</> : <><Copy className="h-4 w-4 mr-2" />Copiar Mensagem</>}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialog({ open: false, credentials: null })}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, contact: open ? deleteConfirm.contact : null })}
        title="Remover Contato"
        description={`Tem certeza que deseja remover ${deleteConfirm.contact?.name}? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </TooltipProvider>
  );
}
