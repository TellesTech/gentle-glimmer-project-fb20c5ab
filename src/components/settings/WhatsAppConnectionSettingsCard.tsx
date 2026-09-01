import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Save, PlugZap, QrCode, RefreshCw, CheckCircle, XCircle, Wifi, AlertCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/components/shared/WhatsAppIcon';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface SettingsRow {
  id: string;
  base_url: string;
  instance_token: string | null;
  instance_name: string | null;
}

interface CredentialsDiagnostic {
  credentialsValid: boolean;
  tokenLooksLikeInstanceId: boolean;
  tokenLooksLikeUrl?: boolean;
  tokenLengthInvalid: boolean;
  tokenLength: number;
  expectedTokenLength: number | string;
  instanceIdLength: number;
}

const DEFAULT_BASE_URL = 'https://weeschat.uazapi.com';

function maskToken(value: string | null | undefined): string {
  if (!value) return '';
  return value.length > 8 ? `${value.slice(0, 4)}••••${value.slice(-4)}` : '••••';
}

function formatPhone(jid: string | null | undefined): string {
  if (!jid) return '';
  const digits = String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
  if (digits.length < 12) return digits ? `+${digits}` : '';
  const cc = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  return `+${cc} ${ddd} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
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
  const [status, setStatus] = useState<'unknown' | 'connected' | 'disconnected' | 'error'>('unknown');
  const [statusMessage, setStatusMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [instanceInfo, setInstanceInfo] = useState<{ name: string; phone: string }>({ name: '', phone: '' });
  const [credentialsDiagnostic, setCredentialsDiagnostic] = useState<CredentialsDiagnostic | null>(null);

  // QR Code state
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrImageBase64, setQrImageBase64] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrAttempts, setQrAttempts] = useState(0);
  const [qrStatus, setQrStatus] = useState<'loading' | 'showing' | 'connected' | 'configuring' | 'done' | 'error'>('loading');
  const [qrMessage, setQrMessage] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reconnect / change number
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const authHeaders = useCallback(async () => {
    const session = await (supabase as any).auth.getSession();
    return {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${session.data.session?.access_token}`,
    };
  }, []);

  const credentialsBlocked = !!credentialsDiagnostic && !credentialsDiagnostic.credentialsValid;

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(statusFnUrl, { headers: await authHeaders() });
      const data = await res.json().catch(() => null);
      if (data?.diagnostics) setCredentialsDiagnostic(data.diagnostics);
      if (!res.ok || !data || data.error) {
        setStatus('error');
        setStatusMessage(data?.error || 'não foi possível verificar');
        return;
      }
      if (data?.connected) {
        setStatus('connected');
        setStatusMessage(data?.smartPhoneConnected ? 'Instância online e celular conectado' : 'Instância online');
      } else {
        setStatus('disconnected');
        setStatusMessage('Instância desconectada ou celular offline');
      }
      setInstanceInfo({
        name: String(data?.status?.instance?.name || data?.instanceName || '').trim(),
        phone: formatPhone(data?.status?.status?.jid || data?.status?.instance?.owner),
      });
    } catch {
      setStatus('error');
      setStatusMessage('não foi possível verificar');
    } finally {
      setChecking(false);
    }
  }, [statusFnUrl, authHeaders]);

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
    const timer = setInterval(() => { if (active) refreshStatus(); }, 20000);
    return () => { active = false; clearInterval(timer); };
  }, [refreshStatus]);

  // Configure webhook automatically (após conectar via QR)
  const configureWebhook = useCallback(async () => {
    try {
      setQrStatus('configuring');
      setQrMessage('Configurando webhook automaticamente...');
      const headers = await authHeaders();
      const res = await fetch(statusFnUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setQrStatus('done');
        setQrMessage('WhatsApp conectado e webhook configurado com sucesso!');
        toast({ title: '✅ WhatsApp conectado!', description: 'Webhook configurado automaticamente.' });
      } else {
        setQrStatus('done');
        setQrMessage('WhatsApp conectado! Webhook pode precisar de configuração manual.');
        toast({ title: '✅ WhatsApp conectado!', description: 'Verifique o webhook manualmente.' });
      }
    } catch (err: any) {
      setQrStatus('done');
      setQrMessage('WhatsApp conectado! Erro ao configurar webhook: ' + err.message);
    }
  }, [authHeaders, statusFnUrl, toast]);

  // Fetch QR Code
  const fetchQrCode = useCallback(async () => {
    try {
      setQrLoading(true);
      const headers = await authHeaders();
      const res = await fetch(`${statusFnUrl}?action=qr-code`, { headers });
      const data = await res.json();
      if (data?.connected) {
        // Já conectado — pular QR e configurar webhook
        setQrStatus('connected');
        await configureWebhook();
        return;
      } else if (data?.value) {
        setQrImageBase64(data.value);
        setQrStatus('showing');
      } else if (data?.image) {
        setQrImageBase64(data.image);
        setQrStatus('showing');
      } else {
        setQrStatus('error');
        setQrMessage(data?.error || 'Não foi possível gerar o QR Code. Verifique se a instância está desconectada.');
      }
    } catch (err: any) {
      setQrStatus('error');
      setQrMessage(err.message || 'Erro ao buscar QR Code');
    } finally {
      setQrLoading(false);
    }
  }, [authHeaders, statusFnUrl, configureWebhook]);

  const startQrFlow = useCallback(async () => {
    setQrDialogOpen(true);
    setQrStatus('loading');
    setQrAttempts(0);
    setQrMessage('');
    setQrImageBase64(null);
    await fetchQrCode();
  }, [fetchQrCode]);

  // Desconectar sessão atual e abrir QR do novo número
  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${statusFnUrl}?action=disconnect`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.result?.error || 'Falha ao desconectar a instância');
      }
      setStatus('disconnected');
      setStatusMessage('Instância desconectada — escaneie o QR Code para reconectar');
      toast({ title: 'Sessão encerrada', description: 'Abrindo QR Code do novo número...' });
      setReconnectDialogOpen(false);
      await startQrFlow();
    } catch (err: any) {
      toast({
        title: 'Erro ao desconectar',
        description: err.message || 'Tente novamente ou use "Conectar WhatsApp".',
        variant: 'destructive',
      });
    } finally {
      setReconnecting(false);
    }
  }, [authHeaders, statusFnUrl, startQrFlow, toast]);

  // Polling do QR: verifica conexão a cada 15s, renova o QR após 3 tentativas
  useEffect(() => {
    if (!qrDialogOpen || qrStatus === 'done' || qrStatus === 'error' || qrStatus === 'configuring' || qrStatus === 'connected') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (qrStatus === 'showing') {
      pollingRef.current = setInterval(async () => {
        try {
          const headers = await authHeaders();
          const res = await fetch(statusFnUrl, { headers });
          const data = await res.json();
          if (data?.connected) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setQrStatus('connected');
            await configureWebhook();
            return;
          }
        } catch {
          // ignora e conta tentativa
        }
        setQrAttempts(prev => {
          const next = prev + 1;
          if (next >= 3) {
            fetchQrCode();
            return 0;
          }
          return next;
        });
      }, 15000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [qrDialogOpen, qrStatus, authHeaders, statusFnUrl, configureWebhook, fetchQrCode]);

  // Quando o fluxo de QR termina, atualiza o badge de status
  useEffect(() => {
    if (qrStatus === 'done') {
      refreshStatus();
    }
  }, [qrStatus, refreshStatus]);

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

  if (!isSuperAdmin) return null;

  return (
    <>
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
              {credentialsBlocked && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs space-y-1">
                    <p className="font-semibold">⛔ Credenciais UAZAPI inválidas — conexão bloqueada</p>
                    {credentialsDiagnostic.tokenLooksLikeUrl ? (
                      <p>
                        Você colou uma <strong>URL</strong> no lugar do <strong>Instance Token</strong>.
                        Cole apenas o token (UUID, ex.: <code>0e93a34d-37d9-4c40-9ec5-8b465f3b8a03</code>).
                      </p>
                    ) : credentialsDiagnostic.tokenLooksLikeInstanceId ? (
                      <p>
                        O <strong>Token da instância</strong> está com o mesmo valor do <strong>ID da instância</strong>.
                        Copie o campo "Token" correto no painel UAZAPI.
                      </p>
                    ) : (
                      <p>
                        O <strong>Instance Token</strong> da UAZAPI tem{' '}
                        <strong>{credentialsDiagnostic.tokenLength} caracteres</strong>. Esperado:{' '}
                        {credentialsDiagnostic.expectedTokenLength ?? 'UUID com ~36 caracteres'}.
                      </p>
                    )}
                    <p className="pt-1">
                      No painel UAZAPI, copie o <strong>Instance Token</strong> da instância conectada
                      e cole no campo abaixo.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

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

              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-muted-foreground">Status:</span>
                {status === 'connected' && (
                  <Badge className="bg-green-600 hover:bg-green-600">
                    conectada
                    {instanceInfo.name ? ` — ${instanceInfo.name}` : ''}
                    {instanceInfo.phone ? ` (${instanceInfo.phone})` : ''}
                  </Badge>
                )}
                {status === 'disconnected' && <Badge variant="destructive">desconectada</Badge>}
                {status === 'error' && <Badge variant="outline">{statusMessage || 'não foi possível verificar'}</Badge>}
                {status === 'unknown' && <Badge variant="outline">verificando...</Badge>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={refreshStatus}
                  disabled={checking}
                  title="Atualizar status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  onClick={startQrFlow}
                  disabled={credentialsBlocked}
                  className="border-green-600/30 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                  title={credentialsBlocked ? 'Corrija o Token da instância antes de conectar' : undefined}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Conectar WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReconnectDialogOpen(true)}
                  disabled={credentialsBlocked}
                  title={
                    credentialsBlocked
                      ? 'Corrija o Token da instância antes de reconectar'
                      : 'Desconectar a sessão atual e escanear o QR do novo número'
                  }
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Trocar número / Reconectar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={(open) => {
        setQrDialogOpen(open);
        if (!open) {
          setQrImageBase64(null);
          setQrStatus('loading');
          setQrAttempts(0);
          setQrMessage('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WhatsAppIcon className="h-5 w-5 text-green-600" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com o WhatsApp do celular para conectar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {(qrStatus === 'loading' || qrLoading) && (
              <div className="flex flex-col items-center gap-3 py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}

            {qrStatus === 'showing' && qrImageBase64 && (
              <>
                <div className="bg-white p-3 rounded-xl shadow-sm">
                  <img
                    src={qrImageBase64.startsWith('data:') ? qrImageBase64 : `data:image/png;base64,${qrImageBase64}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Aguardando leitura... (atualiza a cada 15s)
                </div>
                <Button variant="outline" size="sm" onClick={fetchQrCode}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Gerar novo QR Code
                </Button>
              </>
            )}

            {qrStatus === 'configuring' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Wifi className="h-8 w-8 animate-pulse text-green-600" />
                <p className="text-sm font-medium text-green-700">WhatsApp conectado!</p>
                <p className="text-xs text-muted-foreground">Configurando webhook automaticamente...</p>
              </div>
            )}

            {qrStatus === 'done' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle className="h-10 w-10 text-green-600" />
                <p className="text-sm font-medium text-center">{qrMessage}</p>
                <Button size="sm" onClick={() => setQrDialogOpen(false)}>
                  Fechar
                </Button>
              </div>
            )}

            {qrStatus === 'error' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <XCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-center text-muted-foreground">{qrMessage}</p>
                <Button variant="outline" size="sm" onClick={fetchQrCode}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={reconnectDialogOpen}
        onOpenChange={(open) => !reconnecting && setReconnectDialogOpen(open)}
        title="Trocar número de WhatsApp?"
        description="A sessão atual será encerrada na UAZAPI. Em seguida, abriremos o QR Code para você escanear com o novo número/aparelho. Os mapeamentos de grupos existentes continuam válidos para grupos cujo ID não mudou; grupos novos precisarão ser remapeados."
        confirmText="Desconectar e reconectar"
        cancelText="Cancelar"
        variant="destructive"
        isLoading={reconnecting}
        onConfirm={handleReconnect}
      />
    </>
  );
}
