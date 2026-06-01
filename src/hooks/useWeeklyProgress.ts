import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/loose-client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export interface WeeklyProgressEntry {
  id: string;
  project_id: string;
  date: string;
  planned_period: number;
  actual_period: number;
  planned_presence: number;
  actual_presence: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface CalculatedData {
  dates: string[];
  dayNames: string[];
  plannedPeriod: number[];
  actualPeriod: number[];
  plannedAccumulated: number[];
  actualAccumulated: number[];
  plannedPresence: number[];
  actualPresence: number[];
  totalPlanned: number;
  totalActual: number;
}

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function useWeeklyProgress(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['weekly-progress', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_weekly_progress')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return (data || []) as WeeklyProgressEntry[];
    },
    enabled: !!projectId,
  });

  const calculateAccumulated = (data: WeeklyProgressEntry[]): CalculatedData => {
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const dates: string[] = [];
    const dayNames: string[] = [];
    const plannedPeriod: number[] = [];
    const actualPeriod: number[] = [];
    const plannedAccumulated: number[] = [];
    const actualAccumulated: number[] = [];
    const plannedPresence: number[] = [];
    const actualPresence: number[] = [];

    let accPlanned = 0;
    let accActual = 0;

    sortedData.forEach((entry) => {
      const dateObj = parseISO(entry.date);
      dates.push(format(dateObj, 'dd/MM'));
      dayNames.push(DAY_NAMES[getDay(dateObj)]);
      
      const planned = Number(entry.planned_period) || 0;
      const actual = Number(entry.actual_period) || 0;
      
      plannedPeriod.push(planned);
      actualPeriod.push(actual);
      
      accPlanned += planned;
      accActual += actual;
      
      plannedAccumulated.push(Math.round(accPlanned * 10) / 10);
      actualAccumulated.push(Math.round(accActual * 10) / 10);
      
      plannedPresence.push(entry.planned_presence || 0);
      actualPresence.push(entry.actual_presence || 0);
    });

    return {
      dates,
      dayNames,
      plannedPeriod,
      actualPeriod,
      plannedAccumulated,
      actualAccumulated,
      plannedPresence,
      actualPresence,
      totalPlanned: Math.round(accPlanned * 10) / 10,
      totalActual: Math.round(accActual * 10) / 10,
    };
  };

  const updateEntryMutation = useMutation({
    mutationFn: async ({ 
      id, 
      field, 
      value 
    }: { 
      id: string; 
      field: 'planned_period' | 'actual_period' | 'planned_presence' | 'actual_presence'; 
      value: number 
    }) => {
      const { error } = await supabase
        .from('project_weekly_progress')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-progress', projectId] });
    },
    onError: () => {
      toast.error('Erro ao atualizar valor');
    },
  });

  const addEntryMutation = useMutation({
    mutationFn: async (entry: Partial<WeeklyProgressEntry>) => {
      const { error } = await supabase
        .from('project_weekly_progress')
        .insert({
          project_id: projectId!,
          date: entry.date!,
          planned_period: entry.planned_period || 0,
          actual_period: entry.actual_period || 0,
          planned_presence: entry.planned_presence || 0,
          actual_presence: entry.actual_presence || 0,
          created_by: user?.id || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-progress', projectId] });
      toast.success('Data adicionada com sucesso');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Esta data já existe no registro');
      } else {
        toast.error('Erro ao adicionar data');
      }
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_weekly_progress')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-progress', projectId] });
      toast.success('Data removida com sucesso');
    },
    onError: () => {
      toast.error('Erro ao remover data');
    },
  });

  const calculatedData = calculateAccumulated(entries);

  return {
    entries,
    isLoading,
    calculatedData,
    updateEntry: updateEntryMutation.mutate,
    addEntry: addEntryMutation.mutate,
    deleteEntry: deleteEntryMutation.mutate,
    isUpdating: updateEntryMutation.isPending,
    isAdding: addEntryMutation.isPending,
    isDeleting: deleteEntryMutation.isPending,
    refetch,
  };
}
