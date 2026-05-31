import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Plus, Trash2, Pencil, Clock, Database, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface UnifiedDelay {
  id: string;
  activity_name: string;
  date: string;
  reason: string | null;
  description: string | null;
  delay_hours_display: string; // HH:MM
  delay_hours_decimal: number; // for totals
  source: 'rdo' | 'manual';
  raw_hours?: string; // Original interval string for RDOs
}

const DELAY_TYPES = [
  { value: 'clima', label: 'Clima' },
  { value: 'material', label: 'Material' },
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'mao_de_obra', label: 'Mão de Obra' },
  { value: 'logistica', label: 'Logística' },
  { value: 'outro', label: 'Outro' },
];

interface Props {
  startDate: string;
  endDate: string;
  projectId: string;
  companyId: string | null;
  projects: { id: string; name: string }[];
}

/** Convert interval string "HH:MM:SS" or "HH:MM" to { display, decimal } */
function parseInterval(interval: string | null | undefined): { display: string; decimal: number } {
  if (!interval || interval === '00:00:00' || interval === '00:00') return { display: '00:00', decimal: 0 };
  const parts = interval.toString().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  if (h === 0 && m === 0) return { display: '00:00', decimal: 0 };
  return {
    display: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
    decimal: h + m / 60,
  };
}

const formatHHMM = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const DEVIATION_TYPES = [
  { hoursKey: 'operational_deviation_hours', detailsKey: 'operational_deviation_details', reasonKey: 'operational_deviation_reason', label: 'Operacional' },
  { hoursKey: 'climatic_deviation_hours', detailsKey: 'climatic_deviation_details', reasonKey: 'climatic_deviation_reason', label: 'Climático' },
  { hoursKey: 'amt_deviation_hours', detailsKey: 'amt_deviation_details', reasonKey: 'amt_deviation_reason', label: 'AMT' },
] as const;

