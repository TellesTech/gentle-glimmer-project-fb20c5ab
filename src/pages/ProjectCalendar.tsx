import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRecentProjects } from '@/hooks/useRecentProjects';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Users, 
  Copy, 
  Eye,
  Building2,
  FileText,
  UserCircle,
  TrendingUp,
  UsersRound,
  BarChart3,
  Sparkles,
  Target,
  Loader2,
  Clock,
  ChevronDown
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import WeeklyPhysicalProgress from '@/components/dashboard/WeeklyPhysicalProgress';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, EmptyState } from '@/components/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProjectStatusBadge } from '@/components/shared/ProjectStatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/loose-client';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { parseIntervalToMinutes, formatMinutesToHours } from '@/lib/formatters';
import ExcelJS from 'exceljs';
import { useSystemSettings } from '@/hooks/useSystemSettings';

type ShiftType = Database['public']['Enums']['shift_type'];

const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

const SHIFT_COLORS: Record<ShiftType, string> = {
  morning: 'bg-warning/20 text-warning',
  afternoon: 'bg-primary/20 text-primary',
  night: 'bg-muted text-muted-foreground',
};

// Helpers for month URL persistence
const formatMonthParam = (date: Date) => format(date, 'yyyy-MM');
const parseMonthParam = (value: string | null): Date | null => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, 1);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export default function ProjectCalendar() {
  const { projectId } = useParams<{ projectId: string }>();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(() => {
    return parseMonthParam(searchParams.get('month')) || new Date();
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { trackProjectAccess } = useRecentProjects();
  
  // Team creation dialog states
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [teamFormData, setTeamFormData] = useState({ name: '', leader_id: '' });
  const [savingTeam, setSavingTeam] = useState(false);
  
  // Delays dialog state
  const [delaysDialogOpen, setDelaysDialogOpen] = useState(false);
  const [expandedDelayCategory, setExpandedDelayCategory] = useState<'operational' | 'climatic' | 'amt' | null>(null);
  
  // HH Export dialog states
  const [hhDialogOpen, setHhDialogOpen] = useState(false);
  const [hhStartDate, setHhStartDate] = useState<Date | undefined>();
  const [hhEndDate, setHhEndDate] = useState<Date | undefined>();
  const [hhExporting, setHhExporting] = useState(false);

  // Set month param on mount if not present
  useEffect(() => {
    if (!searchParams.has('month')) {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.set('month', formatMonthParam(currentMonth));
        return p;
      }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (projectId) {
      trackProjectAccess(projectId);
    }
  }, [projectId, trackProjectAccess]);

  // Fetch project with site, company (including responsible and contract)
  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project-calendar', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          site:sites(
            id, name, city, state,
            company:companies(
              id, name, 
              contract_number, 
              responsible_name, 
              responsible_role
            )
          )
        `)
        .eq('id', projectId!)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch teams for this project
  const { data: teams = [] } = useQuery({
    queryKey: ['project-teams-count', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name, team_members(id)')
        .eq('project_id', projectId!);
      return data || [];
    },
    enabled: !!projectId,
  });

  // Fetch all collaborators for team leader selection
  const { data: eligibleLeaders = [] } = useQuery({
    queryKey: ['all-collaborators'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');
      return data || [];
    },
  });

  // Detect ?createTeam=true and open dialog
  // Sync currentMonth when URL param changes (browser back/forward)
  useEffect(() => {
    const urlMonth = parseMonthParam(searchParams.get('month'));
    if (urlMonth && formatMonthParam(urlMonth) !== formatMonthParam(currentMonth)) {
      setCurrentMonth(urlMonth);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('createTeam') === 'true' && project && !isLoadingProject) {
      setCreateTeamDialogOpen(true);
      // Remove only createTeam param, preserve others (like month)
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.delete('createTeam');
        return p;
      }, { replace: true });
    }
  }, [searchParams, project, isLoadingProject, setSearchParams]);

  // Handle team creation
  const handleCreateTeam = async () => {
    if (!teamFormData.name.trim() || !projectId) return;
    
    setSavingTeam(true);
    try {
      const { error } = await supabase
        .from('teams')
        .insert({
          name: teamFormData.name,
          project_id: projectId,
          leader_id: teamFormData.leader_id || null
        });
      
      if (error) throw error;
      
      toast.success('Equipe criada com sucesso!');
      setCreateTeamDialogOpen(false);
      setTeamFormData({ name: '', leader_id: '' });
      queryClient.invalidateQueries({ queryKey: ['project-teams-count', projectId] });
    } catch (error) {
      toast.error('Erro ao criar equipe');
    } finally {
      setSavingTeam(false);
    }
  };

  // Fetch reports with complete data including new fields
  const { data: reports = [], isLoading: isLoadingReports } = useQuery({
    queryKey: ['project-reports', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id, date, shift, status, location, start_time, end_time, created_by,
          planned_workforce, actual_workforce, real_percentage, daily_progress,
          supervisor_name, no_activity,
          operational_deviation_hours, operational_deviation_reason, operational_deviation_details,
          climatic_deviation_hours, climatic_deviation_reason, climatic_deviation_details,
          amt_deviation_hours, amt_deviation_reason, amt_deviation_details,
          activities:report_activities(id),
          deviations:report_deviations(id, impact),
          attendance:report_attendance(id, present),
          photos:report_photos(id),
          creator:profiles!reports_created_by_fkey(name, avatar_url)
        `)
        .eq('project_id', projectId!)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    // Efetivo: usar valor do último RDO (mais recente, já ordenado por data desc)
    const latestReport = reports[0];
    const totalPlannedWorkforce = latestReport?.planned_workforce || 0;
    const totalActualWorkforce = latestReport?.actual_workforce || 0;
    const generalPercentage = totalPlannedWorkforce > 0 
      ? Math.round((totalActualWorkforce / totalPlannedWorkforce) * 100) 
      : 0;
    
    // Soma do avanço diário de todos os RDOs (REALIZADO acumulado), limitado a 100%
    const totalDailyProgress = reports.reduce((sum, r) => sum + (r.daily_progress || 0), 0);
    const realPercentage = Math.min(Math.round(totalDailyProgress), 100);
    
    // Supervisor vem diretamente do projeto (não do relatório)
    
    // Preparar dados para o gráfico de linha (últimos 14 RDOs) - Evolução da Atividade
    const progressTarget = (project as any)?.progress_target || 100;
    const chartData = [...reports]
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
      .slice(-14)
      .map(r => ({
        date: format(parseISO(r.date), 'dd/MM'),
        dailyProgress: r.daily_progress || 0,
        percentReal: r.real_percentage || 0,
        meta: progressTarget,
      }));
    
    // Média do progresso diário
    const avgDailyProgress = reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + (r.daily_progress || 0), 0) / reports.length)
      : 0;
    
    return { 
      totalTeams: teams.length,
      totalPlannedWorkforce,
      totalActualWorkforce,
      generalPercentage,
      realPercentage,
      
      chartData,
      avgDailyProgress,
      progressTarget: (project as any)?.progress_target || 100,
    };
  }, [teams, reports, project]);

  // Calculate total delays with breakdown by reason and individual records with date
  const totalDelays = useMemo(() => {
    let operationalMinutes = 0;
    let climaticMinutes = 0;
    let amtMinutes = 0;

    // Track reasons with their accumulated hours
    const operationalReasons: Record<string, number> = {};
    const climaticReasons: Record<string, number> = {};
    const amtReasons: Record<string, number> = {};

    // Track individual records with date for detailed table
    const operationalDetails: Array<{ date: string; reason: string; details: string | null; hours: string }> = [];
    const climaticDetails: Array<{ date: string; reason: string; details: string | null; hours: string }> = [];
    const amtDetails: Array<{ date: string; reason: string; details: string | null; hours: string }> = [];

    reports.forEach((r: any) => {
      const opMins = parseIntervalToMinutes(r.operational_deviation_hours);
      const clMins = parseIntervalToMinutes(r.climatic_deviation_hours);
      const amMins = parseIntervalToMinutes(r.amt_deviation_hours);

      operationalMinutes += opMins;
      climaticMinutes += clMins;
      amtMinutes += amMins;

      // Track by reason (aggregated)
      if (opMins > 0 && r.operational_deviation_reason) {
        operationalReasons[r.operational_deviation_reason] = (operationalReasons[r.operational_deviation_reason] || 0) + opMins;
        operationalDetails.push({
          date: r.date,
          reason: r.operational_deviation_reason,
          details: r.operational_deviation_details,
          hours: formatMinutesToHours(opMins)
        });
      }
      if (clMins > 0 && r.climatic_deviation_reason) {
        climaticReasons[r.climatic_deviation_reason] = (climaticReasons[r.climatic_deviation_reason] || 0) + clMins;
        climaticDetails.push({
          date: r.date,
          reason: r.climatic_deviation_reason,
          details: r.climatic_deviation_details,
          hours: formatMinutesToHours(clMins)
        });
      }
      if (amMins > 0 && r.amt_deviation_reason) {
        amtReasons[r.amt_deviation_reason] = (amtReasons[r.amt_deviation_reason] || 0) + amMins;
        amtDetails.push({
          date: r.date,
          reason: r.amt_deviation_reason,
          details: r.amt_deviation_details,
          hours: formatMinutesToHours(amMins)
        });
      }
    });

    const totalMinutes = operationalMinutes + climaticMinutes + amtMinutes;

    // Convert reason maps to sorted arrays
    const sortByHours = (a: [string, number], b: [string, number]) => b[1] - a[1];

    // Sort details by date descending
    const sortByDate = (a: { date: string }, b: { date: string }) => 
      parseISO(b.date).getTime() - parseISO(a.date).getTime();

    return {
      operational: formatMinutesToHours(operationalMinutes),
      operationalReasons: Object.entries(operationalReasons)
        .sort(sortByHours)
        .map(([reason, mins]) => ({ reason, hours: formatMinutesToHours(mins) })),
      operationalDetails: operationalDetails.sort(sortByDate),
      climatic: formatMinutesToHours(climaticMinutes),
      climaticReasons: Object.entries(climaticReasons)
        .sort(sortByHours)
        .map(([reason, mins]) => ({ reason, hours: formatMinutesToHours(mins) })),
      climaticDetails: climaticDetails.sort(sortByDate),
      amt: formatMinutesToHours(amtMinutes),
      amtReasons: Object.entries(amtReasons)
        .sort(sortByHours)
        .map(([reason, mins]) => ({ reason, hours: formatMinutesToHours(mins) })),
      amtDetails: amtDetails.sort(sortByDate),
      total: formatMinutesToHours(totalMinutes),
      hasAny: totalMinutes > 0
    };
  }, [reports]);

  // Open HH dialog with default dates
  const openHhDialog = () => {
    if (reports.length > 0) {
      const sorted = [...reports].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      setHhStartDate(parseISO(sorted[0].date));
      setHhEndDate(parseISO(sorted[sorted.length - 1].date));
    }
    setHhDialogOpen(true);
  };

  // Count RDOs in selected period
  const hhReportsInPeriod = useMemo(() => {
    if (!hhStartDate || !hhEndDate) return 0;
    return reports.filter(r => {
      const d = parseISO(r.date);
      return isWithinInterval(d, { start: hhStartDate, end: hhEndDate });
    }).length;
  }, [reports, hhStartDate, hhEndDate]);

  // Handle Man-Hours export with period filter
  const handleExportManHours = async () => {
    if (!hhStartDate || !hhEndDate) {
      toast.error('Selecione o período');
      return;
    }

    // Filter reports by selected period
    const filteredReports = reports.filter(r => {
      const d = parseISO(r.date);
      return isWithinInterval(d, { start: hhStartDate, end: hhEndDate });
    });

    if (filteredReports.length === 0) {
      toast.error('Nenhum RDO encontrado no período selecionado');
      return;
    }

    try {
      setHhExporting(true);
      toast.loading('Gerando planilha...', { id: 'hh-export' });

      // Fetch attendances only for filtered reports
      const reportIds = filteredReports.map(r => r.id);
      const { data: attendanceData, error } = await supabase
        .from('report_attendance')
        .select('user_name, function_role, arrival_time, departure_time, present, report_id')
        .in('report_id', reportIds)
        .eq('present', true);

      if (error) throw error;

      if (!attendanceData || attendanceData.length === 0) {
        toast.error('Nenhum registro de efetivo encontrado', { id: 'hh-export' });
        return;
      }

      // Map report_id to report data
      const reportMap = new Map(filteredReports.map(r => [r.id, r]));

      // Calculate hours per attendance record
      const hoursData = attendanceData.map(att => {
        const report = reportMap.get(att.report_id);
        
        // Use individual times or fallback to report times
        const arrival = att.arrival_time || (report as any)?.start_time || '07:00';
        const departure = att.departure_time || (report as any)?.end_time || '17:00';
        
        // Calculate worked hours
        const [arrH, arrM] = arrival.split(':').map(Number);
        const [depH, depM] = departure.split(':').map(Number);
        const totalMinutes = (depH * 60 + depM) - (arrH * 60 + arrM);
        const hours = Math.max(0, totalMinutes / 60);
        
        return {
          userName: att.user_name,
          functionRole: att.function_role || 'Não informada',
          date: (report as any)?.date,
          arrivalTime: arrival,
          departureTime: departure,
          hours,
        };
      });

      // Group by function
      const byFunction: Record<string, { count: number; totalHours: number }> = {};
      hoursData.forEach(d => {
        if (!byFunction[d.functionRole]) {
          byFunction[d.functionRole] = { count: 0, totalHours: 0 };
        }
        byFunction[d.functionRole].count++;
        byFunction[d.functionRole].totalHours += d.hours;
      });

      // Group by level (N1, N2, N3) or use original function name
      const byLevel: Record<string, { count: number; totalHours: number }> = {};
      hoursData.forEach(d => {
        const levelMatch = d.functionRole.match(/N[1-3]/i);
        // Se encontrar N1/N2/N3, agrupa por nível; senão usa a função original
        const level = levelMatch 
          ? levelMatch[0].toUpperCase() 
          : (d.functionRole || 'Não informada');
        if (!byLevel[level]) {
          byLevel[level] = { count: 0, totalHours: 0 };
        }
        byLevel[level].count++;
        byLevel[level].totalHours += d.hours;
      });

      // Create Excel workbook with ExcelJS for styling
      const wb = new ExcelJS.Workbook();
      wb.creator = 'WEES';
      wb.created = new Date();
      
      // Get date range from selection
      const firstDate = format(hhStartDate, 'dd/MM/yyyy');
      const lastDate = format(hhEndDate, 'dd/MM/yyyy');
      
      // Get theme color
      const primaryColor = settings?.primary_color || '#6366f1';
      const hexColor = primaryColor.replace('#', '');
      
      // Helper to style header row
      const styleHeaderRow = (sheet: ExcelJS.Worksheet, rowNum: number, colCount: number) => {
        const row = sheet.getRow(rowNum);
        row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF' + hexColor }
        };
        row.alignment = { horizontal: 'center', vertical: 'middle' };
        for (let i = 1; i <= colCount; i++) {
          row.getCell(i).border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      };
      
      // Helper to convert decimal hours to HH:MM
      const decimalToHHMM = (hours: number): string => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };

      // Helper to style title row
      const styleTitleRow = (sheet: ExcelJS.Worksheet, rowNum: number, colCount: number) => {
        sheet.mergeCells(rowNum, 1, rowNum, colCount);
        const row = sheet.getRow(rowNum);
        row.font = { bold: true, size: 14, color: { argb: 'FF' + hexColor } };
        row.alignment = { horizontal: 'center' };
      };
      
      // Sheet 1: Summary by Function
      const funcSheet = wb.addWorksheet('Por Função');
      funcSheet.columns = [
        { header: '', key: 'funcao', width: 25 },
        { header: '', key: 'qtd', width: 15 },
        { header: '', key: 'total', width: 15 },
        { header: '', key: 'media', width: 18 },
      ];
      
      funcSheet.addRow(['RESUMO POR FUNÇÃO - ' + project?.name]);
      styleTitleRow(funcSheet, 1, 4);
      funcSheet.addRow(['Período: ' + firstDate + ' a ' + lastDate]);
      funcSheet.mergeCells(2, 1, 2, 4);
      funcSheet.getRow(2).alignment = { horizontal: 'center' };
      funcSheet.addRow([]);
      funcSheet.addRow(['Função', 'Qtd. Registros', 'Total Horas', 'Média Horas/Dia']);
      styleHeaderRow(funcSheet, 4, 4);
      
      Object.entries(byFunction)
        .sort((a, b) => b[1].totalHours - a[1].totalHours)
        .forEach(([fn, data]) => {
          funcSheet.addRow([fn, data.count, decimalToHHMM(data.totalHours), decimalToHHMM(data.totalHours / data.count)]);
        });
      
      funcSheet.addRow([]);
      const totalFuncRow = funcSheet.addRow([
        'TOTAL',
        Object.values(byFunction).reduce((s, d) => s + d.count, 0),
        decimalToHHMM(Object.values(byFunction).reduce((s, d) => s + d.totalHours, 0)),
        ''
      ]);
      totalFuncRow.font = { bold: true };

      // Sheet 2: Summary by Level (N1, N2, N3)
      const levelSheet = wb.addWorksheet('Por Nível');
      levelSheet.columns = [
        { header: '', key: 'nivel', width: 15 },
        { header: '', key: 'qtd', width: 15 },
        { header: '', key: 'total', width: 15 },
      ];
      
      levelSheet.addRow(['RESUMO POR NÍVEL - ' + project?.name]);
      styleTitleRow(levelSheet, 1, 3);
      levelSheet.addRow(['Período: ' + firstDate + ' a ' + lastDate]);
      levelSheet.mergeCells(2, 1, 2, 3);
      levelSheet.getRow(2).alignment = { horizontal: 'center' };
      levelSheet.addRow([]);
      levelSheet.addRow(['Nível', 'Qtd. Registros', 'Total Horas']);
      styleHeaderRow(levelSheet, 4, 3);
      
      Object.entries(byLevel)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([level, data]) => {
          levelSheet.addRow([level, data.count, decimalToHHMM(data.totalHours)]);
        });

      // Sheet 3: Detailed Data with Entrada/Saída
      const detailSheet = wb.addWorksheet('Detalhado');
      detailSheet.columns = [
        { header: '', key: 'nome', width: 30 },
        { header: '', key: 'funcao', width: 20 },
        { header: '', key: 'data', width: 12 },
        { header: '', key: 'entrada', width: 10 },
        { header: '', key: 'saida', width: 10 },
        { header: '', key: 'horas', width: 10 },
      ];
      
      detailSheet.addRow(['DETALHAMENTO - ' + project?.name]);
      styleTitleRow(detailSheet, 1, 6);
      detailSheet.addRow(['Período: ' + firstDate + ' a ' + lastDate]);
      detailSheet.mergeCells(2, 1, 2, 6);
      detailSheet.getRow(2).alignment = { horizontal: 'center' };
      detailSheet.addRow([]);
      detailSheet.addRow(['Nome', 'Função', 'Data', 'Entrada', 'Saída', 'Horas']);
      styleHeaderRow(detailSheet, 4, 6);
      
      hoursData
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .forEach(d => {
          detailSheet.addRow([
            d.userName,
            d.functionRole,
            d.date ? format(parseISO(d.date), 'dd/MM/yyyy') : '',
            d.arrivalTime,
            d.departureTime,
            decimalToHHMM(d.hours)
          ]);
        });

      // Download file
      const fileName = `HH-${project?.name?.replace(/\s+/g, '-')}-${format(new Date(), 'yyyyMMdd')}.xlsx`;
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      setHhDialogOpen(false);
      toast.success('Planilha de Homem Hora exportada!', { id: 'hh-export' });
    } catch (error) {
      console.error('Error exporting man-hours:', error);
      toast.error('Erro ao exportar planilha', { id: 'hh-export' });
    } finally {
      setHhExporting(false);
    }
  };

  const getReportsForDate = (date: Date) => {
    return reports.filter(r => isSameDay(parseISO(r.date), date));
  };

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOffset = useMemo(() => {
    const firstDay = startOfMonth(currentMonth);
    return firstDay.getDay();
  }, [currentMonth]);

  const site = project?.site as any;
  const company = site?.company;
  const team = teams[0];

  // Get primary status color for a date
  const getDateStatusColor = (dayReports: typeof reports) => {
    if (dayReports.length === 0) return '';
    if (dayReports.some(r => (r as any).no_activity === true)) return 'bg-red-100 border-red-300/50';
    if (dayReports.some(r => r.status === 'draft')) return 'bg-muted border-muted-foreground/30';
    if (dayReports.some(r => r.status === 'sent')) return 'bg-blue-100 border-blue-300/50';
    return 'bg-success/20 border-success/50';
  };

  // Build new report URL
  const getNewReportUrl = (date?: Date, copyFrom?: string) => {
    const params = new URLSearchParams();
    if (team?.id) params.set('teamId', team.id);
    if (date) params.set('date', format(date, 'yyyy-MM-dd'));
    if (copyFrom) params.set('copyFrom', copyFrom);
    return `/reports/create/${projectId}?${params.toString()}`;
  };

  const latestReport = reports[0];

  if (isLoadingProject) {
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32" />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={CalendarIcon}
        title="Atividade não encontrada"
        action={<Button asChild><Link to="/">Voltar</Link></Button>}
      />
    );
  }

  const dayReports = selectedDate ? getReportsForDate(selectedDate) : [];

  return (
    <div className="space-y-3 xs:space-y-4 pb-20 md:pb-0 min-w-0">
      {/* Header */}
      <div className="flex items-start gap-2 xs:gap-3 sm:gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate(-1)} 
                className="flex-shrink-0 mt-0.5 h-8 sm:h-10 gap-1 px-2"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm">Voltar</span>
              </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">
            {company?.name} • {site?.name}
          </p>
          <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 sm:gap-3">
            <h1 className="text-lg xs:text-xl sm:text-2xl font-bold truncate">{project.name}</h1>
            <ProjectStatusBadge status={project.status || 'planning'} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="gap-2">
          <Link to={getNewReportUrl()}>
            <Plus className="h-4 w-4" />
            Novo RDO
          </Link>
        </Button>
      </div>

      {/* Dashboard Premium de Informações */}
      <Card className="relative overflow-hidden backdrop-blur-sm bg-card/80 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
        {/* Overlay de gradiente */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        <CardHeader className="relative pb-2 xs:pb-3 p-3 xs:p-4 sm:p-6">
          <CardTitle className="text-sm xs:text-base flex items-center gap-2 xs:gap-3 flex-wrap">
            <div className="p-1.5 xs:p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
              <BarChart3 className="h-4 w-4 xs:h-5 xs:w-5 text-primary" />
            </div>
            <span className="font-semibold">Informações da Atividade</span>
            <Badge variant="outline" className="text-[10px] xs:text-xs bg-primary/10 border-primary/30 text-primary sm:ml-auto">
              <Sparkles className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" />
              Dashboard
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="relative space-y-3 xs:space-y-4 p-3 xs:p-4 sm:p-6 pt-0">
          {/* Linha 1 - Responsável Cliente e Supervisor (cards maiores) */}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 xs:gap-3 items-stretch">
            {/* Responsável Cliente */}
            <div className="group relative overflow-hidden p-3 xs:p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 min-h-[70px] xs:min-h-[90px] flex items-center">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="h-9 w-9 xs:h-11 xs:w-11 rounded-xl bg-amber-500/15 backdrop-blur-sm shadow-inner flex items-center justify-center transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                  <Building2 className="h-4 w-4 xs:h-5 xs:w-5 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm xs:text-lg font-bold truncate">
                    {(project as any)?.client_responsible_name || 'Não definido'}
                  </p>
                  <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Responsável Cliente</p>
                </div>
              </div>
            </div>
            
            {/* Supervisor */}
            <div className="group relative overflow-hidden p-3 xs:p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 transition-all duration-300 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5 min-h-[70px] xs:min-h-[90px] flex items-center">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="h-9 w-9 xs:h-11 xs:w-11 rounded-xl bg-orange-500/15 backdrop-blur-sm shadow-inner flex items-center justify-center transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                  <UserCircle className="h-4 w-4 xs:h-5 xs:w-5 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm xs:text-lg font-bold truncate">
                    {(project as any)?.supervisor_name || 'Não definido'}
                  </p>
                  <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Supervisor</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Linha 2 - Métricas numéricas (cards menores) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-3 items-stretch">
            {/* Equipes */}
            <div className="group flex items-center gap-2 xs:gap-3 p-2 xs:p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 transition-all duration-300 hover:border-primary/40 hover:bg-primary/10 min-h-[56px] xs:min-h-[64px]">
              <div className="h-7 w-7 xs:h-9 xs:w-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <UsersRound className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg xs:text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {metrics.totalTeams}
                </p>
                <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Equipes</p>
              </div>
            </div>
            
            {/* Efetivo Programado */}
            <div className="group flex items-center gap-2 xs:gap-3 p-2 xs:p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-500/10 min-h-[56px] xs:min-h-[64px]">
              <div className="h-7 w-7 xs:h-9 xs:w-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Users className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg xs:text-xl font-bold bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-text text-transparent">
                  {metrics.totalPlannedWorkforce}
                </p>
                <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Ef. Prog.</p>
              </div>
            </div>

            {/* Efetivo Real */}
            <div className="group flex items-center gap-2 xs:gap-3 p-2 xs:p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 transition-all duration-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 min-h-[56px] xs:min-h-[64px]">
              <div className="h-7 w-7 xs:h-9 xs:w-9 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Users className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-lg xs:text-xl font-bold bg-gradient-to-r from-cyan-500 to-cyan-400 bg-clip-text text-transparent">
                  {metrics.totalActualWorkforce}
                </p>
                <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Ef. Real</p>
              </div>
            </div>
            
            {/* Número do Contrato */}
            <div className="group flex items-center gap-2 xs:gap-3 p-2 xs:p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 transition-all duration-300 hover:border-purple-500/40 hover:bg-purple-500/10 min-h-[56px] xs:min-h-[64px]">
              <div className="h-7 w-7 xs:h-9 xs:w-9 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <FileText className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-purple-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs xs:text-sm font-bold truncate">
                  {company?.contract_number || 'N/D'}
                </p>
                <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Contrato</p>
              </div>
            </div>

            {/* Card de Atrasos */}
            <div 
              onClick={() => setDelaysDialogOpen(true)}
              className={cn(
                "group flex items-center gap-2 xs:gap-3 p-2 xs:p-3 rounded-xl cursor-pointer transition-all duration-300 min-h-[56px] xs:min-h-[64px]",
                totalDelays.hasAny 
                  ? "bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10" 
                  : "bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 hover:border-green-500/40 hover:bg-green-500/10"
              )}
            >
              <div className={cn(
                "h-7 w-7 xs:h-9 xs:w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                totalDelays.hasAny ? "bg-red-500/15" : "bg-green-500/15"
              )}>
                <Clock className={cn(
                  "h-3.5 w-3.5 xs:h-4 xs:w-4",
                  totalDelays.hasAny ? "text-red-500" : "text-green-500"
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-xs xs:text-sm font-bold",
                  totalDelays.hasAny ? "text-red-500" : "text-green-500"
                )}>
                  {totalDelays.total}
                </p>
                <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Atrasos</p>
              </div>
            </div>

            {/* Card HH - Homem Hora */}
            <div 
              onClick={openHhDialog}
              className="group flex items-center gap-2 xs:gap-3 p-2 xs:p-3 rounded-xl cursor-pointer transition-all duration-300 min-h-[56px] xs:min-h-[64px] bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/10"
            >
              <div className="h-7 w-7 xs:h-9 xs:w-9 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Users className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs xs:text-sm font-bold text-indigo-500">HH</p>
                <p className="text-[10px] xs:text-xs uppercase tracking-wider text-muted-foreground font-medium">Hm. Hora</p>
              </div>
            </div>
          </div>
          

          {/* Componente de Avanço Físico Semanal */}
          <WeeklyPhysicalProgress projectId={projectId!} />
        </CardContent>
      </Card>

      {/* Calendar - Full Width & Larger */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => {
                const newMonth = subMonths(currentMonth, 1);
                setCurrentMonth(newMonth);
                setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('month', formatMonthParam(newMonth)); return p; }, { replace: true });
              }}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => {
                const newMonth = addMonths(currentMonth, 1);
                setCurrentMonth(newMonth);
                setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('month', formatMonthParam(newMonth)); return p; }, { replace: true });
              }}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Days of week header - Larger */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => (
              <div key={i} className="text-center text-xs md:text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid - Larger cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-12 md:h-14" />
            ))}

            {days.map((day) => {
              const dayReportsLocal = getReportsForDate(day);
              const hasReports = dayReportsLocal.length > 0;
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const statusColor = getDateStatusColor(dayReportsLocal);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    if (hasReports) {
                      if (dayReportsLocal.length === 1) {
                        // Ensure month is in URL before navigating
                        const currentParams = new URLSearchParams(searchParams);
                        if (!currentParams.has('month')) {
                          currentParams.set('month', formatMonthParam(currentMonth));
                          setSearchParams(currentParams, { replace: true });
                        }
                        navigate(`/reports/${dayReportsLocal[0].id}`);
                      } else {
                        // Múltiplos relatórios - mostrar lista
                        setSelectedDate(isSelected ? null : day);
                      }
                    } else {
                      navigate(getNewReportUrl(day));
                    }
                  }}
                  className={cn(
                    "h-12 md:h-14 rounded-lg text-sm md:text-base font-medium transition-all relative flex items-center justify-center border",
                    isToday && "ring-2 ring-primary ring-offset-2",
                    isSelected && "ring-2 ring-primary bg-primary/10",
                    hasReports ? statusColor : "hover:bg-muted/50 border-transparent",
                    !hasReports && "text-muted-foreground"
                  )}
                >
                  {format(day, 'd')}
                  {dayReportsLocal.length > 1 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center">
                      {dayReportsLocal.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar legend */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mt-4 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted border border-muted-foreground/30" />
              <span>Rascunho</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success/20 border border-success/50" />
              <span>Concluído</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300/50" />
              <span>Enviado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-300/50" />
              <span>Sem Atividade</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Reports */}
      {selectedDate && dayReports.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Relatórios de {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dayReports.map(report => (
              <Link
                key={report.id}
                to={`/reports/${report.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn("text-[10px]", SHIFT_COLORS[report.shift])}>
                    {SHIFT_LABELS[report.shift]}
                  </Badge>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={(report.creator as any)?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {((report.creator as any)?.name || 'NA').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {report.start_time && report.end_time 
                        ? `${report.start_time} - ${report.end_time}`
                        : 'Horário não definido'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(report.creator as any)?.name || 'Autor desconhecido'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={report.status || 'draft'} />
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Reports - Compact */}
      {reports.length > 0 && !selectedDate && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Últimos Relatórios</CardTitle>
              {latestReport && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" asChild>
                  <Link to={getNewReportUrl(undefined, latestReport.id)}>
                    <Copy className="h-3 w-3" />
                    Copiar último
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.slice(0, 3).map(report => (
              <Link
                key={report.id}
                to={`/reports/${report.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[40px]">
                    <p className="text-lg font-bold leading-none">{format(parseISO(report.date), 'dd')}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{format(parseISO(report.date), 'MMM', { locale: ptBR })}</p>
                  </div>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={(report.creator as any)?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {((report.creator as any)?.name || 'NA').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px]", SHIFT_COLORS[report.shift])}>
                        {SHIFT_LABELS[report.shift]}
                      </Badge>
                      {report.daily_progress != null && report.daily_progress > 0 && (
                        <span className="text-xs text-green-500 font-medium">
                          +{report.daily_progress}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(report.creator as any)?.name || 'Autor desconhecido'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={report.status || 'draft'} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createTeamDialogOpen} onOpenChange={setCreateTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Criar Equipe
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Equipe *</Label>
              <Input
                placeholder="Ex: Equipe Alpha"
                value={teamFormData.name}
                onChange={(e) => setTeamFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Líder (opcional)</Label>
              <Select
                value={teamFormData.leader_id}
                onValueChange={(v) => setTeamFormData(prev => ({ ...prev, leader_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um líder" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleLeaders.map((leader: any) => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTeamDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTeam} disabled={!teamFormData.name.trim() || savingTeam}>
              {savingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Equipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Atrasos */}
      <Dialog open={delaysDialogOpen} onOpenChange={(open) => {
        setDelaysDialogOpen(open);
        if (!open) setExpandedDelayCategory(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-500" />
              Atrasos Acumulados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Atraso Operacional */}
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 overflow-hidden">
              <div 
                className="p-4 cursor-pointer hover:bg-orange-500/15 transition-colors"
                onClick={() => setExpandedDelayCategory(expandedDelayCategory === 'operational' ? null : 'operational')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-orange-500" />
                    <span className="font-medium text-orange-600">Atraso Operacional</span>
                    {totalDelays.operationalDetails.length > 0 && (
                      <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-500/30">
                        {totalDelays.operationalDetails.length} registro{totalDelays.operationalDetails.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-orange-600">{totalDelays.operational}</span>
                    <ChevronDown className={cn(
                      "h-5 w-5 text-orange-500 transition-transform",
                      expandedDelayCategory === 'operational' && "rotate-180"
                    )} />
                  </div>
                </div>
              </div>
              
              {expandedDelayCategory === 'operational' && totalDelays.operationalDetails.length > 0 && (
                <div className="border-t border-orange-500/20 bg-background/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-24 text-xs">Data</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs">Detalhes</TableHead>
                        <TableHead className="w-20 text-right text-xs">Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalDelays.operationalDetails.map((item, i) => (
                        <TableRow key={i} className="hover:bg-orange-500/5">
                          <TableCell className="font-medium text-sm py-2">
                            {format(parseISO(item.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-sm py-2">{item.reason}</TableCell>
                          <TableCell className="text-muted-foreground text-sm py-2 max-w-[200px] truncate">
                            {item.details || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-orange-600 text-sm py-2">
                            {item.hours}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Atraso Climático */}
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 overflow-hidden">
              <div 
                className="p-4 cursor-pointer hover:bg-blue-500/15 transition-colors"
                onClick={() => setExpandedDelayCategory(expandedDelayCategory === 'climatic' ? null : 'climatic')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="font-medium text-blue-600">Atraso Climático</span>
                    {totalDelays.climaticDetails.length > 0 && (
                      <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30">
                        {totalDelays.climaticDetails.length} registro{totalDelays.climaticDetails.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-blue-600">{totalDelays.climatic}</span>
                    <ChevronDown className={cn(
                      "h-5 w-5 text-blue-500 transition-transform",
                      expandedDelayCategory === 'climatic' && "rotate-180"
                    )} />
                  </div>
                </div>
              </div>
              
              {expandedDelayCategory === 'climatic' && totalDelays.climaticDetails.length > 0 && (
                <div className="border-t border-blue-500/20 bg-background/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-24 text-xs">Data</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs">Detalhes</TableHead>
                        <TableHead className="w-20 text-right text-xs">Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalDelays.climaticDetails.map((item, i) => (
                        <TableRow key={i} className="hover:bg-blue-500/5">
                          <TableCell className="font-medium text-sm py-2">
                            {format(parseISO(item.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-sm py-2">{item.reason}</TableCell>
                          <TableCell className="text-muted-foreground text-sm py-2 max-w-[200px] truncate">
                            {item.details || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600 text-sm py-2">
                            {item.hours}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Outros Desvios (AMT) */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 overflow-hidden">
              <div 
                className="p-4 cursor-pointer hover:bg-amber-500/15 transition-colors"
                onClick={() => setExpandedDelayCategory(expandedDelayCategory === 'amt' ? null : 'amt')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="font-medium text-amber-600">Outros Desvios (AMT)</span>
                    {totalDelays.amtDetails.length > 0 && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                        {totalDelays.amtDetails.length} registro{totalDelays.amtDetails.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-amber-600">{totalDelays.amt}</span>
                    <ChevronDown className={cn(
                      "h-5 w-5 text-amber-500 transition-transform",
                      expandedDelayCategory === 'amt' && "rotate-180"
                    )} />
                  </div>
                </div>
              </div>
              
              {expandedDelayCategory === 'amt' && totalDelays.amtDetails.length > 0 && (
                <div className="border-t border-amber-500/20 bg-background/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-24 text-xs">Data</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs">Detalhes</TableHead>
                        <TableHead className="w-20 text-right text-xs">Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalDelays.amtDetails.map((item, i) => (
                        <TableRow key={i} className="hover:bg-amber-500/5">
                          <TableCell className="font-medium text-sm py-2">
                            {format(parseISO(item.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-sm py-2">{item.reason}</TableCell>
                          <TableCell className="text-muted-foreground text-sm py-2 max-w-[200px] truncate">
                            {item.details || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-amber-600 text-sm py-2">
                            {item.hours}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="font-bold text-red-600">Total de Atrasos</span>
                </div>
                <span className="text-2xl font-bold text-red-600">{totalDelays.total}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelaysDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog HH - Seleção de Período */}
      <Dialog open={hhDialogOpen} onOpenChange={setHhDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Exportar Homem Hora
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione o período para exportar os dados de horas trabalhadas.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !hhStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {hhStartDate ? format(hhStartDate, 'dd/MM/yyyy') : 'Selecione...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={hhStartDate}
                      onSelect={setHhStartDate}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !hhEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {hhEndDate ? format(hhEndDate, 'dd/MM/yyyy') : 'Selecione...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={hhEndDate}
                      onSelect={setHhEndDate}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Atalhos rápidos de período */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setHhStartDate(startOfMonth(today));
                  setHhEndDate(today);
                }}
              >
                Este mês
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const lastMonth = subMonths(today, 1);
                  setHhStartDate(startOfMonth(lastMonth));
                  setHhEndDate(endOfMonth(lastMonth));
                }}
              >
                Mês anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (reports.length > 0) {
                    const sorted = [...reports].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
                    setHhStartDate(parseISO(sorted[0].date));
                    setHhEndDate(parseISO(sorted[sorted.length - 1].date));
                  }
                }}
              >
                Todos os RDOs
              </Button>
            </div>

            {/* Preview de quantidade de RDOs */}
            {hhStartDate && hhEndDate && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{hhReportsInPeriod}</span> RDOs no período selecionado
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHhDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleExportManHours} 
              disabled={!hhStartDate || !hhEndDate || hhExporting}
              className="gap-2"
            >
              {hhExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Exportar Excel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
