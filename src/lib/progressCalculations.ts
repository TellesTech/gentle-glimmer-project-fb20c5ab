/**
 * Interface para uma etapa de atividade com peso
 */
export interface ActivityStep {
  id: string;
  description: string;
  weight: number;
  progress: number;
  orderIndex: number;
  // Campos para quantidade (vêm do projeto, somente leitura no RDO)
  totalQuantity?: number | null;
  unit?: string | null;
  // Quantidade feita no dia (preenchido pelo usuário no RDO)
  quantityDone?: number | null;
}

/**
 * Calcula a média ponderada do progresso das etapas
 * Fórmula: (peso1 * prog1 + peso2 * prog2 + ...) / (peso1 + peso2 + ...)
 */
export function calculateWeightedProgress(steps: ActivityStep[]): number {
  if (!steps || steps.length === 0) return 0;

  const totalWeightedProgress = steps.reduce(
    (sum, step) => sum + (step.weight * step.progress),
    0
  );

  const totalWeight = steps.reduce(
    (sum, step) => sum + step.weight,
    0
  );

  if (totalWeight === 0) return 0;

  // Arredonda para 1 casa decimal
  return Math.round((totalWeightedProgress / totalWeight) * 10) / 10;
}

/**
 * Gera a fórmula de cálculo em formato legível
 */
export function formatWeightedFormula(steps: ActivityStep[]): string {
  if (!steps || steps.length === 0) return '';

  const numerator = steps
    .map((step) => `${step.weight} × ${step.progress}%`)
    .join(' + ');

  const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);

  return `(${numerator}) ÷ ${totalWeight}`;
}

/**
 * Cria uma nova etapa com valores padrão
 */
export function createDefaultStep(orderIndex: number = 0): ActivityStep {
  return {
    id: crypto.randomUUID(),
    description: '',
    weight: 1,
    progress: 0,
    orderIndex,
  };
}
