import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Save, PlugZap, KeyRound, Webhook, Smartphone, PlusCircle, Trash2, Power } from 'lucide-react';

interface SettingsRow {
  id: string;
  base_url: string;
  webhook_url: string | null;
  webhook_events: string[] | null;
  instance_name: string | null;
}

const DEFAULT_BASE_URL = 'https://chatwees.uazapi.com';

export function WhatsAppConnectionSettingsCard() {
  const { toast } = useToast();
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const defaultWebhookUrl = `https://${projectId}.supabase.co/functions/v1/uazapi-webhook`;
  const statusFnUrl = `https://${projectId}.supabase.co/functions/v1/uazapi-status`;

  const [row, setRow] = useState<SettingsRow | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [eventsText, setEventsText] = useState('messages, messages_update, connection');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [tokenMasked, setTokenMasked] = useState<string | null>(null);
  const [instanceTokenMasked, setInstanceTokenMasked] = useState<string | null>(null);
  const [adminTokenMasked, setAdminTokenMasked] = useState<string | null>(null);
  const [tokenSource, setTokenSource] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_integration_settings')
        .select('id, base_url, webhook_url, webhook_events')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.warn('Falha ao carregar configurações UAZAPI:', error.message);
      } else if (data) {
        setRow(data as SettingsRow);
        setBaseUrl(data.base_url || DEFAULT_BASE_URL);
        setWebhookUrl(data.webhook_url || '');
        setEventsText((data.webhook_events || ['messages', 'messages_update', 'connection']).join(', '));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const authHeaders = async () => {
    const session = await (supabase as any).auth.getSession();
    return {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${session.data.session?.access_token}`,
    };
  };

  const handleSave = async () => {
    let normalized = baseUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(normalized)) {
      toast({ title: 'URL inválida', description: 'O endereço do servidor deve começar com https://', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      base_url: normalized,
      webhook_url: webhookUrl.trim() || null,
      webhook_events: eventsText.split(',').map((e) => e.trim()).filter(Boolean),
    };
    const query = row
      ? (supabase as any).from('whatsapp_integration_settings').update(payload).eq('id', row.id).select().maybeSingle()
      : (supabase as any).from('whatsapp_integration_settings').insert(payload).select().maybeSingle();
    const { data, error } = await query;
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) setRow(data as SettingsRow);
    toast({ title: 'Configuração salva', description: 'As funções passarão a usar o novo endereço em até 15 segundos.' });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(statusFnUrl, { headers: await authHeaders() });
      const data = await res.json();
      setTokenMasked(data?.tokenMasked ?? null);
      setInstanceTokenMasked(data?.instanceTokenMasked ?? null);
      setAdminTokenMasked(data?.adminTokenMasked ?? null);
      setTokenSource(data?.tokenSource ?? null);
      if (data?.error) {
        setTestResult(`Erro: ${data.error}`);
      } else {
        const sourceLabel = data?.tokenSource === 'instance' ? 'instance token' : data?.tokenSource === 'admin' ? 'admin token (fallback)' : 'nenhum';
        setTestResult(
          `${data?.connected ? 'Conectado' : 'Desconectado'} · servidor: ${data?.baseUrl ?? '—'} · token em uso: ${sourceLabel} · webhook esperado: ${data?.expectedWebhookUrl ?? '—'}`
        );
      }
    } catch (err: any) {
      setTestResult(`Falha na chamada: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleApplyWebhook = async () => {
    setApplying(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(statusFnUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {}),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Webhook aplicado', description: data?.webhookUrl || 'Configuração enviada à UAZAPI.' });
      } else {
        toast({ title: 'Falha ao aplicar webhook', description: data?.error || 'Verifique o token e o endereço do servidor.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Falha ao aplicar webhook', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="w-5 h-5 text-primary" />
          Conexão da API (UAZAPI)
        </CardTitle>
        <CardDescription>
          Edite o endereço do servidor e o webhook usados por todas as integrações de WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="uazapi-base-url">Server URL</Label>
              <Input
                id="uazapi-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URL}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="uazapi-webhook-url">Webhook URL</Label>
              <Input
                id="uazapi-webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={defaultWebhookUrl}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para usar o padrão: <span className="font-mono break-all">{defaultWebhookUrl}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="uazapi-events">Eventos do webhook (separados por vírgula)</Label>
              <Input
                id="uazapi-events"
                value={eventsText}
                onChange={(e) => setEventsText(e.target.value)}
                placeholder="messages, messages_update, connection"
              />
            </div>

            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                Admin Token
                <Badge variant="secondary">{adminTokenMasked ?? tokenMasked ?? 'no cofre de segredos'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Por segurança, o token fica no cofre de segredos (UAZAPI_TOKEN) e não é exibido aqui. Peça a troca no chat
                para atualizá-lo.
              </p>
            </div>

            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                Instance Token
                {instanceTokenMasked ? (
                  <Badge variant="secondary">{instanceTokenMasked}</Badge>
                ) : (
                  <Badge variant="outline">não configurado</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Token da instância conectada (cofre de segredos: UAZAPI_INSTANCE_TOKEN). Quando configurado, tem
                prioridade sobre o admin token. Peça no chat para cadastrar ou alterar.
              </p>
              {tokenSource && (
                <p className="text-xs text-muted-foreground">
                  Em uso agora: <span className="font-medium">{tokenSource === 'instance' ? 'Instance Token' : 'Admin Token (fallback)'}</span>
                </p>
              )}
            </div>

            {testResult && (
              <Alert>
                <AlertDescription className="text-xs break-all">{testResult}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
                Testar conexão
              </Button>
              <Button variant="outline" onClick={handleApplyWebhook} disabled={applying}>
                {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Webhook className="w-4 h-4 mr-2" />}
                Aplicar webhook
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
