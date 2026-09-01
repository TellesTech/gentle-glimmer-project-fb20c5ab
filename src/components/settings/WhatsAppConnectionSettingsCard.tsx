import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Save, PlugZap, QrCode, RefreshCw } from 'lucide-react';

interface SettingsRow {
  id: string;
  base_url: string;
  instance_token: string | null;
  instance_name: string | null;
}

const DEFAULT_BASE_URL = 'https://weeschat.uazapi.com';

function maskToken(value: string | null | undefined): string {
  if (!value) return '';
  return value.length > 8 ? `${value.slice(0, 4)}••••${value.slice(-4)}` : '••••';
}

export function WhatsAppConnectionSettingsCard() {
  const { toast } = useToast();
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const statusFnUrl = `https://${projectId}.supabase.co/functions/v1/uazapi-status`;

  const [row, setRow] = useState<SettingsRow | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [instanceToken, setInstanceToken] = useState('');
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  const authHeaders = async () => {
    const session = await (supabase as any).auth.getSession();
    return {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${session.data.session?.access_token}`,
    };
  };

  const refreshStatus = async () => {
    try {
      const res = await fetch(statusFnUrl, { headers: await authHeaders() });
      const data = await res.json();
      setStatus(data?.connected ? 'connected' : 'disconnected');
    } catch {
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_integration_settings')
        .select('id, base_url, instance_token, instance_name')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.warn('Falha ao carregar configurações UAZAPI:', error.message);
      } else if (data) {
        setRow(data as SettingsRow);
        setBaseUrl(data.base_url || DEFAULT_BASE_URL);
        setSavedToken(data.instance_token || null);
      }
      setLoading(false);
      refreshStatus();
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(normalized)) {
      toast({ title: 'URL inválida', description: 'O endereço do servidor deve começar com https://', variant: 'destructive' });
      return;
    }
    const token = instanceToken.trim();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { base_url: normalized };
      if (token) payload.instance_token = token;

      const query = row
        ? (supabase as any).from('whatsapp_integration_settings').update(payload).eq('id', row.id).select().maybeSingle()
        : (supabase as any).from('whatsapp_integration_settings').insert(payload).select().maybeSingle();
      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        setRow(data as SettingsRow);
        setSavedToken((data as SettingsRow).instance_token || null);
      }
      setInstanceToken('');

      // Aplica o webhook automaticamente após salvar
      const res = await fetch(statusFnUrl, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: '{}',
      });
      const webhookData = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: 'Configuração salva', description: 'Endereço, token e webhook atualizados com sucesso.' });
      } else {
        toast({
          title: 'Salvo, mas o webhook falhou',
          description: webhookData?.error || 'Verifique o token da instância.',
          variant: 'destructive',
        });
      }
      await refreshStatus();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message || 'Falha desconhecida', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = () => {
    document.getElementById('whatsapp-connect-button')?.click();
  };

  if (!isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="w-5 h-5 text-primary" />
          Conexão do WhatsApp (UAZAPI)
        </CardTitle>
        <CardDescription>
          Cole o Server URL e o token da instância do painel UAZAPI. Ao salvar, o webhook é aplicado automaticamente.
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
              <Label htmlFor="uazapi-instance-token">Token da instância</Label>
              <Input
                id="uazapi-instance-token"
                value={instanceToken}
                onChange={(e) => setInstanceToken(e.target.value)}
                placeholder={savedToken ? `Salvo: ${maskToken(savedToken)}` : 'Cole aqui o token da instância'}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {savedToken
                  ? 'Já existe um token salvo. Preencha apenas se quiser substituí-lo.'
                  : 'Encontre no painel UAZAPI em "Dados da instância".'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              {status === 'connected' && <Badge className="bg-green-600 hover:bg-green-600">conectada</Badge>}
              {status === 'disconnected' && <Badge variant="destructive">desconectada</Badge>}
              {status === 'unknown' && <Badge variant="outline">verificando...</Badge>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={handleConnect}>
                <QrCode className="w-4 h-4 mr-2" />
                Conectar WhatsApp
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
