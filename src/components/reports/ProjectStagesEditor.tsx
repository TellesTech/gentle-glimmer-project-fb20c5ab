import React from 'react';
import { Plus, Trash2, Scale, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ProjectStage {
  id: string;
  name: string;
  weight: number;
  order_index: number;
  total_quantity?: number | null;
  unit?: string | null;
}

const UNIT_OPTIONS = [
  { value: 'm', label: 'm' },
  { value: 'm2', label: 'm²' },
  { value: 'm3', label: 'm³' },
  { value: 'kg', label: 'kg' },
  { value: 'un', label: 'un' },
  { value: 'vb', label: 'vb' },
];

interface ProjectStagesEditorProps {
  stages: ProjectStage[];
  onChange: (stages: ProjectStage[]) => void;
  disabled?: boolean;
}

export function ProjectStagesEditor({
  stages,
  onChange,
  disabled = false,
}: ProjectStagesEditorProps) {
  const addStage = () => {
    const newStage: ProjectStage = {
      id: crypto.randomUUID(),
      name: '',
      weight: 1,
      order_index: stages.length,
      total_quantity: null,
      unit: null,
    };
    onChange([...stages, newStage]);
  };

  const removeStage = (id: string) => {
    const updated = stages
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, order_index: idx }));
    onChange(updated);
  };

  const updateStage = (id: string, field: keyof ProjectStage, value: string | number | null) => {
    const updated = stages.map((stage) =>
      stage.id === id ? { ...stage, [field]: value } : stage
    );
    onChange(updated);
  };

  const totalWeight = stages.reduce((sum, s) => sum + s.weight, 0);

  return (
    <div className="space-y-4">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="h-4 w-4" />
          <span>Etapas com peso ponderado</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStage}
          disabled={disabled}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Etapa
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Defina as etapas que serão usadas para calcular o avanço ponderado nos RDOs desta atividade.
      </p>

      {/* Lista de etapas */}
      {stages.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
          <p className="text-sm">Nenhuma etapa definida</p>
          <p className="text-xs mt-1">Clique em "+ Etapa" para adicionar etapas ponderadas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stages.map((stage, index) => (
            <Card key={stage.id} className="relative overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Número da etapa */}
                  <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </div>

                  {/* Descrição */}
                  <div className="flex-1 min-w-[150px]">
                    <Input
                      placeholder="Descrição da etapa (ex: Aplicação de manta)"
                      value={stage.name}
                      onChange={(e) => updateStage(stage.id, 'name', e.target.value)}
                      disabled={disabled}
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Peso */}
                  <div className="flex items-center gap-1.5 w-20">
                    <Scale className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <Input
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={stage.weight}
                      onChange={(e) => updateStage(stage.id, 'weight', parseFloat(e.target.value) || 1)}
                      disabled={disabled}
                      className="h-9 text-sm text-center"
                    />
                  </div>

                  {/* Total */}
                  <div className="flex items-center gap-1.5 w-24">
                    <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Total"
                      value={stage.total_quantity ?? ''}
                      onChange={(e) => updateStage(stage.id, 'total_quantity', e.target.value ? parseFloat(e.target.value) : null)}
                      disabled={disabled}
                      className="h-9 text-sm text-center"
                    />
                  </div>

                  {/* Unidade */}
                  <div className="w-20">
                    <Select
                      value={stage.unit || ''}
                      onValueChange={(value) => updateStage(stage.id, 'unit', value || null)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Un." />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Botão de remover */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStage(stage.id)}
                    disabled={disabled}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resumo dos pesos */}
      {stages.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
          <span className="text-muted-foreground">
            {stages.length} etapa(s) definida(s)
          </span>
          <Badge variant="secondary">
            Peso total: {totalWeight.toFixed(1)}
          </Badge>
        </div>
      )}
    </div>
  );
}

export default ProjectStagesEditor;
