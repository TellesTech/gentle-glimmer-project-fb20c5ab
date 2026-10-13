import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Loader2, Plus, Send, Trash2 } from 'lucide-react';

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/uazapi-status`;
const digits = (v: string) => v.replace(/\D/g, '');
const validPhone = (v: string) => { const d = digits(v); return d.length >= 10 && d.length <= 13; };
const fmtPhone = (d: string) => {
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return d;
};

type AlertContact = { name: string; phone: string };

async function callFn(action: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN_URL}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

export function WhatsAppMessagingCard() {
  const { toast } = useToast();
  const [rowId, setRowId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<AlertContact[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (supabase.from('whatsapp_integration_settings') as any)
      .select('id, alert_contacts').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setRowId(data.id);
          const list = Array.isArray(data.alert_contacts) ? data.alert_contacts : [];
          setContacts(list.filter((c: any) => c && c.phone).map((c: any) => ({ name: String(c.name || ''), phone: String(c.phone) })));
        }
      });
  }, []);

  const err = (title: string, e: any) => toast({ title, description: e?.message || String(e), variant: 'destructive' });

  const persist = async (list: AlertContact[]) => {
    if (!rowId) { err('Configuração não encontrada', 'Configure a conexão do WhatsApp primeiro.'); return false; }
    setSaving(true);
    const { error } = await (supabase.from('whatsapp_integration_settings') as any)
      .update({ alert_contacts: list }).eq('id', rowId);
    setSaving(false);
    if (error) { err('Não foi possível salvar', error); return false; }
    return true;
  };

  const addContact = async () => {
    const name = newName.trim();
    if (!name || name.length > 60) return err('Nome inválido', 'Informe um nome de até 60 caracteres.');
    if (!validPhone(newPhone)) return err('Número inválido', 'Use DDD + número, ex: 27 99999-9999');
    const d = digits(newPhone);
    if (contacts.some((c) => c.phone === d)) return err('Número já cadastrado', 'Este número já está na lista.');
    const list = [...contacts, { name, phone: d }];
    if (await persist(list)) {
      setContacts(list);
      setNewName('');
      setNewPhone('');
      toast({ title: 'Contato adicionado' });
    }
  };

  const removeContact = async (phone: string) => {
    const list = contacts.filter((c) => c.phone !== phone);
    if (await persist(list)) {
      setContacts(list);
      toast({ title: 'Contato removido' });
    }
  };

  const testAlert = async () => {
    if (!contacts.length) return err('Lista vazia', 'Adicione ao menos um contato.');
    setTesting(true);
    try {
      const r = await callFn('test_alert', {});
      const failed: string[] = r?.failed || [];
      if (failed.length) {
        toast({ title: 'Teste enviado com falhas', description: `Não saiu para: ${failed.map(fmtPhone).join(', ')}`, variant: 'destructive' });
      } else {
        toast({ title: 'Mensagem de teste enviada para todos os contatos' });
      }
    } catch (e) { err('Teste não enviado', e); } finally { setTesting(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-4 h-4" /> Números para avisos</CardTitle>
        <CardDescription>Recebem pelo WhatsApp os avisos de desconexão e reconexão. O envio sai sempre pelo WhatsApp que captura os RDOs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="alert-name">Nome</Label>
            <Input
              id="alert-name"
              placeholder="Ex.: Dayvison"
              maxLength={60}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alert-phone">WhatsApp (com DDD)</Label>
            <Input
              id="alert-phone"
              placeholder="27 99999-9999"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContact(); } }}
            />
          </div>
          <Button onClick={addContact} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Adicionar
          </Button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {contacts.map((c) => (
              <li key={c.phone} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{c.name || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">{fmtPhone(c.phone)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeContact(c.phone)} disabled={saving} aria-label={`Remover ${c.name || fmtPhone(c.phone)}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">Se o WhatsApp cair de vez, o aviso de queda pode não sair por ele; nesse caso chega pelo sino e e-mail, e estes contatos recebem o aviso ao reconectar.</p>

        <Button variant="outline" onClick={testAlert} disabled={testing || !contacts.length}>
          {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Enviar teste
        </Button>
      </CardContent>
    </Card>
  );
}
