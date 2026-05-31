import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseISO, differenceInDays, format } from 'date-fns';

export interface ProjectMilestone {
  id: string;
  project_id: string;
  target_date: string;
  target_percentage: number;
  description: string | null;
  is_start_date: boolean;
  created_at: string;
  updated_at: string;
}

export interface MilestoneInput {
  target_date: string;
  target_percentage: number;
  description?: string;
  is_start_date?: boolean;
}

export function useProjectMilestones(projectId: string | undefined) {
  const queryClient = useQueryClient();

  // Buscar marcos do projeto
  const { data: milestones = [], isLoading, refetch } = useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('target_date', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ProjectMilestone[];
    },
    enabled: !!projectId,
  });

  // Adicionar marco
  const addMilestoneMutation = useMutation({
    mutationFn: async (milestone: MilestoneInput) => {
      if (!projectId) throw new Error('Project ID is required');
      
      const { error } = await supabase
        .from('project_milestones')
        .insert({
          project_id: projectId,
          target_date: milestone.target_date,
          target_percentage: milestone.target_percentage,
          description: milestone.description || null,
          is_start_date: milestone.is_start_date || false,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      toast.success('Marco adicionado com sucesso');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um marco para esta data');
      } else {
        toast.error('Erro ao adicionar marco');
      }
    },
  });

  // Atualizar marco
  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MilestoneInput> & { id: string }) => {
      const { error } = await supabase
        .from('project_milestones')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
    },
    onError: () => {
      toast.error('Erro ao atualizar marco');
    },
  });

  // Remover marco
  const deleteMilestoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      toast.success('Marco removido');
    },
    onError: () => {
      toast.error('Erro ao remover marco');
    },
  });

  // Salvar múltiplos marcos de uma vez (bulk upsert)
  const saveMilestonesMutation = useMutation({
    mutationFn: async (newMilestones: MilestoneInput[]) => {
      if (!projectId) throw new Error('Project ID is required');
      
      // Primeiro, deletar todos os marcos existentes
      await supabase
        .from('project_milestones')
        .delete()
        .eq('project_id', projectId);
      
      // Inserir novos marcos
      if (newMilestones.length > 0) {
        const toInsert = newMilestones.map(m => ({
          project_id: projectId,
          target_date: m.target_date,
          target_percentage: m.target_percentage,
          description: m.description || null,
          is_start_date: m.is_start_date || false,
        }));
        
        const { error } = await supabase
          .from('project_milestones')
          .insert(toInsert);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      toast.success('Marcos salvos com sucesso');
    },
    onError: (error: any) => {
      console.error('Error saving milestones:', error);
      toast.error('Erro ao salvar marcos');
    },
  });

  /**
   * Interpola o valor planejado para uma data específica baseado nos marcos
   * @param dateStr - Data no formato 'yyyy-MM-dd'
   * @returns Valor planejado interpolado (0-100)
   */
  const getPlannedValueForDate = (dateStr: string): number => {
    if (milestones.length === 0) return 0;
    
    const date = parseISO(dateStr);
    const sortedMilestones = [...milestones].sort(
      (a, b) => parseISO(a.target_date).getTime() - parseISO(b.target_date).getTime()
    );
    
    const firstMilestone = sortedMilestones[0];
    const lastMilestone = sortedMilestones[sortedMilestones.length - 1];
    
    // Antes do primeiro marco
    if (date < parseISO(firstMilestone.target_date)) {
      return 0;
    }
    
    // Depois do último marco
    if (date >= parseISO(lastMilestone.target_date)) {
      return Number(lastMilestone.target_percentage);
    }
    
    // Encontrar marcos anterior e posterior
    for (let i = 0; i < sortedMilestones.length - 1; i++) {
      const current = sortedMilestones[i];
      const next = sortedMilestones[i + 1];
      
      const currentDate = parseISO(current.target_date);
      const nextDate = parseISO(next.target_date);
      
      if (date >= currentDate && date < nextDate) {
        // Interpolação linear
        const totalDays = differenceInDays(nextDate, currentDate);
        const elapsedDays = differenceInDays(date, currentDate);
        
        if (totalDays === 0) return Number(current.target_percentage);
        
        const progressRange = Number(next.target_percentage) - Number(current.target_percentage);
        const interpolatedValue = Number(current.target_percentage) + (progressRange * (elapsedDays / totalDays));
        
        return Math.round(interpolatedValue * 10) / 10;
      }
    }
    
    return 0;
  };

  /**
   * Calcula o valor planejado do período (diferença entre dias consecutivos)
   * @param dateStr - Data atual
   * @param previousDateStr - Data anterior
   * @returns Diferença do valor planejado
   */
  const getPlannedPeriodValue = (dateStr: string, previousDateStr: string | null): number => {
    const currentValue = getPlannedValueForDate(dateStr);
    const previousValue = previousDateStr ? getPlannedValueForDate(previousDateStr) : 0;
    return Math.max(0, currentValue - previousValue);
  };

  return {
    milestones,
    isLoading,
    refetch,
    addMilestone: addMilestoneMutation.mutate,
    updateMilestone: updateMilestoneMutation.mutate,
    deleteMilestone: deleteMilestoneMutation.mutate,
    saveMilestones: saveMilestonesMutation.mutateAsync,
    isAdding: addMilestoneMutation.isPending,
    isUpdating: updateMilestoneMutation.isPending,
    isDeleting: deleteMilestoneMutation.isPending,
    isSaving: saveMilestonesMutation.isPending,
    getPlannedValueForDate,
    getPlannedPeriodValue,
  };
}
