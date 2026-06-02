import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { ValidatedInput } from '@/components/shared/ValidatedInput';
import { PhoneInput } from '@/components/ui/phone-input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string | null;
  onSaved?: () => void;
}

const initialData = {
  name: '',
  cnpj: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  photo_url: '',
  contract_number: '',
  client_notes: '',
  is_client_active: true,
  responsible_name: '',
  responsible_email: '',
  responsible_phone: '',
  responsible_role: '',
};

export function CompanyFormDialog({ open, onOpenChange, companyId, onSaved }: CompanyFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = !!companyId;

  useEffect(() => {
    if (!open) return;
    if (!companyId) {
      setForm(initialData);
      return;
    }
    let cancel = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('name, cnpj, phone, email, address, city, state, zip_code, photo_url, contract_number, client_notes, is_client_active, responsible_name, responsible_email, responsible_phone, responsible_role')
        .eq('id', companyId)
        .single();
      if (cancel) return;
      if (error) {
        toast({ title: 'Erro ao carregar fábrica', description: error.message, variant: 'destructive' });
      } else if (data) {
        setForm({
          name: data.name || '',
          cnpj: data.cnpj || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
          photo_url: data.photo_url || '',
          contract_number: (data as any).contract_number || '',
          client_notes: (data as any).client_notes || '',
          is_client_active: (data as any).is_client_active ?? true,
          responsible_name: (data as any).responsible_name || '',
          responsible_email: (data as any).responsible_email || '',
          responsible_phone: (data as any).responsible_phone || '',
          responsible_role: (data as any).responsible_role || '',
        });
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, companyId, toast]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        cnpj: form.cnpj || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        photo_url: form.photo_url || null,
        contract_number: form.contract_number || null,
        client_notes: form.client_notes || null,
        is_client_active: form.is_client_active,
        responsible_name: form.responsible_name || null,
        responsible_email: form.responsible_email || null,
        responsible_phone: form.responsible_phone || null,
        responsible_role: form.responsible_role || null,
      };
      if (isEdit) {
        const { error } = await supabase.from('companies').update(payload).eq('id', companyId!);
        if (error) throw error;
        toast({ title: 'Fábrica atualizada com sucesso!' });
      } else {
        const { error } = await supabase.from('companies').insert(payload);
        if (error) throw error;
        toast({ title: 'Fábrica criada com sucesso!' });
      }
      await queryClient.invalidateQueries({ queryKey: ['companies-selector'] });
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{isEdit ? 'Editar' : 'Nova'} Fábrica</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 p-6 pt-4">
              <div className="space-y-2">
                <Label>Foto da Fábrica</Label>
                <ImageUploader
                  image={form.photo_url}
                  onImageChange={(img) => setForm(prev => ({ ...prev, photo_url: img || '' }))}
                  label=""
                  bucketName="company-photos"
                  folder="companies"
                  previewSize="lg"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados da Fábrica</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cfd-name">Nome *</Label>
                    <Input id="cfd-name" placeholder="Nome da fábrica" value={form.name}
                      onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                  </div>
                  <div className="space-y-2">
                    <ValidatedInput id="cfd-cnpj" label="CNPJ" type="cnpj" value={form.cnpj}
                      onChange={(v) => setForm(p => ({ ...p, cnpj: v }))} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfd-contract">Nº Contrato</Label>
                    <Input id="cfd-contract" placeholder="Número do contrato" value={form.contract_number}
                      onChange={(e) => setForm(p => ({ ...p, contract_number: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfd-phone">Telefone</Label>
                    <PhoneInput id="cfd-phone" placeholder="(00) 00000-0000" value={form.phone}
                      onChange={(v) => setForm(p => ({ ...p, phone: v }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfd-email">Email</Label>
                    <Input id="cfd-email" type="email" placeholder="email@empresa.com" value={form.email}
                      onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Endereço</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cfd-address">Endereço</Label>
                    <Input id="cfd-address" placeholder="Rua, número, bairro" value={form.address}
                      onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfd-city">Cidade</Label>
                    <Input id="cfd-city" placeholder="Cidade" value={form.city}
                      onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cfd-state">Estado</Label>
                      <Input id="cfd-state" placeholder="UF" maxLength={2} value={form.state}
                        onChange={(e) => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cfd-zip">CEP</Label>
                      <Input id="cfd-zip" placeholder="00000-000" value={form.zip_code}
                        onChange={(e) => setForm(p => ({ ...p, zip_code: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div>
                  <Label htmlFor="cfd-active" className="font-medium">Cliente Ativo</Label>
                  <p className="text-sm text-muted-foreground">Habilitar acesso ao portal do cliente</p>
                </div>
                <Switch id="cfd-active" checked={form.is_client_active}
                  onCheckedChange={(c) => setForm(p => ({ ...p, is_client_active: c }))} />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Responsável Principal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cfd-rn">Nome</Label>
                    <Input id="cfd-rn" placeholder="Nome do responsável" value={form.responsible_name}
                      onChange={(e) => setForm(p => ({ ...p, responsible_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfd-rr">Cargo</Label>
                    <Input id="cfd-rr" placeholder="Cargo" value={form.responsible_role}
                      onChange={(e) => setForm(p => ({ ...p, responsible_role: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfd-re">Email</Label>
                    <Input id="cfd-re" type="email" placeholder="email@empresa.com" value={form.responsible_email}
                      onChange={(e) => setForm(p => ({ ...p, responsible_email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfd-rp">Telefone</Label>
                    <PhoneInput id="cfd-rp" placeholder="(00) 00000-0000" value={form.responsible_phone}
                      onChange={(v) => setForm(p => ({ ...p, responsible_phone: v }))} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cfd-notes">Observações</Label>
                <Textarea id="cfd-notes" placeholder="Observações sobre o cliente..."
                  value={form.client_notes}
                  onChange={(e) => setForm(p => ({ ...p, client_notes: e.target.value }))} rows={3} />
              </div>
            </div>
          )}
        </ScrollArea>
        <DialogFooter className="p-6 pt-0 border-t mt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading || !form.name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Salvar' : 'Criar Fábrica'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}