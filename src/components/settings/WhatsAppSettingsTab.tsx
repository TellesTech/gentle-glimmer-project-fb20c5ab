import { useState, useEffect, useRef, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Search, ArrowUpRight, QrCode, Wifi } from 'lucide-react';
import { WhatsAppIcon } from '@/components/shared/WhatsAppIcon';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function WhatsAppSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'loading' | 'connected' | 'disconnected' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [credentialsDiagnostic, setCredentialsDiagnostic] = useState<null | {
    credentialsValid: boolean;
    tokenLooksLikeInstanceId: boolean;
    tokenLooksLikeUrl?: boolean;
    tokenLengthInvalid: boolean;
    tokenLength: number;
    expectedTokenLength: number | string;
    instanceIdLength: number;
  }>(null);
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string }[]>([]);

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

  const getAuthHeaders = useCallback(async () => {
    const session = await (supabase as any).auth.getSession();
    return {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${session.data.session?.access_token}`,
    };
  }, []);

  const edgeFnUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/uazapi-status`;

  // Fetch QR Code
  const fetchQrCode = useCallback(async () => {
    try {
      setQrLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${edgeFnUrl}?action=qr-code`, { headers });
      const data = await res.json();
      if (data?.connected) {
        // Already connected — skip QR, configure webhook
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
  }, [getAuthHeaders, edgeFnUrl]);

  // Check status (polling)
  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(edgeFnUrl, { headers });
      const data = await res.json();
      return !!data?.connected;
    } catch {
      return false;
    }
  }, [getAuthHeaders, edgeFnUrl]);

  // Configure webhook automatically
  const configureWebhook = useCallback(async () => {
    try {
      setQrStatus('configuring');
      setQrMessage('Configurando webhook automaticamente...');
      const headers = await getAuthHeaders();
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setQrStatus('done');
        setQrMessage('WhatsApp conectado e webhook configurado com sucesso!');
        setConnectionStatus('connected');
        setConnectionMessage('Instância online e webhook configurado');
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
  }, [getAuthHeaders, edgeFnUrl, toast]);

  // Start QR Code flow
  const startQrFlow = useCallback(async () => {
    setQrDialogOpen(true);
    setQrStatus('loading');
    setQrAttempts(0);
    setQrMessage('');
    setQrImageBase64(null);
    await fetchQrCode();
  }, [fetchQrCode]);

  // Disconnect current WhatsApp session then immediately start QR flow for the new number
  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${edgeFnUrl}?action=disconnect`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.result?.error || 'Falha ao desconectar a instância');
      }
      setConnectionStatus('disconnected');
      setConnectionMessage('Instância desconectada — escaneie o QR Code para reconectar');
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
  }, [getAuthHeaders, edgeFnUrl, startQrFlow, toast]);

  // Polling effect
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
        const connected = await checkStatus();
        if (connected) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setQrStatus('connected');
          await configureWebhook();
        } else {
          setQrAttempts(prev => {
            const next = prev + 1;
            if (next >= 3) {
              // Refresh QR after 3 attempts
              fetchQrCode();
              return 0;
            }
            return next;
          });
        }
      }, 15000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [qrDialogOpen, qrStatus, checkStatus, configureWebhook, fetchQrCode]);

  // When QR flow finishes successfully, refresh the connection badge
  useEffect(() => {
    if (qrStatus === 'done') {
      testConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrStatus]);

  // Auto-run diagnostic on mount
  useEffect(() => {
    testConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch sites for the dropdown
  const { data: sites } = useQuery({
    queryKey: ['sites-for-whatsapp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, companies(name)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch mappings
  const { data: mappings, isLoading: loadingMappings } = useQuery({
    queryKey: ['whatsapp-group-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_group_projects')
        .select('*, sites(name, companies(name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent logs
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['whatsapp-rdo-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_rdo_logs')
        .select('*')
        .not('group_id', 'is', null)
        .not('group_id', 'ilike', '%@s.whatsapp.net')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Fetch orphan groups (groups with messages but no mapping in last 30 days)
  const { data: orphanGroups, isLoading: loadingOrphans } = useQuery({
    queryKey: ['whatsapp-orphan-groups', mappings?.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_rdo_logs')
        .select('group_id, sender_name, status, created_at')
        .not('group_id', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const mappedSet = new Set((mappings || []).map((m: any) => m.group_id));
      const agg = new Map<string, { group_id: string; total: number; expired: number; error: number; last_at: string; last_sender: string }>();
      (data || []).forEach((row: any) => {
        const gid = row.group_id;
        if (!gid || mappedSet.has(gid)) return;
        const cur = agg.get(gid) || { group_id: gid, total: 0, expired: 0, error: 0, last_at: row.created_at, last_sender: row.sender_name || '' };
        cur.total += 1;
        if (row.status === 'expired') cur.expired += 1;
        if (row.status === 'error') cur.error += 1;
        if (row.created_at > cur.last_at) {
          cur.last_at = row.created_at;
          cur.last_sender = row.sender_name || cur.last_sender;
        }
        agg.set(gid, cur);
      });
      return Array.from(agg.values()).sort((a, b) => b.total - a.total);
    },
    enabled: !!mappings,
    refetchInterval: 60000,
  });

  // Add mapping
  const addMapping = useMutation({
    mutationFn: async () => {
      if (!newGroupId || !selectedSiteId) throw new Error('Preencha todos os campos');
      // Canonical group_id: only the numeric JID prefix (no "@g.us", no legacy "-group")
      const canonicalGroupId = newGroupId
        .trim()
        .replace(/@g\.us$/i, '')
        .replace(/-group$/i, '');
      const { error } = await supabase.from('whatsapp_group_projects').upsert({
        group_id: canonicalGroupId,
        group_name: newGroupName || null,
        site_id: selectedSiteId,
      } as any, { onConflict: 'group_id' });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: 'Mapeamento salvo' });
      setNewGroupId('');
      setNewGroupName('');
      setSelectedSiteId('');
      await queryClient.refetchQueries({ queryKey: ['whatsapp-group-mappings'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mapping
  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_group_projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Mapeamento removido' });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-group-mappings'] });
    },
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'ignored': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'success': return 'Sucesso';
      case 'error': return 'Erro';
      case 'processing': return 'Processando';
      case 'ignored': return 'Ignorada';
      default: return 'Pendente';
    }
  };

  const testConnection = async () => {
    setConnectionStatus('loading');
    setConnectionMessage('');
    try {
      const session = await (supabase as any).auth.getSession();
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/uazapi-status`,
        {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
        }
      );
      const data = await res.json();
      if (data?.diagnostics) setCredentialsDiagnostic(data.diagnostics);
      if (!res.ok) throw new Error(data.error || 'Erro ao verificar conexão');
      if (data?.diagnostics && !data.diagnostics.credentialsValid) {
        setConnectionStatus('error');
        let reason: string;
        if (data.diagnostics.tokenLooksLikeInstanceId) {
          reason = 'O Token da instância está com o mesmo valor do ID da instância';
        } else if (data.diagnostics.tokenLooksLikeUrl) {
          reason = 'Você colou a "API da instância" (URL completa) no lugar do Token da instância';
        } else {
          reason = `O Token da instância tem ${data.diagnostics.tokenLength} caracteres (esperado ${data.diagnostics.expectedTokenLength ?? '23 ou 24'})`;
        }
        setConnectionMessage(`Credenciais inválidas: ${reason}`);
        return;
      }
      if (data?.connected) {
        setConnectionStatus('connected');
        setConnectionMessage(data?.smartPhoneConnected ? 'Instância online e celular conectado' : 'Instância online');
      } else if (data?.error) {
        setConnectionStatus('error');
        setConnectionMessage(data.error);
      } else {
        setConnectionStatus('disconnected');
        setConnectionMessage('Instância desconectada ou celular offline');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err.message || 'Erro ao verificar conexão');
    }
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    setGroupsDialogOpen(true);
    try {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/uazapi-status?action=list-groups`,
        { headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Authorization': `Bearer ${(await (supabase as any).auth.getSession()).data.session?.access_token}` } }
      );
      const result = await res.json();
      setAvailableGroups(result.groups || []);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingGroups(false);
    }
  };

  const useGroupFromLog = (groupId: string, groupName?: string) => {
    setNewGroupId(groupId);
    if (groupName) setNewGroupName(groupName);
    toast({ title: 'ID copiado para o formulário acima' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const mappedGroupIds = new Set(mappings?.map((m: any) => m.group_id) || []);

  const webhookUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/uazapi-webhook`;

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5 text-green-600" />
            <CardTitle>WhatsApp → RDO</CardTitle>
          </div>
          <CardDescription>
            Configure a integração UAZAPI (chatwees.uazapi.com) para receber RDOs automaticamente via WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-warning/30 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs text-foreground">
              Configure o <strong>Instance Token</strong> da UAZAPI (secret <code>UAZAPI_TOKEN</code>) para ativar a integração. O webhook é configurado automaticamente ao conectar.
            </AlertDescription>
          </Alert>

          {credentialsDiagnostic && !credentialsDiagnostic.credentialsValid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-1">
                <p className="font-semibold">⛔ Credenciais UAZAPI inválidas — conexão bloqueada</p>
                {credentialsDiagnostic.tokenLooksLikeUrl ? (
                  <p>
                    Você colou uma <strong>URL</strong> no lugar do <strong>Instance Token</strong>.
                    Cole apenas o token (UUID, ex.: <code>0e93a34d-37d9-4c40-9ec5-8b465f3b8a03</code>).
                  </p>
                ) : (
                  <p>
                    O <strong>Instance Token</strong> da UAZAPI tem{' '}
                    <strong>{credentialsDiagnostic.tokenLength} caracteres</strong>. Esperado: UUID
                    com ~36 caracteres.
                  </p>
                )}
                <p className="pt-1">
                  No painel UAZAPI, copie o <strong>Instance Token</strong> da instância conectada
                  e atualize o secret <code>UAZAPI_TOKEN</code>.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Test Connection */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={connectionStatus === 'loading'}
            >
              {connectionStatus === 'loading' ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Testar Conexão
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={startQrFlow}
              disabled={!!credentialsDiagnostic && !credentialsDiagnostic.credentialsValid}
              className="border-green-600/30 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
              title={
                credentialsDiagnostic && !credentialsDiagnostic.credentialsValid
                  ? 'Corrija o Token da instância antes de conectar'
                  : undefined
              }
            >
              <QrCode className="h-4 w-4 mr-1" />
              Conectar WhatsApp
            </Button>
            {connectionStatus === 'connected' && (
              <Badge variant="default" className="bg-green-600 text-white text-xs">
                ✅ {connectionMessage}
              </Badge>
            )}
            {connectionStatus === 'disconnected' && (
              <Badge variant="destructive" className="text-xs">
                ❌ {connectionMessage}
              </Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="destructive" className="text-xs">
                ⚠️ {connectionMessage}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Group Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamento Grupo → Unidade</CardTitle>
          <CardDescription>Associe grupos do WhatsApp a unidades (sites) do sistema. O projeto ativo da unidade será usado automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="single" collapsible>
            <AccordionItem value="instructions" className="border rounded-lg px-3">
              <AccordionTrigger className="text-xs font-medium py-2 hover:no-underline">
                📖 Como conectar?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-2 pb-3">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Acesse o painel da <strong>UAZAPI</strong> (chatwees.uazapi.com) → sua instância</li>
                  <li>Clique em <strong>"Conectar WhatsApp"</strong> acima para escanear o QR Code — o webhook é configurado automaticamente</li>
                  <li>Use o botão <strong>"Buscar Grupos"</strong> abaixo para listar grupos do WhatsApp e selecionar</li>
                  <li>Ou cole o ID do grupo (formato <code className="bg-muted px-1 rounded">5511999…@g.us</code>) no campo "ID do Grupo"</li>
                  <li>Selecione a unidade correspondente e clique em <strong>"Adicionar"</strong></li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">ID do Grupo</Label>
              <Input
                placeholder="Ex: 5511999999999-1234567890@g.us"
                value={newGroupId}
                onChange={(e) => setNewGroupId(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Nome do Grupo</Label>
              <Input
                placeholder="Ex: Obra ABC"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  {sites?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} {s.companies?.name ? `(${s.companies.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => addMapping.mutate()}
              disabled={addMapping.isPending || !newGroupId || !selectedSiteId}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGroups}
              disabled={loadingGroups}
            >
              {loadingGroups ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Buscar Grupos
            </Button>
          </div>

          {loadingMappings ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : mappings?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Grupo</TableHead>
                  <TableHead className="text-xs">Unidade</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">
                      <div>
                        <p className="font-medium">{m.group_name || 'Sem nome'}</p>
                        <p className="text-muted-foreground font-mono text-[10px]">{m.group_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>
                        <p>{m.sites?.name || '-'}</p>
                        {m.sites?.companies?.name && (
                          <p className="text-muted-foreground text-[10px]">{m.sites.companies.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {m.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteId(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum mapeamento configurado
            </p>
          )}
        </CardContent>
       </Card>

       {/* Orphan Groups */}
       {orphanGroups && orphanGroups.length > 0 && (
         <Card className="border-warning/50 bg-warning/5">
           <CardHeader>
             <CardTitle className="text-base flex items-center gap-2">
               <AlertCircle className="h-5 w-5 text-warning" />
               Grupos Órfãos
             </CardTitle>
             <CardDescription>
               Grupos com mensagens recebidas mas não vinculados a nenhuma unidade. Vincule-os ou ignore-os para melhorar a qualidade do roteamento.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
               {orphanGroups.map((og: any) => (
                 <div key={og.group_id} className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-background">
                   <div className="flex-1 min-w-0">
                     <p className="font-medium text-sm">Grupo ID: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono break-all">{og.group_id}</code></p>
                     <p className="text-xs text-muted-foreground mt-1">
                       {og.total} mensagens • {og.expired} expiradas • {og.error} erros • Último: {og.last_sender}
                     </p>
                     <p className="text-[11px] text-muted-foreground">
                       Última atividade: {format(new Date(og.last_at), 'dd/MM HH:mm', { locale: ptBR })}
                     </p>
                   </div>
                   <div className="flex gap-2 flex-shrink-0">
                     <Button
                       variant="outline"
                       size="sm"
                       className="text-xs h-8"
                       onClick={() => {
                         setNewGroupId(og.group_id);
                         window.scrollTo({ top: 0, behavior: 'smooth' });
                         toast({ title: 'ID do grupo copiado para o formulário acima' });
                       }}
                     >
                       Vincular
                     </Button>
                   </div>
                 </div>
               ))}
             </div>
           </CardContent>
         </Card>
       )}

       
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Log de Mensagens</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['whatsapp-rdo-logs'] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : logs?.length ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {logs.map((log: any) => {
                const gid: string | null = log.group_id || null;
                const mapping = gid
                  ? (mappings || []).find((m: any) => {
                      const canon = (gid || '')
                        .replace(/@g\.us$/i, '')
                        .replace(/-group$/i, '');
                      return m.group_id === gid || m.group_id === canon;
                    })
                  : null;
                const groupName = mapping?.group_name as string | undefined;
                const siteName = mapping?.sites?.name as string | undefined;
                const companyName = mapping?.sites?.companies?.name as string | undefined;
                return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-2 rounded-lg border text-xs"
                >
                  {statusIcon(log.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{log.sender_name || log.sender_phone || '?'}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {statusLabel(log.status)}
                      </Badge>
                      {mapping && (
                        <Badge className="text-[10px]">Grupo mapeado</Badge>
                      )}
                      {!mapping && (
                        <Badge variant="destructive" className="text-[10px]">Grupo não mapeado</Badge>
                      )}
                    </div>
                    {mapping && (
                      <div className="mt-0.5">
                        <span className="font-medium">{groupName || 'Grupo sem nome'}</span>
                        {(siteName || companyName) && (
                          <span className="text-muted-foreground">
                            {' · '}
                            {siteName}
                            {companyName ? ` — ${companyName}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                    {gid && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-muted-foreground font-mono text-[10px] truncate">{gid}</span>
                        {!mapping && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={() => useGroupFromLog(gid!, log.sender_name)}
                          >
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                            Usar
                          </Button>
                        )}
                      </div>
                    )}
                    {log.error_message && (
                      <p className="text-destructive truncate">{log.error_message}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground text-[10px] shrink-0">
                    {log.created_at
                      ? format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })
                      : ''}
                  </span>
                </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mensagem processada ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Groups Search Dialog */}
      <Dialog open={groupsDialogOpen} onOpenChange={setGroupsDialogOpen}>
        <DialogContent className="max-w-md max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Grupos do WhatsApp</DialogTitle>
          </DialogHeader>
          {loadingGroups ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando grupos...</span>
            </div>
          ) : availableGroups.length ? (
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {availableGroups.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded-lg border text-xs hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{g.name}</p>
                    <p className="text-muted-foreground font-mono text-[10px] truncate">{g.id}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] ml-2 shrink-0"
                    onClick={() => {
                      setNewGroupId(g.id);
                      setNewGroupName(g.name);
                      setGroupsDialogOpen(false);
                      toast({ title: 'Grupo selecionado' });
                    }}
                  >
                    Selecionar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum grupo encontrado</p>
          )}
        </DialogContent>
      </Dialog>

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
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Remover mapeamento"
        description="Tem certeza que deseja remover este mapeamento? Mensagens deste grupo não serão mais processadas."
        onConfirm={() => deleteId && deleteMapping.mutate(deleteId)}
      />
    </div>
  );
}
