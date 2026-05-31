import { useState } from 'react';
import { Plus, Trash2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ReportFormData } from '@/pages/ReportForm';
import type { Deviation, DeviationType, ImpactLevel } from '@/types';

interface StepDeviationsProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
}

const deviationTypes: { value: DeviationType; label: string }[] = [
  { value: 'weather', label: 'Condições Climáticas' },
  { value: 'materials', label: 'Materiais' },
  { value: 'labor', label: 'Mão de Obra' },
  { value: 'stoppage', label: 'Paralisações' },
  { value: 'equipment', label: 'Equipamentos' },
  { value: 'contractor', label: 'Contratante' },
  { value: 'supplier', label: 'Fornecedores' },
  { value: 'project_design', label: 'Projeto' },
  { value: 'planning', label: 'Planejamento' },
  { value: 'execution', label: 'Execução' },
  { value: 'safety', label: 'Segurança' },
  { value: 'delay', label: 'Atraso' },
  { value: 'other', label: 'Outro' },
];

const impactLevels: { value: ImpactLevel; label: string; icon: typeof Info; color: string }[] = [
  { value: 'low', label: 'Baixo', icon: Info, color: 'text-primary' },
  { value: 'medium', label: 'Médio', icon: AlertCircle, color: 'text-warning' },
  { value: 'high', label: 'Alto', icon: AlertTriangle, color: 'text-destructive' },
];

export function StepDeviations({ data, onChange }: StepDeviationsProps) {
  const [showForm, setShowForm] = useState(false);
  const [newDeviation, setNewDeviation] = useState<Partial<Deviation>>({
    type: 'other',
    impact: 'low',
    resolved: false,
  });

  const addDeviation = () => {
    if (!newDeviation.description?.trim()) return;
    
    const deviation: Deviation = {
      id: `temp-${Date.now()}`,
      reportId: '',
      description: newDeviation.description.trim(),
      type: newDeviation.type as DeviationType,
      impact: newDeviation.impact as ImpactLevel,
      correctiveAction: newDeviation.correctiveAction,
      resolved: false,
    };
    
    onChange({ deviations: [...data.deviations, deviation] });
    setNewDeviation({ type: 'other', impact: 'low', resolved: false });
    setShowForm(false);
  };

  const removeDeviation = (id: string) => {
    onChange({ deviations: data.deviations.filter(d => d.id !== id) });
  };

  const getImpactConfig = (impact: ImpactLevel) => 
    impactLevels.find(l => l.value === impact) || impactLevels[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label>Desvios Encontrados</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Registre desvios de segurança, atrasos ou problemas
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Desvio *</Label>
              <Select
                value={newDeviation.type}
                onValueChange={(v: DeviationType) => setNewDeviation(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deviationTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Impacto *</Label>
              <Select
                value={newDeviation.impact}
                onValueChange={(v: ImpactLevel) => setNewDeviation(prev => ({ ...prev, impact: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {impactLevels.map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      <div className="flex items-center gap-2">
                        <level.icon className={cn('h-4 w-4', level.color)} />
                        {level.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição do Desvio *</Label>
            <Textarea
              value={newDeviation.description || ''}
              onChange={(e) => setNewDeviation(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o desvio encontrado..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Ação Corretiva</Label>
            <Textarea
              value={newDeviation.correctiveAction || ''}
              onChange={(e) => setNewDeviation(prev => ({ ...prev, correctiveAction: e.target.value }))}
              placeholder="Descreva a ação tomada para corrigir..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={addDeviation} disabled={!newDeviation.description?.trim()}>
              Adicionar Desvio
            </Button>
          </div>
        </div>
      )}

      {/* Deviations List */}
      <div className="space-y-3">
        {data.deviations.length === 0 && !showForm ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum desvio registrado</p>
            <p className="text-sm">Isso é bom! Registre se houver algum problema.</p>
          </div>
        ) : (
          data.deviations.map((deviation) => {
            const impactConfig = getImpactConfig(deviation.impact);
            const ImpactIcon = impactConfig.icon;
            
            return (
              <div
                key={deviation.id}
                className="p-4 border rounded-lg space-y-2 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImpactIcon className={cn('h-5 w-5', impactConfig.color)} />
                    <span className="font-medium">{deviation.description}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={() => removeDeviation(deviation.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                <div className="flex gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded-full bg-muted">
                    {deviationTypes.find(t => t.value === deviation.type)?.label}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full',
                    deviation.impact === 'high' ? 'bg-destructive/10 text-destructive' :
                    deviation.impact === 'medium' ? 'bg-warning/10 text-warning' :
                    'bg-primary/10 text-primary'
                  )}>
                    Impacto {impactConfig.label}
                  </span>
                </div>

                {deviation.correctiveAction && (
                  <p className="text-sm text-muted-foreground pl-7">
                    <span className="font-medium">Ação:</span> {deviation.correctiveAction}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
