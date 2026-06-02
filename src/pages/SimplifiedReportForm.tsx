import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/loose-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { QuickReportFormContent, ReportFormData } from '@/components/reports/QuickReportFormContent';
import { ReportTabs } from '@/components/reports/ReportTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AutoServiceReportDialog } from '@/components/reports/AutoServiceReportDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useReportTabs } from '@/hooks/useReportTabs';

const formatHHMM = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const hhmmToDecimal = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.includes(':')) {
    const [hStr, mStr] = str.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h + m / 60;
  }
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
};

interface SelectionState {
  companyId: string;
  companyName: string;
  siteId: string;
  siteName: string;
  projectId: string;
  projectName: string;
  teamId: string | null;
  teamName: string | null;
}

export default function SimplifiedReportForm() {
  const { projectId, reportId } = useParams<{ projectId?: string; reportId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const isEditMode = !!reportId;
  
  // Get date from URL params (for calendar navigation)
  const dateFromUrl = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  
  // Get selection data and duplicated data from navigation state
  const navigationState = location.state as (SelectionState & { duplicatedData?: ReportFormData }) | null;
  const duplicatedData = navigationState?.duplicatedData;
  const hasSelectionState: SelectionState | null = navigationState?.projectId ? {
    companyId: navigationState.companyId,
    companyName: navigationState.companyName,
    siteId: navigationState.siteId,
    siteName: navigationState.siteName,
    projectId: navigationState.projectId,
    projectName: navigationState.projectName,
    teamId: navigationState.teamId,
    teamName: navigationState.teamName,
  } : null;

  // Tabs management - only for create mode, not edit mode
  const tabsHook = useReportTabs(projectId || '', dateFromUrl);
  const showTabs = !isEditMode && !!projectId;

  // Navigation blocker state
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Auto service report generation state
  const [showAutoGenDialog, setShowAutoGenDialog] = useState(false);
  const [autoGenData, setAutoGenData] = useState<{ projectId: string; siteId: string; reportId: string } | null>(null);
  const lastSubmittedData = useRef<{ dailyProgress: number } | null>(null);

  // Fetch existing report data if in edit mode
  const { data: existingReport, isLoading: isLoadingReport } = useQuery({
    queryKey: ['report-for-edit', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          project:projects(*, site:sites(*, company:companies(*))),
          team:teams(*),
          activities:report_activities(*),
          deviations:report_deviations(*),
          attendance:report_attendance(*),
          photos:report_photos(*),
          activity_steps:report_activity_steps(*)
        `)
        .eq('id', reportId!)
        .single();
      
      if (error) throw error;

      // Carregar TODOS os workforce_delays vinculados ao projeto nesta data
      if (data) {
        const { data: delays } = await supabase
          .from('workforce_delays')
          .select('*')
          .eq('project_id', (data as any).project_id)
          .eq('date', (data as any).date);
        
        (data as any).additional_delays = delays || [];
      }
      
      return data;

      
      if (error) throw error;
      return data;
    },
    enabled: isEditMode,
  });

  // Fetch project data if not passed in state (for create mode)
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project-for-report', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          site_id,
          company_id,
          sites!inner(id, name),
          companies!inner(id, name)
        `)
        .eq('id', projectId!)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !hasSelectionState && !isEditMode,
  });

  // Fetch first team for project if no team was selected (for create mode)
  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['project-first-team', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .eq('project_id', projectId!)
        .order('created_at')
        .limit(1)
        .single();
      return data;
    },
    enabled: !!projectId && !hasSelectionState?.teamId && !isEditMode,
  });

  // Build selection object based on mode
  const selection = isEditMode && existingReport
    ? {
        companyId: existingReport.project?.site?.company?.id || '',
        companyName: existingReport.project?.site?.company?.name || '',
        siteId: existingReport.project?.site?.id || '',
        siteName: existingReport.project?.site?.name || '',
        projectId: existingReport.project?.id || '',
        projectName: existingReport.project?.name || '',
        teamId: existingReport.team?.id || null,
        teamName: existingReport.team?.name || null,
      }
    : hasSelectionState || (projectData ? {
        companyId: projectData.company_id,
        companyName: (projectData.companies as any)?.name || '',
        siteId: projectData.site_id,
        siteName: (projectData.sites as any)?.name || '',
        projectId: projectData.id,
        projectName: projectData.name,
        teamId: teamData?.id || null,
        teamName: teamData?.name || null,
      } : null);

  // Build initial form data from existing report or duplicated data (for edit mode only)
  const editModeInitialData: ReportFormData | undefined = existingReport ? {
    date: existingReport.date,
    shift: existingReport.shift as 'morning' | 'afternoon' | 'night',
    startTime: existingReport.start_time || '',
    endTime: existingReport.end_time || '',
    location: existingReport.location || '',
    weather: (existingReport.weather as any) || '',
    dailyProgress: existingReport.daily_progress || 0,
    activities: (existingReport.activities || []).map((a: any) => ({
      description: a.description,
      completed: a.completed || false,
      progress: a.progress || 0,
    })),
    attendance: (existingReport.attendance || []).map((a: any) => ({
      userId: a.user_id,
      userName: a.user_name || '',
      present: a.present ?? true,
      arrivalTime: a.arrival_time || '',
      departureTime: a.departure_time || '',
      functionRole: a.function_role || '',
    })),
    hasDeviations: (existingReport.deviations || []).length > 0,
    deviations: (existingReport.deviations || []).map((d: any) => ({
      type: d.type || 'other',
      description: d.description || '',
      impact: d.impact || 'low',
    })),
    photos: (existingReport.photos || []).map((p: any) => p.url),
    comments: existingReport.comments || '',
    aiSummary: existingReport.ai_summary || '',
    routine: existingReport.routine || '',
    supervisorName: existingReport.supervisor_name || '',
    technicalResponsibleName: existingReport.technical_responsible_name || '',
    operationalDeviationHours: existingReport.operational_deviation_hours != null ? formatHHMM(Number(existingReport.operational_deviation_hours)) : '',
    operationalDeviationReason: existingReport.operational_deviation_reason || '',
    operationalDeviationDetails: existingReport.operational_deviation_details || '',
    climaticDeviationHours: existingReport.climatic_deviation_hours != null ? formatHHMM(Number(existingReport.climatic_deviation_hours)) : '',
    climaticDeviationReason: existingReport.climatic_deviation_reason || '',
    climaticDeviationDetails: existingReport.climatic_deviation_details || '',
    amtDeviationHours: existingReport.amt_deviation_hours != null ? formatHHMM(Number(existingReport.amt_deviation_hours)) : '',
    amtDeviationReason: existingReport.amt_deviation_reason || '',
    amtDeviationDetails: existingReport.amt_deviation_details || '',
    isEmergency: existingReport.is_emergency || false,
    maintenanceOrderNumber: existingReport.maintenance_order_number || '',
    maintenanceOrderTitle: existingReport.maintenance_order_title || '',
    blockageStatus: existingReport.blockage_status || '',
    radioFrequencyWees: existingReport.radio_frequency_wees || '',
    radioFrequencyOperation: existingReport.radio_frequency_operation || '',
    meetingPoint: existingReport.meeting_point || '',
    ambulancePoint: existingReport.ambulance_point || '',
    arrivalTimeAtLiberator: existingReport.arrival_time_at_liberator || '',
    documentReleaseTime: existingReport.document_release_time || '',
    blockRevalidationTime: existingReport.blockage_revalidation_time || '',
    noActivity: existingReport.no_activity || false,
    useWeightedProgress: existingReport.use_weighted_progress || false,
    plannedWorkforce: existingReport.planned_workforce ?? 0,
    realPercentage: existingReport.real_percentage ?? 0,
    activitySteps: (existingReport.activity_steps || []).map((s: any) => ({
      id: s.id,
      description: s.description || '',
      weight: s.weight ?? 1,
      progress: s.progress ?? 0,
      orderIndex: s.order_index ?? 0,
      totalQuantity: s.total_quantity ?? null,
      unit: s.unit ?? null,
      quantityDone: s.quantity_done ?? null,
    })),
    additionalDelays: ((existingReport as any).additional_delays || []).map((d: any) => {
      const isRdo = d.description?.startsWith('[RDO]');
      let reason = '';
      let description = d.description || '';

      if (isRdo) {
        const parts = d.description.replace('[RDO] ', '').split(': ');
        reason = parts[0] || '';
        description = parts.slice(1).join(': ') || '';
      } else {
        // Tentar encontrar o label a partir do delay_type
        // Note: DELAY_TYPES é definido em WorkforceDelaysTab, mas aqui estamos em SimplifiedReportForm.
        // Como o SimplifiedReportForm não tem acesso fácil ao enum de labels, usamos o value do delay_type como fallback.
        reason = d.delay_type || 'outro';
      }

      return {
        _id: d.id,
        _source: isRdo ? 'rdo' : 'manual',
        activity_name: d.activity_name || '',
        reason: reason,
        description: description,
        hours: formatHHMM(d.delay_hours)
      };
    }),
  } : duplicatedData;

  // Get form data based on mode
  const getFormData = useCallback((): ReportFormData | undefined => {
    if (isEditMode) {
      return editModeInitialData;
    }
    
    // In create mode with tabs, get data from active tab
    if (showTabs && tabsHook.activeTab) {
      return tabsHook.activeTab.formData;
    }
    
    return undefined;
  }, [isEditMode, editModeInitialData, showTabs, tabsHook.activeTab]);

  // Handle form data changes in tab mode
  const handleFormDataChange = useCallback((data: Partial<ReportFormData>) => {
    if (showTabs && tabsHook.activeTabId) {
      tabsHook.updateTabData(tabsHook.activeTabId, data);
    }
  }, [showTabs, tabsHook]);

  // Create report mutation
  const createReportMutation = useMutation({
    mutationFn: async ({ data, status }: { data: ReportFormData; status: 'draft' | 'pending' }) => {
      const getCompanyIdFromProject = async (projId: string) => {
        const { data: p } = await supabase.from('projects').select('company_id').eq('id', projId).single();
        return p?.company_id;
      };

      if (!selection || !user) throw new Error('Dados incompletos');

      // Create the report
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          project_id: selection.projectId!,
          team_id: selection.teamId,
          date: data.date,
          shift: data.shift,
          start_time: data.startTime || null,
          end_time: data.endTime || null,
          location: data.location || null,
          weather: data.weather || null,
          comments: data.comments || null,
          ai_summary: data.aiSummary || null,
          routine: data.routine || null,
          status: status === 'draft' ? 'draft' : 'completed',
          created_by: user.id,
          actual_workforce: data.attendance.filter(a => a.present).length,
          planned_workforce: data.plannedWorkforce || data.attendance.length,
          real_percentage: data.realPercentage ?? null,
          daily_progress: data.dailyProgress || 0,
          no_activity: data.noActivity || false,
          operational_deviation_hours: hhmmToDecimal(data.operationalDeviationHours),
          operational_deviation_reason: data.operationalDeviationReason || null,
          operational_deviation_details: data.operationalDeviationDetails || null,
          climatic_deviation_hours: hhmmToDecimal(data.climaticDeviationHours),
          climatic_deviation_reason: data.climaticDeviationReason || null,
          climatic_deviation_details: data.climaticDeviationDetails || null,
          amt_deviation_hours: hhmmToDecimal(data.amtDeviationHours),
          amt_deviation_reason: data.amtDeviationReason || null,
          amt_deviation_details: data.amtDeviationDetails || null,
          use_weighted_progress: data.useWeightedProgress || false,
          is_emergency: data.isEmergency || false,
          maintenance_order_number: data.maintenanceOrderNumber || null,
          maintenance_order_title: data.maintenanceOrderTitle || null,
          blockage_status: data.blockageStatus || null,
          supervisor_name: data.supervisorName || null,
          technical_responsible_name: data.technicalResponsibleName || null,
          radio_frequency_wees: data.radioFrequencyWees || null,
          radio_frequency_operation: data.radioFrequencyOperation || null,
          meeting_point: data.meetingPoint || null,
          ambulance_point: data.ambulancePoint || null,
          arrival_time_at_liberator: data.arrivalTimeAtLiberator || null,
          document_release_time: data.documentReleaseTime || null,
          blockage_revalidation_time: data.blockRevalidationTime || null,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Insert activity steps (weighted progress)
      if (data.useWeightedProgress && data.activitySteps && data.activitySteps.length > 0) {
        const stepsData = data.activitySteps.map(step => ({
          report_id: report.id,
          description: step.description,
          weight: step.weight,
          progress: step.progress,
          order_index: step.orderIndex,
          quantity_done: step.quantityDone ?? null,
          total_quantity: step.totalQuantity ?? null,
          unit: step.unit ?? null,
        }));
        const { error: stepsError } = await supabase.from('report_activity_steps').insert(stepsData);
        if (stepsError) throw new Error('Erro ao salvar etapas: ' + stepsError.message);
      }

      // Insert activities
      if (data.activities.length > 0) {
        const activitiesData = data.activities
          .filter(a => a.description.trim())
          .map(activity => ({
            report_id: report.id,
            description: activity.description,
            completed: activity.completed,
            progress: activity.progress,
          }));

        if (activitiesData.length > 0) {
          const { error: actError } = await supabase.from('report_activities').insert(activitiesData);
          if (actError) throw new Error('Erro ao salvar atividades: ' + actError.message);
        }
      }

      // Insert attendance
      if (data.attendance.length > 0) {
        const attendanceData = data.attendance.map(member => ({
          report_id: report.id,
          user_id: member.userId,
          user_name: member.userName,
          present: member.present,
          arrival_time: member.arrivalTime || null,
          departure_time: member.departureTime || null,
          function_role: member.functionRole || null,
        }));

        const { error: attError } = await supabase.from('report_attendance').insert(attendanceData);
        if (attError) throw new Error('Erro ao salvar efetivo: ' + attError.message);
      }

      // Insert deviations
      if (data.hasDeviations && data.deviations.length > 0) {
        const deviationsData = data.deviations
          .filter(d => d.description.trim())
          .map(deviation => ({
            report_id: report.id,
            type: deviation.type,
            description: deviation.description,
            impact: deviation.impact,
          }));

        if (deviationsData.length > 0) {
          const { error: devError } = await supabase.from('report_deviations').insert(deviationsData);
          if (devError) throw new Error('Erro ao salvar desvios: ' + devError.message);
        }
      }

      // Insert photos
      if (data.photos.length > 0) {
        const photosData = data.photos.map(url => ({
          report_id: report.id,
          url,
        }));

        const { error: photoError } = await supabase.from('report_photos').insert(photosData);
        if (photoError) throw new Error('Erro ao salvar fotos: ' + photoError.message);
      }

      // Insert additional delays into workforce_delays
      if (data.additionalDelays && data.additionalDelays.length > 0) {
        const companyId = selection.companyId || await getCompanyIdFromProject(selection.projectId!);
        const delaysData = data.additionalDelays
          .filter(d => d.activity_name.trim() || d.reason.trim())
          .map(d => ({
            project_id: selection.projectId!,
            company_id: companyId,
            date: data.date,
            activity_name: d.activity_name,
            delay_type: 'outro' as any,
            description: `[RDO] ${d.reason}${d.description ? ': ' + d.description : ''}`,
            delay_hours: parseFloat((d.hours || '00:00').split(':')[0]) + (parseFloat((d.hours || '00:00').split(':')[1] || '0') / 60)
          }));

        if (delaysData.length > 0) {
          const { error: delaysError } = await supabase.from('workforce_delays').insert(delaysData);
          if (delaysError) console.error('Erro ao salvar atrasos adicionais:', delaysError);
        }
      }

      return report;
    },
    onSuccess: async (report, { data, status }) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success(status === 'draft' ? 'Rascunho salvo!' : 'Relatório enviado!');
      
      // Remove the submitted tab if in tabs mode
      if (showTabs && tabsHook.activeTabId) {
        tabsHook.removeTab(tabsHook.activeTabId);
        
        // If there are remaining tabs, stay on the page
        if (tabsHook.tabs.length > 1) {
          return;
        }
        
        // Clear storage if all tabs are done
        tabsHook.clearStorage();
      }

      // Check if project reached 100% - trigger auto service report generation
      if (selection?.projectId && selection?.siteId) {
        try {
          // Re-fetch project progress (already updated by the mutation)
          const { data: projectRow } = await supabase
            .from('projects')
            .select('progress')
            .eq('id', selection.projectId)
            .single();

          if (projectRow && (projectRow.progress || 0) >= 100) {
            setAutoGenData({
              projectId: selection.projectId,
              siteId: selection.siteId,
              reportId: report.id,
            });
            setShowAutoGenDialog(true);
            return; // Don't navigate yet
          }
        } catch (e) {
          console.error('Error checking progress:', e);
        }
      }
      
      navigate(`/reports/${report.id}`, { replace: true });
    },
    onError: (error) => {
      console.error('Error creating report:', error);
      const msg = error instanceof Error ? error.message : (error as any)?.message || 'Erro desconhecido';
      toast.error('Erro ao criar relatório: ' + msg);
    },
  });

  // Update report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ data, status }: { data: ReportFormData; status: 'draft' | 'pending' }) => {
      if (!reportId || !user) throw new Error('Dados incompletos');

      // Update the report
      const { error: reportError } = await supabase
        .from('reports')
        .update({
          date: data.date,
          shift: data.shift,
          start_time: data.startTime || null,
          end_time: data.endTime || null,
          location: data.location || null,
          weather: data.weather || null,
          comments: data.comments || null,
          ai_summary: data.aiSummary || null,
          routine: data.routine || null,
          status: status === 'draft' ? 'draft' : 'completed',
          actual_workforce: data.attendance.filter(a => a.present).length,
          planned_workforce: data.plannedWorkforce || data.attendance.length,
          real_percentage: data.realPercentage ?? null,
          daily_progress: data.dailyProgress || 0,
          no_activity: data.noActivity || false,
          operational_deviation_hours: hhmmToDecimal(data.operationalDeviationHours),
          operational_deviation_reason: data.operationalDeviationReason || null,
          operational_deviation_details: data.operationalDeviationDetails || null,
          climatic_deviation_hours: hhmmToDecimal(data.climaticDeviationHours),
          climatic_deviation_reason: data.climaticDeviationReason || null,
          climatic_deviation_details: data.climaticDeviationDetails || null,
          amt_deviation_hours: hhmmToDecimal(data.amtDeviationHours),
          amt_deviation_reason: data.amtDeviationReason || null,
          amt_deviation_details: data.amtDeviationDetails || null,
          updated_at: new Date().toISOString(),
          is_emergency: data.isEmergency || false,
          maintenance_order_number: data.maintenanceOrderNumber || null,
          maintenance_order_title: data.maintenanceOrderTitle || null,
          blockage_status: data.blockageStatus || null,
          use_weighted_progress: data.useWeightedProgress || false,
          supervisor_name: data.supervisorName || null,
          technical_responsible_name: data.technicalResponsibleName || null,
          radio_frequency_wees: data.radioFrequencyWees || null,
          radio_frequency_operation: data.radioFrequencyOperation || null,
          meeting_point: data.meetingPoint || null,
          ambulance_point: data.ambulancePoint || null,
          arrival_time_at_liberator: data.arrivalTimeAtLiberator || null,
          document_release_time: data.documentReleaseTime || null,
          blockage_revalidation_time: data.blockRevalidationTime || null,
        })
        .eq('id', reportId);

      if (reportError) throw reportError;

      // Delete existing related data
      const deleteResults = await Promise.all([
        supabase.from('report_activities').delete().eq('report_id', reportId),
        supabase.from('report_attendance').delete().eq('report_id', reportId),
        supabase.from('report_deviations').delete().eq('report_id', reportId),
        supabase.from('report_photos').delete().eq('report_id', reportId),
        supabase.from('report_activity_steps').delete().eq('report_id', reportId),
      ]);
      const deleteError = deleteResults.find(r => r.error);
      if (deleteError?.error) throw new Error('Erro ao limpar dados anteriores: ' + deleteError.error.message);

      // Re-insert activity steps (weighted progress)
      if (data.useWeightedProgress && data.activitySteps && data.activitySteps.length > 0) {
        const stepsData = data.activitySteps.map(step => ({
          report_id: reportId,
          description: step.description,
          weight: step.weight,
          progress: step.progress,
          order_index: step.orderIndex,
          quantity_done: step.quantityDone ?? null,
          total_quantity: step.totalQuantity ?? null,
          unit: step.unit ?? null,
        }));
        const { error: stepsError } = await supabase.from('report_activity_steps').insert(stepsData);
        if (stepsError) throw new Error('Erro ao salvar etapas: ' + stepsError.message);
      }

      // Re-insert activities
      if (data.activities.length > 0) {
        const activitiesData = data.activities
          .filter(a => a.description.trim())
          .map(activity => ({
            report_id: reportId,
            description: activity.description,
            completed: activity.completed,
            progress: activity.progress,
          }));

        if (activitiesData.length > 0) {
          const { error: actError } = await supabase.from('report_activities').insert(activitiesData);
          if (actError) throw new Error('Erro ao salvar atividades: ' + actError.message);
        }
      }

      // Re-insert attendance
      if (data.attendance.length > 0) {
        const attendanceData = data.attendance.map(member => ({
          report_id: reportId,
          user_id: member.userId,
          user_name: member.userName,
          present: member.present,
          arrival_time: member.arrivalTime || null,
          departure_time: member.departureTime || null,
          function_role: member.functionRole || null,
        }));

        const { error: attError } = await supabase.from('report_attendance').insert(attendanceData);
        if (attError) throw new Error('Erro ao salvar efetivo: ' + attError.message);
      }

      // Re-insert deviations
      if (data.hasDeviations && data.deviations.length > 0) {
        const deviationsData = data.deviations
          .filter(d => d.description.trim())
          .map(deviation => ({
            report_id: reportId,
            type: deviation.type,
            description: deviation.description,
            impact: deviation.impact,
          }));

        if (deviationsData.length > 0) {
          const { error: devError } = await supabase.from('report_deviations').insert(deviationsData);
          if (devError) throw new Error('Erro ao salvar desvios: ' + devError.message);
        }
      }

      // Re-insert photos
      if (data.photos.length > 0) {
        const photosData = data.photos.map(url => ({
          report_id: reportId,
          url,
        }));

        const { error: photoError } = await supabase.from('report_photos').insert(photosData);
        if (photoError) throw new Error('Erro ao salvar fotos: ' + photoError.message);
      }

      // Sincronizar atrasos adicionais (workforce_delays)
      if (data.additionalDelays) {
        const companyId = selection.companyId || (existingReport?.project as any)?.company_id;
        const currentIds = data.additionalDelays.map(d => d._id).filter(Boolean);
        
        // 1. Deletar os que foram removidos
        // Buscamos todos os atrasos deste projeto/data que NÃO estão na lista atual
        const { data: existingDelays } = await supabase
          .from('workforce_delays')
          .select('id')
          .eq('project_id', selection.projectId!)
          .eq('date', data.date);
        
        const idsToDelete = (existingDelays || [])
          .map(d => d.id)
          .filter(id => !currentIds.includes(id));
        
        if (idsToDelete.length > 0) {
          await supabase.from('workforce_delays').delete().in('id', idsToDelete);
        }

        // 2. Upsert (Update existentes / Insert novos)
        for (const d of data.additionalDelays) {
          const isRdo = d._source === 'rdo' || d.reason.startsWith('[RDO]');
          const description = isRdo 
            ? `[RDO] ${d.reason}${d.description ? ': ' + d.description : ''}`
            : d.description;
          
          const hours = parseFloat((d.hours || '00:00').split(':')[0]) + (parseFloat((d.hours || '00:00').split(':')[1] || '0') / 60);
          
          const payload: any = {
            project_id: selection.projectId!,
            company_id: companyId,
            date: data.date,
            activity_name: d.activity_name,
            description: description,
            delay_hours: hours,
          };

          if (d._id) {
            await supabase.from('workforce_delays').update(payload).eq('id', d._id);
          } else {
            payload.delay_type = 'outro'; // Default para novos
            await supabase.from('workforce_delays').insert(payload);
          }
        }
      }

      return { id: reportId };
    },
    onSuccess: (report, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      toast.success(status === 'draft' ? 'Rascunho salvo!' : 'Relatório atualizado!');
      navigate(`/reports/${report.id}`, { replace: true });
    },
    onError: (error) => {
      console.error('Error updating report:', error);
      toast.error('Erro ao atualizar relatório: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    },
  });

  const handleBack = () => {
    // Check for unsaved changes in tabs mode
    if (showTabs && tabsHook.hasDirtyTabs) {
      setPendingNavigation('back');
      setShowLeaveDialog(true);
      return;
    }
    
    performNavigation('back');
  };

  const performNavigation = (target: string) => {
    if (showTabs) {
      tabsHook.clearStorage();
    }
    
    if (target === 'back') {
      navigate(-1);
    }
  };

  const confirmLeave = () => {
    if (pendingNavigation) {
      performNavigation(pendingNavigation);
    }
    setShowLeaveDialog(false);
    setPendingNavigation(null);
  };

  const handleSubmit = async (data: ReportFormData, status: 'draft' | 'pending') => {
    if (isEditMode) {
      await updateReportMutation.mutateAsync({ data, status });
    } else {
      await createReportMutation.mutateAsync({ data, status });
    }
  };

  const isLoading = isLoadingProject || isLoadingTeam || isLoadingReport;
  const isSubmitting = createReportMutation.isPending || updateReportMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">
          {isEditMode ? 'Relatório não encontrado' : 'Projeto não encontrado'}
        </p>
      </div>
    );
  }

  // Get current form data based on mode
  const currentFormData = getFormData();

  return (
    <>
      {/* Tabs bar for create mode */}
      {showTabs && (
        <ReportTabs
          tabs={tabsHook.tabs}
          activeTabId={tabsHook.activeTabId}
          onAddTab={tabsHook.addTab}
          onAddTabFromExisting={() => tabsHook.addTabFromExisting(tabsHook.activeTabId)}
          onRemoveTab={tabsHook.removeTab}
          onSelectTab={tabsHook.setActiveTab}
          canAddTab={tabsHook.canAddTab}
        />
      )}
      
      <div className="rounded-lg">
        <QuickReportFormContent
          key={showTabs ? tabsHook.activeTabId : reportId}
          selection={selection}
          onBack={handleBack}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          initialData={currentFormData}
          isEditMode={isEditMode}
          tabId={showTabs ? tabsHook.activeTabId : undefined}
          onFormDataChange={showTabs ? handleFormDataChange : undefined}
        />
      </div>

      <ConfirmDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        title="Sair sem salvar?"
        description="Você tem alterações não salvas em uma ou mais abas. Deseja descartar as alterações e sair?"
        confirmText="Sair"
        cancelText="Continuar editando"
        variant="destructive"
        onConfirm={confirmLeave}
      />

      {autoGenData && (
        <AutoServiceReportDialog
          open={showAutoGenDialog}
          onOpenChange={setShowAutoGenDialog}
          projectId={autoGenData.projectId}
          siteId={autoGenData.siteId}
          reportId={autoGenData.reportId}
        />
      )}
    </>
  );
}
