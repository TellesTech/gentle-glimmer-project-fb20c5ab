import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/loose-client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { HardHat, Loader2, Plus, Search, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportIds: string[];
  label?: string;
  onMoved?: () => void;
}

export function MoveReportDialog({ open, onOpenChange, reportIds, label, onMoved }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOm, setNewOm] = useState('');
  const [saving, setSaving] = useState(false);

  // Origem: projeto atual do primeiro RDO
  const { data: origin } = useQuery({
    queryKey: ['move-origin', reportIds[0]],
    enabled: open && reportIds.length > 0,
    queryFn: async () => {
      const { data: r } = await supabase.from('reports').select('id, project_id').eq('id', reportIds[0]).maybeSingle();
      if (!r?.project_id) return null;
      const { data: p } = await supabase.from('projects').select('id, name, site_id, company_id').eq('id', r.project_id).maybeSingle();
      if (p && !siteId) setSiteId(p.site_id);
      return p as { id: string; name: string; site_id: string; company_id: string } | null;
    },
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['move-sites'],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from('sites').select('id, name, company_id, companies(name)').order('name');
      return (data || []) as any[];
    },
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['move-projects', siteId],
    enabled: open && !!siteId,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, code, site_id, company_id').eq('site_id', siteId).order('name');
      const list = (data || []) as any[];
      const ids = list.map(p => p.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: reps } = await supabase.from('reports').select('project_id').in('project_id', ids);
        (reps || []).forEach((r: any) => { counts[r.project_id] = (counts[r.project_id] || 0) + 1; });
      }
      return list.map(p => ({ ...p, count: counts[p.id] || 0 }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => p.id !== origin?.id && (!q || `${p.name} ${p.code || ''}`.toLowerCase().includes(q)));
  }, [projects, search, origin]);

  const reset = () => {
    setSiteId(''); setSearch(''); setTargetId(null); setCreating(false); setNewName(''); setNewOm('');
  };

  const handleMove = async () => {
    setSaving(true);
    try {
      let projectId = targetId;
      let targetName = projects.find(p => p.id === targetId)?.name || '';
      const site = sites.find(s => s.id === siteId);
      if (creating) {
        if (!newName.trim() || !site) throw new Error('Informe o nome da atividade.');
        const { data, error } = await supabase.from('projects').insert({
          name: newName.trim(), code: newOm.trim() || null, site_id: site.id, company_id: site.company_id, status: 'in_progress',
        }).select('id, name').single();
        if (error) throw error;
        projectId = data.id; targetName = data.name;
      }
      if (!projectId) throw new Error('Escolha o card de destino.');

      const update: any = { project_id: projectId };
      if (creating) {
        update.maintenance_order_number = newOm.trim() || null;
        update.maintenance_order_title = newName.trim();
      }
      const { data, error } = await supabase.from('reports').update(update).in('id', reportIds).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para mover este(s) RDO(s).');

      await supabase.from('report_history').insert(reportIds.map(id => ({
        report_id: id,
        action: 'moved',
        action_by: user?.id ?? null,
        details: `Movido de "${origin?.name ?? '—'}" para "${targetName}"`,
        old_values: { project_id: origin?.id ?? null },
        new_values: { project_id: projectId },
      })));

      toast.success(`${data.length} RDO(s) movido(s) para "${targetName}"`);
      queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      onMoved?.();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao mover');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = creating ? !!newName.trim() && !!siteId : !!targetId;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Mover {label || `${reportIds.length} RDO(s)`}</DialogTitle>
          <DialogDescription>
            {origin ? <>Card atual: <strong>{origin.name}</strong>. </> : null}Escolha o card de destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Fábrica / unidade</Label>
            <Select value={siteId} onValueChange={(v) => { setSiteId(v); setTargetId(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.companies?.name ? `${s.companies.name} — ` : ''}{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!creating ? (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar atividade ou OM" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                {!isLoading && filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum card encontrado.</p>
                )}
                {filtered.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTargetId(p.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                      targetId === p.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'
                    )}
                  >
                    <HardHat className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.code ? `OM ${p.code} · ` : ''}{p.count} RDO(s)</p>
                    </div>
                    {targetId === p.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => { setCreating(true); setTargetId(null); }} disabled={!siteId}>
                <Plus className="h-4 w-4" /> Criar novo card
              </Button>
            </>
          ) : (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="space-y-1">
                <Label>Nome da atividade</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: CAC" autoFocus />
              </div>
              <div className="space-y-1">
                <Label>Número da OM (opcional)</Label>
                <Input value={newOm} onChange={e => setNewOm(e.target.value)} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Escolher card existente</Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleMove} disabled={!canSubmit || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
