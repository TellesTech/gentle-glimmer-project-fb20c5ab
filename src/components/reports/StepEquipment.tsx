import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Wrench, Clock, Hash } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ReportFormData } from '@/pages/ReportForm';

interface ReportEquipmentItem {
  id: string;
  equipmentId?: string;
  equipmentName: string;
  hoursUsed?: number;
  quantityUsed: number;
  status: string;
  observations?: string;
}

interface StepEquipmentProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
  projectId?: string;
}

const statusOptions = [
  { value: 'operational', label: 'Operacional' },
  { value: 'maintenance', label: 'Em Manutenção' },
  { value: 'idle', label: 'Parado' },
  { value: 'broken', label: 'Quebrado' },
];

export function StepEquipment({ data, onChange, projectId }: StepEquipmentProps) {
  const [showForm, setShowForm] = useState(false);
  const [newEquipment, setNewEquipment] = useState<Partial<ReportEquipmentItem>>({
    equipmentName: '',
    hoursUsed: undefined,
    quantityUsed: 1,
    status: 'operational',
    observations: '',
  });

  // Fetch project equipment for suggestions
  const { data: projectEquipment = [] } = useQuery({
    queryKey: ['project-equipment-list', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Initialize equipment from data if exists
  const equipment: ReportEquipmentItem[] = (data as any).equipment || [];

  const addEquipment = () => {
    if (!newEquipment.equipmentName?.trim()) return;

    const item: ReportEquipmentItem = {
      id: `temp-${Date.now()}`,
      equipmentId: newEquipment.equipmentId,
      equipmentName: newEquipment.equipmentName.trim(),
      hoursUsed: newEquipment.hoursUsed,
      quantityUsed: newEquipment.quantityUsed || 1,
      status: newEquipment.status || 'operational',
      observations: newEquipment.observations,
    };

    onChange({ equipment: [...equipment, item] } as any);
    setNewEquipment({
      equipmentName: '',
      hoursUsed: undefined,
      quantityUsed: 1,
      status: 'operational',
      observations: '',
    });
    setShowForm(false);
  };

  const removeEquipment = (id: string) => {
    onChange({ equipment: equipment.filter(e => e.id !== id) } as any);
  };

  const selectProjectEquipment = (id: string) => {
    const equip = projectEquipment.find(e => e.id === id);
    if (equip) {
      setNewEquipment({
        ...newEquipment,
        equipmentId: equip.id,
        equipmentName: equip.name,
        quantityUsed: 1,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      operational: { label: 'Operacional', className: 'bg-green-100 text-green-700' },
      maintenance: { label: 'Em Manutenção', className: 'bg-warning/10 text-warning' },
      idle: { label: 'Parado', className: 'bg-muted text-muted-foreground' },
      broken: { label: 'Quebrado', className: 'bg-destructive/10 text-destructive' },
    };
    const cfg = config[status] || config.operational;
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label>Equipamentos Utilizados</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Registre os equipamentos e máquinas utilizados no dia
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          {/* Project Equipment Selector */}
          {projectEquipment.length > 0 && (
            <div className="space-y-2">
              <Label>Selecionar do cadastro</Label>
              <Select onValueChange={selectProjectEquipment}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um equipamento cadastrado..." />
                </SelectTrigger>
                <SelectContent>
                  {projectEquipment.map((equip) => (
                    <SelectItem key={equip.id} value={equip.id}>
                      {equip.name} {equip.model && `(${equip.model})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Ou preencha manualmente abaixo</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Equipamento *</Label>
              <Input
                value={newEquipment.equipmentName || ''}
                onChange={(e) => setNewEquipment({ ...newEquipment, equipmentName: e.target.value })}
                placeholder="Ex: Escavadeira CAT 320D"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={newEquipment.status}
                onValueChange={(v) => setNewEquipment({ ...newEquipment, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Horas Trabalhadas</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={newEquipment.hoursUsed || ''}
                onChange={(e) => setNewEquipment({ ...newEquipment, hoursUsed: parseFloat(e.target.value) || undefined })}
                placeholder="Ex: 8"
              />
            </div>

            <div className="space-y-2">
              <Label>Quantidade Utilizada</Label>
              <Input
                type="number"
                min="1"
                value={newEquipment.quantityUsed || 1}
                onChange={(e) => setNewEquipment({ ...newEquipment, quantityUsed: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={newEquipment.observations || ''}
              onChange={(e) => setNewEquipment({ ...newEquipment, observations: e.target.value })}
              placeholder="Ex: Operou sem problemas, necessita troca de óleo..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={addEquipment} disabled={!newEquipment.equipmentName?.trim()}>
              Adicionar Equipamento
            </Button>
          </div>
        </div>
      )}

      {/* Equipment List */}
      <div className="space-y-3">
        {equipment.length === 0 && !showForm ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum equipamento registrado</p>
            <p className="text-sm">Adicione os equipamentos utilizados hoje</p>
          </div>
        ) : (
          equipment.map((item) => (
            <div
              key={item.id}
              className="p-4 border rounded-lg space-y-2 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">{item.equipmentName}</span>
                    <div className="flex gap-2 mt-1">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={() => removeEquipment(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="flex gap-4 text-sm text-muted-foreground pl-13">
                {item.hoursUsed !== undefined && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.hoursUsed}h trabalhadas
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {item.quantityUsed} unid.
                </span>
              </div>

              {item.observations && (
                <p className="text-sm text-muted-foreground pl-13">
                  {item.observations}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
