import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Search, ArrowUpRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Pause, Play } from 'lucide-react';
import { WhatsAppIcon } from '@/components/shared/WhatsAppIcon';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { WhatsAppConnectionSettingsCard } from '@/components/settings/WhatsAppConnectionSettingsCard';


export function WhatsAppSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string }[]>([]);

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

  // Fetch projects (activities) for default-activity selection
  const { data: projectsForDefault } = useQuery({
    queryKey: ['projects-for-whatsapp-default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, site_id, status')
        .not('status', 'in', '("completed","suspended")')
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

  // Default activity for a group (used when the message has no OM/title)
  const setDefaultProject = useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string | null }) => {
      const { error } = await (supabase as any)
        .from('whatsapp_group_projects')
        .update({ project_id: projectId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-group-mappings'] });
      toast({ title: 'Atividade padrão atualizada' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  // Pause/resume automation per unit (group mapping)
  const toggleGroupPause = useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) => {
      const { error } = await (supabase as any)
        .from('whatsapp_group_projects')
        .update({ automation_paused: paused })
        .eq('id', id);
      if (error) throw error;
      return paused;
    },
    onSuccess: (paused) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-group-mappings'] });

      toast({
        title: paused ? 'Automação pausada nesta unidade' : 'Automação reativada nesta unidade',
        description: paused
          ? 'As mensagens desse grupo não gerarão RDOs automaticamente.'
          : 'As mensagens desse grupo voltarão a gerar RDOs.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
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

  

  const { data: waSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['whatsapp-automation-paused'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('system_settings')
        .select('id, whatsapp_automation_paused')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; whatsapp_automation_paused: boolean } | null;
    },
  });

  const automationPaused = !!waSettings?.whatsapp_automation_paused;

  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!waSettings?.id) throw new Error('Configurações do sistema não encontradas');
      const { error } = await (supabase as any)
        .from('system_settings')
        .update({ whatsapp_automation_paused: paused })
        .eq('id', waSettings.id);
      if (error) throw error;
      return paused;
    },
    onSuccess: (paused) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-automation-paused'] });
      toast({
        title: paused ? 'Automação pausada' : 'Automação reativada',
        description: paused
          ? 'Nenhum RDO será criado automaticamente a partir do WhatsApp.'
          : 'As mensagens de RDO voltarão a ser processadas.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const webhookUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/uazapi-webhook`;

  return (
    <div className="space-y-6">
      <WhatsAppConnectionSettingsCard />

      {/* Pausar automação */}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {automationPaused ? <Pause className="h-5 w-5 text-warning" /> : <Play className="h-5 w-5 text-green-600" />}
            <CardTitle>Automação do WhatsApp</CardTitle>
          </div>
          <CardDescription>
            Chave mestra: quando pausada, nenhuma unidade cria RDOs automaticamente. Para pausar apenas
            uma unidade, use o interruptor na lista "Mapeamento Grupo — Unidade" abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="wa-automation-toggle">
                {automationPaused ? 'Automação pausada' : 'Automação ativa'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {automationPaused
                  ? 'As mensagens recebidas serão registradas como ignoradas (pausado).'
                  : 'As mensagens de RDO recebidas serão processadas normalmente.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={automationPaused ? 'destructive' : 'default'}>
                {automationPaused ? 'Pausada' : 'Ativa'}
              </Badge>
              <Switch
                id="wa-automation-toggle"
                checked={!automationPaused}
                disabled={togglePause.isPending || settingsLoading}
                onCheckedChange={(checked) => togglePause.mutate(!checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL — informação estática da integração (conexão gerenciada no card acima) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5 text-green-600" />
            <CardTitle>WhatsApp → RDO</CardTitle>
          </div>
          <CardDescription>
            Integração UAZAPI para receber RDOs automaticamente via WhatsApp. A conexão (status, QR Code e credenciais) é gerenciada no card "Conexão do WhatsApp" acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-xs">URL do Webhook (configurada automaticamente ao conectar)</Label>
          <code className="block text-xs bg-muted px-3 py-2 rounded break-all">{webhookUrl}</code>
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
                <p className="pt-1">
                  Para trocar o número conectado, use <strong>"Trocar número / Reconectar"</strong> — ele encerra a sessão atual e abre o QR Code do novo número automaticamente.
                </p>
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
                  <TableHead className="text-xs">Atividade padrão</TableHead>

                  <TableHead className="text-xs">Automação</TableHead>
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
                    <TableCell className="text-xs">
                      <Select
                        value={m.project_id || 'none'}
                        onValueChange={(v) =>
                          setDefaultProject.mutate({ id: m.id, projectId: v === 'none' ? null : v })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs w-[190px]">
                          <SelectValue placeholder="Sem atividade padrão" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">Sem atividade padrão</SelectItem>
                          {(projectsForDefault || [])
                            .filter((p: any) => p.site_id === m.site_id)
                            .map((p: any) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!automationPaused && !m.automation_paused}
                          disabled={automationPaused || toggleGroupPause.isPending}
                          onCheckedChange={(checked) =>
                            toggleGroupPause.mutate({ id: m.id, paused: !checked })
                          }
                          aria-label="Pausar automação desta unidade"
                        />
                        <Badge
                          variant={automationPaused || m.automation_paused ? 'destructive' : 'default'}
                          className="text-[10px]"
                        >
                          {automationPaused
                            ? 'Pausada pelo global'
                            : m.automation_paused
                              ? 'Pausada'
                              : 'Ativa'}
                        </Badge>
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
