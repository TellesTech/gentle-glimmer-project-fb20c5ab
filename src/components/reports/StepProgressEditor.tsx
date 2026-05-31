import React, { useEffect } from 'react';
import { Plus, Trash2, GripVertical, Calculator, Scale, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ActivityStep,
  calculateWeightedProgress,
  formatWeightedFormula,
  createDefaultStep,
} from '@/lib/progressCalculations';

interface StepProgressEditorProps {
  steps: ActivityStep[];
  onChange: (steps: ActivityStep[]) => void;
  onTotalProgressChange: (progress: number) => void;
  disabled?: boolean;
  /** When true, step descriptions and weights come from project config and can't be edited */
  readOnlyStages?: boolean;
}

export function StepProgressEditor({
  steps,
  onChange,
  onTotalProgressChange,
  disabled = false,
  readOnlyStages = false,
}: StepProgressEditorProps) {
  // Recalcula progresso total quando etapas mudam
  useEffect(() => {
    const total = calculateWeightedProgress(steps);
    onTotalProgressChange(total);
  }, [steps, onTotalProgressChange]);

  const addStep = () => {
    const newStep = createDefaultStep(steps.length);
    onChange([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    const updated = steps
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, orderIndex: idx }));
    onChange(updated);
  };

  const updateStep = (id: string, field: keyof ActivityStep, value: string | number | null) => {
    const updated = steps.map((step) =>
      step.id === id ? { ...step, [field]: value } : step
    );
    onChange(updated);
  };

  const totalProgress = calculateWeightedProgress(steps);
  const formula = formatWeightedFormula(steps);
  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);
  const totalWeightedSum = steps.reduce((sum, s) => sum + s.weight * s.progress, 0);

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Header com botão de adicionar (oculto quando etapas vêm do projeto) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Scale className="h-4 w-4" />
          <span>
            {readOnlyStages ? 'Etapas da atividade' : 'Etapas com peso ponderado'}
          </span>
        </div>
        {!readOnlyStages && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStep}
            disabled={disabled}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Etapa
          </Button>
        )}
      </div>

      {/* Lista de etapas */}
      {steps.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
          <p className="text-sm">Nenhuma etapa adicionada</p>
          <p className="text-xs mt-1">Clique em "+ Etapa" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <Card key={step.id} className="relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1" 
                   style={{ 
                     background: `linear-gradient(to bottom, ${getProgressColor(step.progress).replace('bg-', 'rgb(var(--')} 0%, transparent 100%)`
                   }} 
              />
              <CardContent className="p-3 pl-4">
                <div className="flex items-start gap-3">
                  {/* Número da etapa */}
                  <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </div>

                  {/* Conteúdo principal */}
                  <div className="flex-1 space-y-3">
                    {/* Descrição */}
                    {readOnlyStages ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{step.description || 'Sem descrição'}</span>
                        <Badge variant="outline" className="text-xs">
                          Peso: {step.weight}
                        </Badge>
                        {step.totalQuantity != null && step.totalQuantity > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Package className="h-3 w-3" />
                            Total: {step.totalQuantity} {step.unit || ''}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Input
                        placeholder="Descrição da etapa (ex: Limpar telhado)"
                        value={step.description}
                        onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                        disabled={disabled}
                        className="h-8 text-sm"
                      />
                    )}

                    {/* Campo de quantidade feita (quando há total definido) */}
                    {readOnlyStages && step.totalQuantity != null && step.totalQuantity > 0 && (
                      <div className="bg-muted/50 rounded-md p-3 space-y-2">
                        <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5" />
                          Quantidade feita hoje:
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={step.quantityDone ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value);
                              updateStep(step.id, 'quantityDone', val);
                            }}
                            disabled={disabled}
                            placeholder="0"
                            className="h-9 w-32 text-sm font-medium"
                          />
                          <span className="text-sm text-muted-foreground">
                            {step.unit || 'un'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Peso e Progresso */}
                    <div className={readOnlyStages ? '' : 'grid grid-cols-2 gap-4'}>
                      {/* Peso - oculto quando readOnlyStages */}
                      {!readOnlyStages && (
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Scale className="h-3 w-3" />
                            Peso
                          </label>
                          <Input
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={step.weight}
                            onChange={(e) => updateStep(step.id, 'weight', parseFloat(e.target.value) || 1)}
                            disabled={disabled}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}

                      {/* Progresso */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">
                          Avanço: {step.progress}%
                        </label>
                        <Slider
                          value={[step.progress]}
                          onValueChange={([val]) => updateStep(step.id, 'progress', val)}
                          min={0}
                          max={100}
                          step={5}
                          disabled={disabled}
                          className="py-1"
                        />
                      </div>
                    </div>

                    {/* Contribuição para o total */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Contribuição:</span>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {step.weight} × {step.progress}% = {(step.weight * step.progress).toFixed(0)}
                      </Badge>
                    </div>
                  </div>

                  {/* Botão de remover - oculto quando etapas vêm do projeto */}
                  {!readOnlyStages && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStep(step.id)}
                      disabled={disabled}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resumo do cálculo */}
      {steps.length > 0 && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Cálculo Ponderado</span>
              </div>
              <Badge 
                variant="default" 
                className={cn(
                  "text-lg font-bold px-3 py-1",
                  totalProgress >= 80 ? "bg-green-600" :
                  totalProgress >= 50 ? "bg-yellow-600" :
                  totalProgress >= 20 ? "bg-orange-600" :
                  "bg-red-600"
                )}
              >
                {totalProgress.toFixed(1)}%
              </Badge>
            </div>

            {/* Fórmula visual */}
            <div className="bg-background/50 rounded-md p-3 text-xs font-mono overflow-x-auto">
              <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                <span className="text-foreground">Avanço = </span>
                <span className="text-primary">{totalWeightedSum.toFixed(0)}</span>
                <span>/</span>
                <span className="text-primary">{totalWeight.toFixed(1)}</span>
                <span>=</span>
                <span className="text-foreground font-bold">{totalProgress.toFixed(1)}%</span>
              </div>
              <div className="mt-2 text-muted-foreground leading-relaxed break-all">
                {formula}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StepProgressEditor;