export function WorkforceDelaysTab({ startDate, endDate, projectId, companyId, projects }: Props) {
  const { toast } = useToast();
  const [delays, setDelays] = useState<UnifiedDelay[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<UnifiedDelay | null>(null);
  const [form, setForm] = useState({ activity_name: '', date: format(new Date(), 'yyyy-MM-dd'), description: '', delay_type: 'outro', delay_hours: '', project_id: projectId !== 'all' ? projectId : '' });
  const [editForm, setEditForm] = useState({ reason: '', description: '', hours: '00:00' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadDelays(); }, [startDate, endDate, projectId]);

  const loadDelays = async () => {
    setLoading(true);
    const rdoDelays: UnifiedDelay[] = [];
    const manualDelays: UnifiedDelay[] = [];

    try {
      // 1) Load RDO deviations from reports with PAGINATION
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let rQuery = supabase
          .from('reports')
          .select(`
            id, date, project_id,
            operational_deviation_hours, operational_deviation_details, operational_deviation_reason,
            climatic_deviation_hours, climatic_deviation_details, climatic_deviation_reason,
            amt_deviation_hours, amt_deviation_details, amt_deviation_reason,
            report_activities(description),
            projects(name)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(from, from + pageSize - 1);

        if (projectId !== 'all') rQuery = rQuery.eq('project_id', projectId);
        
        const { data: reports, error } = await rQuery;
        if (error || !reports || reports.length === 0) break;

        for (const r of reports) {
          const activities = (r.report_activities as any[])?.map((a: any) => a.description).filter(Boolean) || [];
          const activityLabel = activities.length > 0
            ? activities.join(', ')
            : (r.projects as any)?.name || 'Sem atividade';

          for (const dt of DEVIATION_TYPES) {
            const hoursRaw = (r as any)[dt.hoursKey];
            const details = (r as any)[dt.detailsKey];
            const reason = (r as any)[dt.reasonKey];
            const parsed = parseInterval(hoursRaw);

            if (parsed.decimal > 0 || (details && details.trim())) {
              rdoDelays.push({
                id: `rdo-${r.id}-${dt.label}`,
                activity_name: activityLabel,
                date: r.date as string,
                reason: reason || dt.label,
                description: details || null,
                delay_hours_display: parsed.display,
                delay_hours_decimal: parsed.decimal,
                source: 'rdo',
                raw_hours: hoursRaw || '00:00:00'
              });
            }
          }
        }

        if (reports.length < pageSize) hasMore = false;
        from += pageSize;
      }

      // 2) Load manual delays from workforce_delays with PAGINATION
      from = 0;
      hasMore = true;
      while (hasMore) {
        let mQuery = supabase.from('workforce_delays').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }).range(from, from + pageSize - 1);
        if (projectId !== 'all') mQuery = mQuery.eq('project_id', projectId);
        
        const { data: manualData, error } = await mQuery;
        if (error || !manualData || manualData.length === 0) break;

        manualDelays.push(...manualData.map((d: any) => ({
          id: d.id,
          activity_name: d.activity_name,
          date: d.date,
          reason: DELAY_TYPES.find(t => t.value === d.delay_type)?.label || d.delay_type || 'Outro',
          description: d.description || null,
          delay_hours_display: formatHHMM(d.delay_hours),
          delay_hours_decimal: d.delay_hours,
          source: 'manual' as const,
        })));

        if (manualData.length < pageSize) hasMore = false;
        from += pageSize;
      }

      // 3) Merge and sort by date desc
      const all = [...rdoDelays, ...manualDelays].sort((a, b) => b.date.localeCompare(a.date));
      setDelays(all);
    } catch (err) {
      console.error('Error loading delays:', err);
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.activity_name || !form.delay_hours) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('workforce_delays').insert({
      activity_name: form.activity_name,
      date: form.date,
      description: form.description || null,
      delay_type: form.delay_type as any,
      delay_hours: parseFloat(form.delay_hours.replace(',', '.')),
      project_id: form.project_id || null,
      company_id: companyId,
    });
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atraso registrado' });
      setDialogOpen(false);
      setForm({ activity_name: '', date: format(new Date(), 'yyyy-MM-dd'), description: '', delay_type: 'outro', delay_hours: '', project_id: projectId !== 'all' ? projectId : '' });
      loadDelays();
    }
    setSaving(false);
  };

  const handleEdit = (delay: UnifiedDelay) => {
    setEditTarget(delay);
    let reason = delay.reason || '';
    let description = delay.description || '';

    // Se for originado de RDO, extrair motivo e descrição reais do marcador [RDO]
    if (delay.source === 'manual' && delay.description?.startsWith('[RDO]')) {
      const cleanDesc = delay.description.replace('[RDO] ', '');
      const parts = cleanDesc.split(': ');
      reason = parts[0] || '';
      description = parts.slice(1).join(': ') || '';
    }

    setEditForm({
      reason,
      description,
      hours: delay.delay_hours_display
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setSaving(true);

    try {
      if (editTarget.source === 'manual') {
        const decimalHours = parseInterval(editForm.hours + ':00').decimal;
        
        let updateData: any = {
          description: editForm.description,
          delay_hours: decimalHours
        };

        // Se for um atraso originado do RDO (marcador [RDO]), o "Motivo" fica na descrição
        if (editTarget.description?.startsWith('[RDO]')) {
          updateData.description = `[RDO] ${editForm.reason}${editForm.description ? ': ' + editForm.description : ''}`;
        } else {
          // Tenta mapear o motivo para um tipo conhecido, senão mantém na descrição
          const mappedType = DELAY_TYPES.find(t => t.label.toLowerCase() === editForm.reason.toLowerCase())?.value || 'outro';
          updateData.delay_type = mappedType as any;
        }
        
        const { error } = await supabase
          .from('workforce_delays')
          .update(updateData)
          .eq('id', editTarget.id);

        if (error) throw error;
      } else {
        // RDO update
        const reportId = editTarget.id.split('-')[1];
        const label = editTarget.id.split('-')[2]; // Operacional, Climático, AMT
        const dt = DEVIATION_TYPES.find(t => t.label === label);
        
        if (dt) {
          const updateData: any = {};
          updateData[dt.hoursKey] = editForm.hours + ':00';
          updateData[dt.reasonKey] = editForm.reason;
          updateData[dt.detailsKey] = editForm.description;

          const { error } = await supabase
            .from('reports')
            .update(updateData)
            .eq('id', reportId);

          if (error) throw error;
        }
      }

      toast({ title: 'Atraso atualizado com sucesso' });
      setEditDialogOpen(false);
      loadDelays();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('workforce_delays').delete().eq('id', deleteTarget);
    if (!error) {
      setDelays(prev => prev.filter(d => d.id !== deleteTarget));
      toast({ title: 'Atraso excluído' });
    }
    setDeleteTarget(null);
  };

  const totalLost = delays.reduce((s, d) => s + d.delay_hours_decimal, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> {delays.length} atrasos</Badge>
          {totalLost > 0 && <Badge variant="destructive">{formatHHMM(totalLost)} perdidas</Badge>}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Atraso</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Atraso</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Atividade *</Label><Input value={form.activity_name} onChange={e => setForm(f => ({ ...f, activity_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><Label>Horas perdidas *</Label><Input value={form.delay_hours} onChange={e => setForm(f => ({ ...f, delay_hours: e.target.value }))} placeholder="Ex: 2.5" /></div>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.delay_type} onValueChange={v => setForm(f => ({ ...f, delay_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DELAY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Descrição do Atraso</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : delays.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum atraso registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table className="table-fixed text-xs">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead className="font-bold w-[20%]">ATIVIDADE</TableHead>
                    <TableHead className="font-bold w-[12%]">DATA</TableHead>
                    <TableHead className="font-bold w-[20%]">MOTIVO</TableHead>
                    <TableHead className="font-bold w-[30%]">DESCRIÇÃO</TableHead>
                    <TableHead className="font-bold text-center w-[12%]">TEMPO</TableHead>
                    <TableHead className="w-[6%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delays.map(d => (
                    <TableRow key={d.id} className={d.source === 'rdo' ? 'bg-blue-500/5' : ''}>
                      <TableCell className="font-medium">
                        {d.activity_name?.toUpperCase()}
                        {d.source === 'rdo' && <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">RDO</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(d.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium text-muted-foreground">{d.reason || '—'}</TableCell>
                      <TableCell className="text-muted-foreground break-words">{d.description || '—'}</TableCell>
                      <TableCell className="text-center font-mono font-medium text-destructive">{d.delay_hours_display}</TableCell>
                      <TableCell className="p-1">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {d.source === 'manual' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(d.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot className="sticky bottom-0 bg-muted font-bold">
                  <tr>
                    <td colSpan={4} className="p-2 text-right text-xs">TOTAL</td>
                    <td className="p-2 text-center font-mono text-xs text-destructive">{formatHHMM(totalLost)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Atraso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Atividade</Label>
                <div className="p-2 bg-muted rounded text-xs font-medium uppercase">{editTarget?.activity_name}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Data</Label>
                <div className="p-2 bg-muted rounded text-xs font-medium">{editTarget && format(new Date(editTarget.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Input 
                value={editForm.reason} 
                onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} 
                placeholder="Ex: Quebra de máquina, Chuva forte..."
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição / Detalhes</Label>
              <Textarea 
                value={editForm.description} 
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} 
                rows={3}
                placeholder="Detalhes adicionais sobre o atraso..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tempo (HH:MM) *</Label>
              <Input 
                type="time"
                value={editForm.hours} 
                onChange={e => setEditForm(f => ({ ...f, hours: e.target.value }))} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title="Excluir atraso"
        description="Tem certeza que deseja excluir este atraso?"
        confirmText="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
