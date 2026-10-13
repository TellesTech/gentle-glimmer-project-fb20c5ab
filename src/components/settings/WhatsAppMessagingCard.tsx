import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Loader2, Save, Send } from 'lucide-react';

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/uazapi-status`;
const digits = (v: string) => v.replace(/\D/g, '');
const validPhone = (v: string) => { const d = digits(v); return d.length >= 10 && d.length <= 13; };

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
  const [alertPhone, setAlertPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (supabase.from('whatsapp_integration_settings') as any)
      .select('id, alert_phone').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => { if (data) { setRowId(data.id); setAlertPhone(data.alert_phone || ''); } });
  }, []);

  const err = (title: string, e: any) => toast({ title, description: e?.message || String(e), variant: 'destructive' });

  const saveAlert = async () => {
    if (alertPhone && !validPhone(alertPhone)) return err('Número inválido', 'Use DDD + número, ex: 27 99999-9999');
    if (!rowId) return err('Configuração não encontrada', 'Configure a conexão do WhatsApp primeiro.');
    setSaving(true);
    const { error } = await (supabase.from('whatsapp_integration_settings') as any)
      .update({ alert_phone: alertPhone ? digits(alertPhone) : null }).eq('id', rowId);
    setSaving(false);
    if (error) return err('Não foi possível salvar', error);
    toast({ title: 'Número de avisos salvo' });
  };

  const testAlert = async () => {
    if (!validPhone(alertPhone)) return err('Número inválido', 'Use DDD + número.');
    setTesting(true);
    try { await callFn('test_alert', { phone: alertPhone }); toast({ title: 'Mensagem de teste enviada' }); }
    catch (e) { err('Teste não enviado', e); } finally { setTesting(false); }
  };

  const send = async () => {
    if (!validPhone(to)) return err('Número inválido', 'Use DDD + número.');
    if (!text.trim()) return err('Mensagem vazia', 'Escreva o texto.');
    setSending(true);
    try { await callFn('send_text', { phone: to, text }); toast({ title: 'Mensagem enviada' }); setText(''); }
    catch (e) { err('Mensagem não enviada', e); } finally { setSending(false); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-4 h-4" /> Número para avisos</CardTitle>
          <CardDescription>Recebe pelo WhatsApp os avisos de desconexão e reconexão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="alert-phone">WhatsApp (com DDD)</Label>
            <Input id="alert-phone" placeholder="27 99999-9999" value={alertPhone} onChange={(e) => setAlertPhone(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Se o WhatsApp cair de vez, o aviso de queda pode não sair por ele; nesse caso chega pelo sino e e-mail, e este número recebe o aviso ao reconectar.</p>
          <div className="flex gap-2">
            <Button onClick={saveAlert} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar</Button>
            <Button variant="outline" onClick={testAlert} disabled={testing}>{testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Enviar teste</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Send className="w-4 h-4" /> Enviar mensagem</CardTitle>
          <CardDescription>Envia um texto pelo WhatsApp que captura os RDOs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="send-to">Número (com DDD)</Label>
            <Input id="send-to" placeholder="27 99999-9999" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="send-text">Mensagem</Label>
            <Textarea id="send-text" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <Button onClick={send} disabled={sending}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Enviar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
