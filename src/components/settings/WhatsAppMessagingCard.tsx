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
  const [phones, setPhones] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (supabase.from('whatsapp_integration_settings') as any)
      .select('id, alert_phones').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setRowId(data.id);
          setPhones(Array.isArray(data.alert_phones) ? data.alert_phones : []);
        }
      });
  }, []);

  const err = (title: string, e: any) => toast({ title, description: e?.message || String(e), variant: 'destructive' });

  const persist = async (list: string[]) => {
    if (!rowId) { err('Configuração não encontrada', 'Configure a conexão do WhatsApp primeiro.'); return false; }
    setSaving(true);
    const { error } = await (supabase.from('whatsapp_integration_settings') as any)
      .update({ alert_phones: list }).eq('id', rowId);
    setSaving(false);
    if (error) { err('Não foi possível salvar', error); return false; }
    return true;
  };

  const addPhone = async () => {
    if (!validPhone(newPhone)) return err('Número inválido', 'Use DDD + número, ex: 27 99999-9999');
    const d = digits(newPhone);
    if (phones.includes(d)) return err('Número já cadastrado', 'Este número já está na lista.');
    const list = [...phones, d];
    if (await persist(list)) {
      setPhones(list);
      setNewPhone('');
      toast({ title: 'Número adicionado' });
    }
  };

  const removePhone = async (p: string) => {
    const list = phones.filter((x) => x !== p);
    if (await persist(list)) {
      setPhones(list);
      toast({ title: 'Número removido' });
    }
  };

  const testAlert = async () => {
    if (!phones.length) return err('Lista vazia', 'Adicione ao menos um número.');
    setTesting(true);
    try {
      const r = await callFn('test_alert', {});
      const failed: string[] = r?.failed || [];
      if (failed.length) {
        toast({ title: 'Teste enviado com falhas', description: `Não saiu para: ${failed.map(fmtPhone).join(', ')}`, variant: 'destructive' });
      } else {
        toast({ title: 'Mensagem de teste enviada para todos os números' });
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
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1">
            <Label htmlFor="alert-phone">WhatsApp (com DDD)</Label>
            <Input
              id="alert-phone"
              placeholder="27 99999-9999"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhone(); } }}
            />
          </div>
          <Button onClick={addPhone} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Adicionar
          </Button>
        </div>

        {phones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum número cadastrado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {phones.map((p) => (
              <li key={p} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{fmtPhone(p)}</span>
                <Button variant="ghost" size="icon" onClick={() => removePhone(p)} disabled={saving} aria-label={`Remover ${fmtPhone(p)}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">Se o WhatsApp cair de vez, o aviso de queda pode não sair por ele; nesse caso chega pelo sino e e-mail, e estes números recebem o aviso ao reconectar.</p>

        <Button variant="outline" onClick={testAlert} disabled={testing || !phones.length}>
          {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Enviar teste
        </Button>
      </CardContent>
    </Card>
  );
}
