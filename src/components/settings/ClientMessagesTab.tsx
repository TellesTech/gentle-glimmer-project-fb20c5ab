import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/loose-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, MessageSquare, Pencil, RefreshCw, History, Search } from 'lucide-react';
import { toast } from 'sonner';

interface ClientMessage {
  id: string;
  channel: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  content: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  edited_at: string | null;
  created_at: string;
}

interface EditRow {
  id: string;
  previous_content: string;
  new_content: string;
  created_at: string;
}

const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  sent: { label: 'Enviada', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
  draft: { label: 'Rascunho', variant: 'secondary' },
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function ClientMessagesTab({ canEdit = true }: { canEdit?: boolean }) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ClientMessage | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<EditRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_messages')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Não foi possível carregar as mensagens');
    setMessages((data as ClientMessage[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) =>
      [m.recipient_name, m.recipient_email, m.recipient_phone, m.content]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [messages, search]);

  const openEdit = (m: ClientMessage) => {
    setEditing(m);
    setDraft(m.content);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('client_messages')
      .update({ content: draft })
      .eq('id', editing.id);
    setSaving(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(error.message || 'Não foi possível salvar a edição');
      return;
    }
    toast.success('Mensagem atualizada');
    setEditing(null);
    load();
  };

  const openHistory = async (m: ClientMessage) => {
    const { data } = await supabase
      .from('client_message_edits')
      .select('id, previous_content, new_content, created_at')
      .eq('message_id', m.id)
      .order('created_at', { ascending: false });
    setHistory((data as EditRow[]) || []);
    setHistoryOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Mensagens enviadas aos clientes
          </CardTitle>
          <CardDescription>
            Visualize o histórico de mensagens do portal e edite o conteúdo quando necessário.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por destinatário, telefone ou conteúdo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma mensagem registrada até o momento.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => {
              const st = statusLabel[m.status] || { label: m.status, variant: 'secondary' as const };
              return (
                <div key={m.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.recipient_name || m.recipient_email || m.recipient_phone || 'Destinatário'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(m.sent_at || m.created_at)}
                        {m.recipient_phone ? ` • ${m.recipient_phone}` : ''}
                        {m.recipient_email ? ` • ${m.recipient_email}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <Badge variant="outline" className="uppercase text-[10px]">{m.channel}</Badge>
                      {m.edited_at && (
                        <Badge variant="secondary" className="text-[10px]">editada</Badge>
                      )}
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground font-sans max-h-32 overflow-hidden">
                    {m.content}
                  </pre>
                  {m.error_message && (
                    <p className="text-xs text-destructive">{m.error_message}</p>
                  )}
                  <div className="flex gap-2">
                    {canEdit && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openHistory(m)}>
                      <History className="h-3.5 w-3.5 mr-1.5" /> Histórico
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o && !saving) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
            <DialogDescription>
              A alteração é registrada no histórico de edições da mensagem.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={saving || !draft.trim() || draft === editing?.content}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar edição</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja salvar o novo conteúdo desta mensagem? A versão anterior ficará registrada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); saveEdit(); }} disabled={saving}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de edições</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma edição registrada.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="rounded-md border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">{formatDate(h.created_at)}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">Antes</p>
                  <pre className="whitespace-pre-wrap break-words text-xs font-sans">{h.previous_content}</pre>
                  <p className="text-[11px] font-medium text-muted-foreground">Depois</p>
                  <pre className="whitespace-pre-wrap break-words text-xs font-sans">{h.new_content}</pre>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}