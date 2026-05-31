import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, getDay, subDays, differenceInDays } from 'date-fns';
import { useMemo } from 'react';

interface ReportProgressEntry {
  id: string;
  date: string;
  daily_progress: number | null;
  planned_workforce: number | null;
  actual_workforce: number | null;
}

interface ProjectMilestone {
  id: string;
  project_id: string;
  target_date: string;
  target_percentage: number;
  description: string | null;
  is_start_date: boolean;
}

interface CalculatedData {
  dates: string[];
  dayNames: string[];
  datesWithDay: string[];  // "QUI 09/01" - data com dia da semana
  plannedPeriod: number[];
  actualPeriod: number[];
  plannedAccumulated: number[];
  actualAccumulated: number[];
  plannedPresence: number[];
  actualPresence: number[];
  totalPlanned: number;
  totalActual: number;
  // Novos campos conforme especificação WEES
  deviationPercent: number;  // ((realizado - previsto) / previsto) * 100
  statusType: 'ok' | 'warning' | 'critical';  // Verde, Amarelo, Vermelho
  presenceDifference: number[];  // previsto - realizado (para histograma)
}

export type DateFilterType = {
  type: 'all' | '7d' | '14d' | '30d' | 'custom';
  startDate?: Date;
  endDate?: Date;
};

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DAY_NAMES_UPPER = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/**
 * Interpola o valor planejado para uma data específica baseado nos marcos
 */
function interpolatePlannedValue(dateStr: string, milestones: ProjectMilestone[]): number {
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
}

