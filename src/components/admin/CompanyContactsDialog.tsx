import { useState, useEffect } from 'react';
import { Loader2, Plus, Pencil, Trash2, UserCheck, UserX, Mail, Link2, Copy, Check, Camera, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface CompanyContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

interface GeneratedCredentials {
  contactName: string;
  email: string;
  password: string;
  loginUrl: string;
  pin: string;
}

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  role: '',
  can_approve: true,
  is_active: true,
  avatar_url: '',
  pin: '',
};

export function CompanyContactsDialog({ open, onOpenChange, companyId, companyName }: CompanyContactsDialogProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [savedPins, setSavedPins] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [credentialsDialog, setCredentialsDialog] = useState<{ open: boolean; credentials: GeneratedCredentials | null }>({ open: false, credentials: null });
  const [copied, setCopied] = useState(false);

  const fetchContacts = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      
      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar contatos', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && companyId) {
      fetchContacts();
    }
  }, [open, companyId]);

  const openCreate = () => {
    setEditingContact(null);
    setFormData(initialFormData);
    setIsFormOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      role: contact.role || '',
      can_approve: contact.can_approve,
      is_active: contact.is_active,
      avatar_url: contact.avatar_url || '',
      pin: '',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast({ title: 'Erro', description: 'Nome e email são obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingContact) {
        // If PIN was entered, hash it via edge function
        let pinHashValue = undefined;
        if (formData.pin && formData.pin.length === 4) {
          const { data: pinData, error: pinError } = await supabase.functions.invoke('set-pin', {
            body: { pin: formData.pin, contactId: editingContact.id }
          });
          if (pinError) console.warn('Could not hash PIN via edge function');
          pinHashValue = pinData?.pin_hash;
        }

        const updatePayload: any = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          role: formData.role || null,
          can_approve: formData.can_approve,
          is_active: formData.is_active,
          avatar_url: formData.avatar_url || null,
        };
        if (pinHashValue) updatePayload.pin_hash = pinHashValue;

        const { error } = await supabase
          .from('company_contacts')
          .update(updatePayload)
          .eq('id', editingContact.id);
        
        if (error) throw error;
        // Preserve the PIN so it's available for "Gerar Convite" after save
        if (formData.pin && formData.pin.length === 4 && editingContact) {
          setSavedPins(prev => ({ ...prev, [editingContact.id]: formData.pin }));
        }
        toast({ title: 'Contato atualizado' });
      } else {
        // For new contacts, hash PIN if provided
        let pinHashValue = null;
        if (formData.pin && formData.pin.length === 4) {
          const { data: pinData } = await supabase.functions.invoke('set-pin', {
            body: { pin: formData.pin }
          });
          pinHashValue = pinData?.pin_hash;
        }

        const { error } = await supabase
          .from('company_contacts')
          .insert({
            company_id: companyId,
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
            role: formData.role || null,
            can_approve: formData.can_approve,
            is_active: formData.is_active,
            avatar_url: formData.avatar_url || null,
            pin_hash: pinHashValue,
          });
        
        if (error) {
          if (error.message.includes('duplicate')) {
            throw new Error('Já existe um contato com este email nesta fábrica');
          }
          throw error;
        }
        toast({ title: 'Contato adicionado' });
      }
      
      setIsFormOpen(false);
      fetchContacts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.contact) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_contacts')
        .delete()
        .eq('id', deleteConfirm.contact.id);
      
      if (error) throw error;
      toast({ title: 'Contato removido' });
      setDeleteConfirm({ open: false, contact: null });
      fetchContacts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvite = async (contact: Contact) => {
    // Check savedPins first (persisted after save), then active form
    const pinToPass = savedPins[contact.id] || ((editingContact?.id === contact.id) ? formData.pin : '');
    if (!pinToPass || !/^\d{4}$/.test(pinToPass)) {
      toast({ title: 'PIN obrigatório', description: 'Digite um PIN de 4 dígitos antes de gerar o convite', variant: 'destructive' });
      return;
    }
    setGeneratingInvite(contact.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-client-invitation', {
        body: {
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email,
          companyName: companyName,
          companyId: companyId,
          pin: pinToPass,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.credentials) {
        setCredentialsDialog({
          open: true,
          credentials: {
            contactName: contact.name,
            email: data.credentials.email,
            password: data.credentials.password,
            loginUrl: data.credentials.loginUrl,
            pin: data.credentials.pin || '',
          }
        });
      }
      
      fetchContacts();
    } catch (error: any) {
      toast({ 
        title: 'Erro ao gerar convite', 
        description: error.message, 
        variant: 'destructive' 
      });
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
    } catch (err) {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const toggleStatus = async (contact: Contact, field: 'is_active' | 'can_approve') => {
    try {
      const { error } = await supabase
        .from('company_contacts')
        .update({ [field]: !contact[field] })
        .eq('id', contact.id);
      
      if (error) throw error;
      fetchContacts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Contatos de Aprovação - {companyName}</DialogTitle>
            <DialogDescription>
              Gerencie os contatos que podem aprovar relatórios desta fábrica
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-4">
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Contato
            </Button>
          </div>

          <ScrollArea className="max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum contato cadastrado
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-center">Convite</TableHead>
                      <TableHead className="text-center">Aprova</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => {
                      const inviteStatus = formatInvitationStatus(contact);
                      const isGenerating = generatingInvite === contact.id;
                      
                      return (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                {contact.avatar_url ? (
                                  <AvatarImage src={contact.avatar_url} alt={contact.name} />
                                ) : null}
                                <AvatarFallback className="text-xs">
                                  {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex items-center gap-1.5">
                                {contact.name}
                                {contact.pin_hash && (
                                  <KeyRound className="h-3 w-3 text-muted-foreground" />
                                )}
                                {contact.user_id && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                        Cadastrado
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Usuário já possui conta no sistema
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{contact.email}</TableCell>
                          <TableCell>{contact.role || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge 
                                  variant={inviteStatus.sent ? 'default' : 'secondary'}
                                  className={inviteStatus.sent ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' : ''}
                                >
                                  {inviteStatus.sent ? (
                                    <>
                                      <Mail className="h-3 w-3 mr-1" />
                                      {inviteStatus.count > 1 ? `${inviteStatus.count}x` : 'Gerado'}
                                    </>
                                  ) : (
                                    'Pendente'
                                  )}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {inviteStatus.sent 
                                  ? `${inviteStatus.text} (${inviteStatus.count} vez${inviteStatus.count > 1 ? 'es' : ''})` 
                                  : 'Convite ainda não gerado'}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleStatus(contact, 'can_approve')}
                              className={contact.can_approve ? 'text-green-600' : 'text-muted-foreground'}
                            >
                              {contact.can_approve ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={contact.is_active ? 'default' : 'secondary'}>
                              {contact.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    disabled={isGenerating}
                                    onClick={() => handleGenerateInvite(contact)}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    {isGenerating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Link2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {inviteStatus.sent ? 'Gerar novo convite' : 'Gerar convite'}
                                </TooltipContent>
                              </Tooltip>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(contact)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => setDeleteConfirm({ open: true, contact })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Editar' : 'Novo'} Contato</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} 
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} 
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <PhoneInput 
                value={formData.phone} 
                onChange={(value) => setFormData(p => ({ ...p, phone: value }))} 
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input 
                value={formData.role} 
                onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))} 
                placeholder="Ex: Engenheiro, Gerente"
              />
            </div>
            <div className="max-w-[120px]">
              <ImageUploader
                image={formData.avatar_url}
                onImageChange={(url) => setFormData(p => ({ ...p, avatar_url: url || '' }))}
                label="Foto"
                enableEditor
                cropWidth={200}
                cropHeight={200}
              />
            </div>
            <div>
              <Label>PIN de acesso (4 dígitos)</Label>
              <Input 
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={formData.pin} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFormData(p => ({ ...p, pin: val }));
                }} 
                placeholder={editingContact?.pin_hash ? '••••  (manter atual)' : 'Definir PIN'}
              />
              <p className="text-xs text-muted-foreground mt-1">Deixe vazio para manter o PIN atual</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Pode aprovar relatórios</Label>
              <Switch 
                checked={formData.can_approve} 
                onCheckedChange={(checked) => setFormData(p => ({ ...p, can_approve: checked }))} 
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch 
                checked={formData.is_active} 
                onCheckedChange={(checked) => setFormData(p => ({ ...p, is_active: checked }))} 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog for WhatsApp */}
      <Dialog open={credentialsDialog.open} onOpenChange={(open) => {
        setCredentialsDialog({ open, credentials: open ? credentialsDialog.credentials : null });
        setCopied(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convite Gerado</DialogTitle>
            <DialogDescription>
              Copie a mensagem abaixo e envie via WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Textarea
              readOnly
              value={getWhatsAppMessage()}
              className="min-h-[200px] font-mono text-sm resize-none"
            />
            
            <Button 
              onClick={handleCopyMessage} 
              className="w-full"
              variant={copied ? "secondary" : "default"}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Mensagem
                </>
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialog({ open: false, credentials: null })}>
              Fechar
            </Button>
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
    </>
  );
}
