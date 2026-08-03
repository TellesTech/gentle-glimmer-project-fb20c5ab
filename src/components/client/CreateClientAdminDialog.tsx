import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface AdminUnitOption {
  id: string;
  name: string;
  company_id: string;
  companyName?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: AdminUnitOption[];
}

const passwordIssues = (p: string) => {
  const issues: string[] = [];
  if (p.length < 8) issues.push('mínimo 8 caracteres');
  if (!/[A-Z]/.test(p)) issues.push('uma letra maiúscula');
  if (!/[a-z]/.test(p)) issues.push('uma letra minúscula');
  if (!/[0-9]/.test(p)) issues.push('um número');
  return issues;
};

export function CreateClientAdminDialog({ open, onOpenChange, units }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unitId, setUnitId] = useState<string>(units.length === 1 ? units[0].id : '');
  const [canApprove, setCanApprove] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setPassword(''); setConfirmPassword('');
    setUnitId(units.length === 1 ? units[0].id : ''); setCanApprove(true); setSendEmail(true); setSendWhatsapp(true);
  };

  const handleSubmit = async () => {
    const issues = passwordIssues(password);
    if (name.trim().length < 3) return toast.error('Informe o nome do cliente');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error('E-mail inválido');
    if (issues.length) return toast.error(`Senha fraca: falta ${issues.join(', ')}`);
    if (password !== confirmPassword) return toast.error('As senhas não conferem');
    if (!unitId) return toast.error('Selecione a unidade');
    if (sendWhatsapp && phone.replace(/\D/g, '').length < 10) {
      return toast.error('Informe um telefone válido para enviar por WhatsApp');
    }

    const unit = units.find((u) => u.id === unitId);
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-client-admin', {
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          password,
          confirmPassword,
          companyId: unit?.company_id,
          siteId: unit?.id,
          canApprove,
          sendEmail,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      let whatsappSent = false;
      if (sendWhatsapp) {
        try {
          const { data: waData, error: waError } = await supabase.functions.invoke(
            'send-portal-credentials-whatsapp',
            {
              body: {
                name: name.trim(),
                email: email.trim(),
                password,
                phone: phone.trim(),
                companyName: unit?.companyName || null,
                companyId: unit?.company_id || null,
                siteId: unit?.id || null,
                portalUrl: `${window.location.origin}/client/login`,
              },
            }
          );
          whatsappSent = !waError && !(waData as any)?.error;
          if (!whatsappSent) {
            toast.warning('Acesso criado, mas o envio por WhatsApp falhou');
          }
        } catch {
          toast.warning('Acesso criado, mas o envio por WhatsApp falhou');
        }
      }

      toast.success(
        whatsappSent
          ? 'Acesso criado e credenciais enviadas por WhatsApp'
          : (data as any)?.emailSent
          ? 'Acesso criado e e-mail enviado ao administrador'
          : 'Acesso de administrador criado com sucesso'
      );
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível criar o acesso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Criar Acesso de Administrador
          </DialogTitle>
          <DialogDescription>
            Crie o login de um administrador do cliente para acessar o portal e aprovar RDOs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cca-name">Nome do cliente *</Label>
            <Input id="cca-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cca-email">E-mail do administrador *</Label>
            <Input id="cca-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@empresa.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cca-pass">Senha *</Label>
              <Input id="cca-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cca-pass2">Confirmar senha *</Label>
              <Input id="cca-pass2" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A senha deve ter no mínimo 8 caracteres, com maiúscula, minúscula e número.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="cca-phone">Telefone de contato</Label>
            <Input id="cca-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            <p className="text-[11px] text-muted-foreground">Usado para enviar as credenciais por WhatsApp.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Unidade *</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}{u.companyName ? ` — ${u.companyName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Pode aprovar/assinar RDOs</p>
              <p className="text-xs text-muted-foreground">Permissão padrão de administrador do cliente</p>
            </div>
            <Switch checked={canApprove} onCheckedChange={setCanApprove} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enviar e-mail com os dados de acesso</p>
              <p className="text-xs text-muted-foreground">Envia login e senha para o administrador</p>
            </div>
            <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enviar credenciais por WhatsApp</p>
              <p className="text-xs text-muted-foreground">Mensagem profissional com usuário, senha e link do portal</p>
            </div>
            <Switch checked={sendWhatsapp} onCheckedChange={setSendWhatsapp} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