export function useReportsProgress(
  projectId: string | undefined,
  dateFilter: DateFilterType = { type: 'all' }
) {
  // Calcular datas baseado no filtro
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    switch (dateFilter.type) {
      case '7d':
        return { startDate: subDays(today, 7), endDate: today };
      case '14d':
        return { startDate: subDays(today, 14), endDate: today };
      case '30d':
        return { startDate: subDays(today, 30), endDate: today };
      case 'custom':
        return { startDate: dateFilter.startDate, endDate: dateFilter.endDate };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [dateFilter]);

  // Buscar relatórios
  const { data: reports = [], isLoading: isLoadingReports, refetch } = useQuery({
    queryKey: ['reports-progress', projectId, dateFilter.type, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!projectId) return [];
      
      let query = supabase
        .from('reports')
        .select('id, date, daily_progress, planned_workforce, actual_workforce')
        .eq('project_id', projectId)
        .order('date', { ascending: true });
      
      if (startDate) {
        query = query.gte('date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('date', format(endDate, 'yyyy-MM-dd'));
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as ReportProgressEntry[];
    },
    enabled: !!projectId,
  });

  // Buscar marcos do projeto
  const { data: milestones = [], isLoading: isLoadingMilestones } = useQuery({
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

  // Buscar configuração de efetivo padrão do projeto
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project-workforce-config', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select('default_planned_workforce')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Buscar efetivo programado por dia
  const { data: dailyWorkforce = [], isLoading: isLoadingDailyWorkforce } = useQuery({
    queryKey: ['project-daily-workforce', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_daily_workforce')
        .select('date, planned_count')
        .eq('project_id', projectId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const calculatedData = useMemo((): CalculatedData => {
    const dates: string[] = [];
    const dayNames: string[] = [];
    const datesWithDay: string[] = [];
    const plannedPeriod: number[] = [];
    const actualPeriod: number[] = [];
    const plannedAccumulated: number[] = [];
    const actualAccumulated: number[] = [];
    const plannedPresence: number[] = [];
    const actualPresence: number[] = [];
    const presenceDifference: number[] = [];

    let accActual = 0;
    let previousPlannedAccum = 0;

    reports.forEach((report, index) => {
      const dateObj = parseISO(report.date);
      const dayIndex = getDay(dateObj);
      const formattedDate = format(dateObj, 'dd/MM');
      
      dates.push(formattedDate);
      dayNames.push(DAY_NAMES[dayIndex]);
      datesWithDay.push(`${DAY_NAMES_UPPER[dayIndex]} ${formattedDate}`);
      
      const progress = Number(report.daily_progress) || 0;
      
      let plannedPeriodValue: number;
      let plannedAccumValue: number;

      // Calcular acumulado real, limitado a 100%
      accActual = Math.min(accActual + progress, 100);

      if (milestones.length > 0) {
        // Com marcos: usar interpolação para calcular valor planejado, limitado a 100%
        plannedAccumValue = Math.min(interpolatePlannedValue(report.date, milestones), 100);
        plannedPeriodValue = Math.max(0, plannedAccumValue - previousPlannedAccum);
      } else {
        // SEM marcos: criar uma LB padrão linear de 0% a 100%
        // Distribuição: cada RDO representa 100% / total de RDOs
        const totalReports = reports.length;
        const baseProgress = 100 / totalReports;
        plannedPeriodValue = Math.round(baseProgress * 10) / 10;
        plannedAccumValue = Math.min((index + 1) * baseProgress, 100);
      }
      
      previousPlannedAccum = plannedAccumValue;
      plannedPeriod.push(Math.max(0, Math.round(plannedPeriodValue * 10) / 10));
      actualPeriod.push(progress);
      
      plannedAccumulated.push(Math.round(plannedAccumValue * 10) / 10);
      actualAccumulated.push(Math.round(accActual * 10) / 10);
      
      // Presenças - prioridade: 1) daily workforce, 2) default do projeto, 3) RDO
      const dailyEntry = dailyWorkforce.find(dw => dw.date === report.date);
      const plannedPresenceValue = dailyEntry?.planned_count 
        ?? projectData?.default_planned_workforce 
        ?? Number(report.planned_workforce) 
        ?? 0;
      const actualPresenceValue = Number(report.actual_workforce) || 0;
      plannedPresence.push(plannedPresenceValue);
      actualPresence.push(actualPresenceValue);
      
      // Diferença para histograma: previsto - realizado
      // Se > 0: falta de presença (barra azul para cima)
      // Se < 0: excesso de presença (barra verde para baixo)
      presenceDifference.push(plannedPresenceValue - actualPresenceValue);
    });

    // Total planejado e realizado: limitados a 100%
    const totalPlanned = plannedAccumulated.length > 0 
      ? Math.min(plannedAccumulated[plannedAccumulated.length - 1], 100)
      : 0;
    
    const totalActual = Math.min(Math.round(accActual * 10) / 10, 100);

    // Cálculo do desvio percentual conforme especificação WEES:
    // desvio = ((realizadoAcumulado - previstoAcumulado) / previstoAcumulado) * 100
    let deviationPercent = 0;
    if (totalPlanned > 0) {
      deviationPercent = ((totalActual - totalPlanned) / totalPlanned) * 100;
    }

    // Status semáforo conforme especificação:
    // Verde: desvio >= 0%
    // Amarelo: -5% <= desvio < 0%
    // Vermelho: desvio < -5%
    let statusType: 'ok' | 'warning' | 'critical' = 'ok';
    if (deviationPercent >= 0) {
      statusType = 'ok';
    } else if (deviationPercent >= -5) {
      statusType = 'warning';
    } else {
      statusType = 'critical';
    }

    return {
      dates,
      dayNames,
      datesWithDay,
      plannedPeriod,
      actualPeriod,
      plannedAccumulated,
      actualAccumulated,
      plannedPresence,
      actualPresence,
      totalPlanned,
      totalActual,
      deviationPercent: Math.round(deviationPercent * 10) / 10,
      statusType,
      presenceDifference,
    };
  }, [reports, milestones, projectData, dailyWorkforce]);

  return {
    reports,
    milestones,
    isLoading: isLoadingReports || isLoadingMilestones || isLoadingProject || isLoadingDailyWorkforce,
    calculatedData,
    refetch,
  };
}
