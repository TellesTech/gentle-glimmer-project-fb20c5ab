import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { WizardProgress } from '@/components/reports/WizardProgress';
import { StepBasicInfo } from '@/components/reports/StepBasicInfo';
import { StepSafety } from '@/components/reports/StepSafety';
import { StepDocumentation } from '@/components/reports/StepDocumentation';
import { StepActivities } from '@/components/reports/StepActivities';
import { StepDeviations } from '@/components/reports/StepDeviations';
import { StepAttendance } from '@/components/reports/StepAttendance';
import { StepPhotosReview } from '@/components/reports/StepPhotosReview';
import { ParseReportModal } from '@/components/reports/ParseReportModal';
import { supabase } from '@/integrations/supabase/loose-client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { Activity, Deviation, Attendance, Shift } from '@/types';
import { format, parseISO } from 'date-fns';

export interface ReportFormData {
  // Step 1 - Basic Info
  date: Date;
  shift: Shift;
  teamId: string;
  projectId: string;
  activityLocation: string;
  startTime: string;
  endTime: string;
  maintenanceOrderTitle: string;
  maintenanceOrderNumber: string;
  // New RDO fields
  contractNumber: string;
  technicalResponsibleName: string;
  technicalResponsibleRole: string;
  supervisorName: string;
  supervisorRole: string;
  plannedWorkforce: number;
  actualWorkforce: number;
  realPercentage: number;
  // Client/Contractor fields
  clientName: string;
  clientCompany: string;
  // Step 2 - Safety
  ambulancePoint: string;
  meetingPoint: string;
  radioFrequencyWees: string;
  radioFrequencyOperation: string;
  // Step 3 - Documentation
  arrivalTimeAtLiberator: string;
  documentReleaseTime: string;
  blockRevalidationTime: string;
  blockageStatus: string;
  // Step 4 - Activities
  activities: Activity[];
  // Step 5 - Deviations
  deviations: Deviation[];
  // Step 6 - Attendance
  attendance: Attendance[];
  // Step 7 - Photos
  photos: string[];
  comments: string;
  aiSummary: string;
}

const initialFormData: ReportFormData = {
  date: new Date(),
  shift: 'morning',
  teamId: '',
  projectId: '',
  activityLocation: '',
  startTime: '07:00',
  endTime: '17:00',
  maintenanceOrderTitle: '',
  maintenanceOrderNumber: '',
  contractNumber: '',
  technicalResponsibleName: '',
  technicalResponsibleRole: '',
  supervisorName: '',
  supervisorRole: '',
  plannedWorkforce: 0,
  actualWorkforce: 0,
  realPercentage: 0,
  clientName: '',
  clientCompany: '',
  ambulancePoint: '',
  meetingPoint: '',
  radioFrequencyWees: '',
  radioFrequencyOperation: '',
  arrivalTimeAtLiberator: '',
  documentReleaseTime: '',
  blockRevalidationTime: '',
  blockageStatus: '',
  activities: [],
  deviations: [],
  attendance: [],
  photos: [],
  comments: '',
  aiSummary: '',
};

const steps = [
  { id: 1, title: 'Informações', shortTitle: 'Info' },
  { id: 2, title: 'Segurança', shortTitle: 'Seg' },
  { id: 3, title: 'Documentação', shortTitle: 'Doc' },
  { id: 4, title: 'Atividades', shortTitle: 'Ativ' },
  { id: 5, title: 'Desvios', shortTitle: 'Desv' },
  { id: 6, title: 'Efetivo', shortTitle: 'Efet' },
  { id: 7, title: 'Fotos/Revisão', shortTitle: 'Rev' },
];

export default function ReportForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!id;

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ReportFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch existing report when editing
  const { data: existingReport } = useQuery({
    queryKey: ['report-edit', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          activities:report_activities(*),
          deviations:report_deviations(*),
          attendance:report_attendance(*),
          photos:report_photos(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing && !!id,
  });

  // Fetch projects from Supabase
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, site_id, company_id')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch teams from Supabase
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, project_id, leader_id')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch eligible supervisors (profiles with supervisor/admin/director roles)
  const { data: eligibleSupervisors = [] } = useQuery({
    queryKey: ['eligible-supervisors'],
    queryFn: async () => {
      // First: fetch eligible user_ids from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin']);
      if (rolesError) throw rolesError;
      
      const eligibleUserIds = rolesData?.map(r => r.user_id) || [];
      if (eligibleUserIds.length === 0) return [];
      
      // Second: fetch profiles of these users
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', eligibleUserIds)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all profiles for attendance collaborator selector
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles-attendance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, job_title')
        .order('name');
      if (error) throw error;
      return (data || []).map(p => ({ id: p.id, name: p.name, jobTitle: p.job_title || '' }));
    },
  });

  // Fetch team members when team is selected (includes role from user_roles)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members', formData.teamId],
    queryFn: async () => {
      if (!formData.teamId) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id, profiles:user_id(id, name)');
      
      if (error) throw error;
      
      // Filter by team_id properly
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', formData.teamId);
      if (membersError) throw membersError;
      
      const userIds = membersData?.map(m => m.user_id) || [];
      if (userIds.length === 0) return [];
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, job_title')
        .in('id', userIds);
      
      // Fetch roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      return profiles?.map(p => ({
        id: p.id,
        name: p.name || 'Sem nome',
        role: roleMap.get(p.id) || 'collaborator',
        jobTitle: p.job_title || '',
      })) || [];
    },
    enabled: !!formData.teamId,
  });

  // Load existing report data when editing
  useEffect(() => {
    if (existingReport && isEditing && !dataLoaded) {
      setFormData({
        date: parseISO(existingReport.date),
        shift: existingReport.shift as Shift,
        teamId: existingReport.team_id || '',
        projectId: existingReport.project_id,
        activityLocation: existingReport.location || '',
        startTime: existingReport.start_time || '',
        endTime: existingReport.end_time || '',
        maintenanceOrderTitle: '',
        maintenanceOrderNumber: '',
        contractNumber: existingReport.contract_number || '',
        technicalResponsibleName: existingReport.technical_responsible_name || '',
        technicalResponsibleRole: existingReport.technical_responsible_role || '',
        supervisorName: existingReport.supervisor_name || '',
        supervisorRole: existingReport.supervisor_role || '',
        plannedWorkforce: existingReport.planned_workforce || 0,
        actualWorkforce: existingReport.actual_workforce || 0,
        realPercentage: existingReport.real_percentage || 0,
        clientName: (existingReport as any).client_name || '',
        clientCompany: (existingReport as any).client_company || '',
        ambulancePoint: (existingReport as any).ambulance_point || '',
        meetingPoint: (existingReport as any).meeting_point || '',
        radioFrequencyWees: (existingReport as any).radio_frequency_wees || '',
        radioFrequencyOperation: (existingReport as any).radio_frequency_operation || '',
        arrivalTimeAtLiberator: (existingReport as any).arrival_time_at_liberator || '',
        documentReleaseTime: (existingReport as any).document_release_time || '',
        blockRevalidationTime: '',
        blockageStatus: '',
        activities: existingReport.activities?.map((a: any, idx: number) => ({
          id: a.id,
          reportId: existingReport.id,
          description: a.description,
          completed: a.completed || false,
          order: idx,
        })) || [],
        deviations: existingReport.deviations?.map((d: any) => ({
          id: d.id,
          reportId: existingReport.id,
          type: d.type,
          description: d.description,
          impact: d.impact || 'low',
          correctiveAction: d.action_taken || '',
          resolved: false,
        })) || [],
        attendance: existingReport.attendance?.map((att: any) => ({
          id: att.id,
          reportId: existingReport.id,
          userName: att.user_name || '',
          userId: att.user_id || '',
          present: att.present ?? true,
          arrivalTime: att.arrival_time || '',
          departureTime: att.departure_time || '',
          functionRole: att.function_role || '',
        })) || [],
        photos: existingReport.photos?.map((p: any) => p.url) || [],
        comments: existingReport.comments || '',
        aiSummary: existingReport.ai_summary || '',
      });
      setDataLoaded(true);
    }
  }, [existingReport, isEditing, dataLoaded]);

  // Set projectId and teamId from URL params (only for new reports)
  useEffect(() => {
    if (isEditing) return;
    const projectIdFromUrl = searchParams.get('projectId');
    const teamIdFromUrl = searchParams.get('teamId');
    const dateFromUrl = searchParams.get('date');
    
    if (projectIdFromUrl && !formData.projectId) {
      setFormData(prev => ({ ...prev, projectId: projectIdFromUrl }));
    }
    if (teamIdFromUrl && !formData.teamId) {
      setFormData(prev => ({ ...prev, teamId: teamIdFromUrl }));
    }
    if (dateFromUrl) {
      setFormData(prev => ({ ...prev, date: parseISO(dateFromUrl) }));
    }
  }, [searchParams, formData.projectId, formData.teamId, isEditing]);

  // Copy from previous report if copyFrom param is present
  const copyFromId = searchParams.get('copyFrom');
  const { data: copyFromReport } = useQuery({
    queryKey: ['report-copy', copyFromId],
    queryFn: async () => {
      if (!copyFromId) return null;
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          activities:report_activities(*),
          attendance:report_attendance(*)
        `)
        .eq('id', copyFromId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!copyFromId && !isEditing,
  });

  // Apply copied data
  useEffect(() => {
    if (copyFromReport && !isEditing && !dataLoaded) {
      setFormData(prev => ({
        ...prev,
        projectId: copyFromReport.project_id,
        teamId: copyFromReport.team_id || '',
        activityLocation: copyFromReport.location || '',
        shift: copyFromReport.shift as Shift,
        startTime: copyFromReport.start_time || prev.startTime,
        endTime: copyFromReport.end_time || prev.endTime,
        activities: copyFromReport.activities?.map((a: any, idx: number) => ({
          id: `copy-${Date.now()}-${idx}`,
          reportId: '',
          description: a.description,
          completed: false,
          order: idx,
        })) || [],
        attendance: copyFromReport.attendance?.map((att: any, idx: number) => ({
          id: `copy-att-${Date.now()}-${idx}`,
          reportId: '',
          userName: att.user_name || '',
          userId: att.user_id || '',
          present: true,
          arrivalTime: att.arrival_time || '07:00',
          departureTime: att.departure_time || '17:00',
          functionRole: att.function_role || '',
        })) || [],
      }));
      setDataLoaded(true);
      toast({
        title: 'Dados copiados',
        description: 'Dados do relatório anterior foram copiados. Ajuste conforme necessário.',
      });
    }
  }, [copyFromReport, isEditing, dataLoaded, toast]);

  // Load draft from localStorage (only for new reports)
  useEffect(() => {
    if (isEditing) return;
    const savedDraft = localStorage.getItem('report-draft');
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      setFormData({
        ...parsed,
        date: new Date(parsed.date),
      });
      toast({
        title: 'Rascunho recuperado',
        description: 'Continuando de onde você parou.',
      });
    }
  }, [isEditing]);

  // Auto-save to localStorage (only for new reports)
  useEffect(() => {
    if (!isEditing) {
      localStorage.setItem('report-draft', JSON.stringify(formData));
    }
  }, [formData, isEditing]);

  const updateFormData = (data: Partial<ReportFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await saveReportToDatabase('draft');
      toast({
        title: 'Rascunho salvo',
        description: 'Seu relatório foi salvo como rascunho.',
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o rascunho.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveReportToDatabase = async (status: 'draft' | 'completed') => {
    if (!user?.id) {
      throw new Error('Usuário não autenticado');
    }

    // Validate and sanitize teamId - must be valid UUID or null
    const teamIdToSave = formData.teamId && formData.teamId.trim() !== '' 
      ? formData.teamId 
      : null;

    let reportId: string;

    if (isEditing && id) {
      // UPDATE existing report
      const { error: reportError } = await supabase
        .from('reports')
        .update({
          project_id: formData.projectId,
          team_id: teamIdToSave,
          date: format(formData.date, 'yyyy-MM-dd'),
          shift: formData.shift,
          location: formData.activityLocation,
          start_time: formData.startTime || null,
          end_time: formData.endTime || null,
          comments: formData.comments || null,
          ai_summary: formData.aiSummary || null,
          status: status,
          contract_number: formData.contractNumber || null,
          technical_responsible_name: formData.technicalResponsibleName || null,
          technical_responsible_role: formData.technicalResponsibleRole || null,
          supervisor_name: formData.supervisorName || null,
          supervisor_role: formData.supervisorRole || null,
          planned_workforce: formData.plannedWorkforce || 0,
          actual_workforce: formData.attendance.filter(a => a.present).length,
          real_percentage: formData.realPercentage || null,
          client_name: formData.clientName || null,
          client_company: formData.clientCompany || null,
        })
        .eq('id', id);

      if (reportError) {
        console.error('Error updating report:', reportError);
        throw reportError;
      }

      reportId = id;

      // Handle activities - upsert existing, insert new, delete removed
      const existingActivityIds = existingReport?.activities?.map((a: any) => a.id) || [];
      const currentActivityIds = formData.activities.filter(a => a.id).map(a => a.id);
      const activitiesToDelete = existingActivityIds.filter((id: string) => !currentActivityIds.includes(id));

      // Delete removed activities
      if (activitiesToDelete.length > 0) {
        await supabase.from('report_activities').delete().in('id', activitiesToDelete);
      }

      // Upsert activities
      for (const activity of formData.activities) {
        if (activity.id && existingActivityIds.includes(activity.id)) {
          // Update existing
          await supabase.from('report_activities').update({
            description: activity.description,
            completed: activity.completed || false,
          }).eq('id', activity.id);
        } else {
          // Insert new
          await supabase.from('report_activities').insert({
            report_id: reportId,
            description: activity.description,
            completed: activity.completed || false,
            progress: 0,
          });
        }
      }

      // Handle deviations - same pattern
      const existingDeviationIds = existingReport?.deviations?.map((d: any) => d.id) || [];
      const currentDeviationIds = formData.deviations.filter(d => d.id).map(d => d.id);
      const deviationsToDelete = existingDeviationIds.filter((id: string) => !currentDeviationIds.includes(id));

      if (deviationsToDelete.length > 0) {
        await supabase.from('report_deviations').delete().in('id', deviationsToDelete);
      }

      for (const deviation of formData.deviations) {
        if (deviation.id && existingDeviationIds.includes(deviation.id)) {
          await supabase.from('report_deviations').update({
            type: deviation.type,
            description: deviation.description,
            impact: deviation.impact || 'low',
            action_taken: deviation.correctiveAction || null,
          }).eq('id', deviation.id);
        } else {
          await supabase.from('report_deviations').insert({
            report_id: reportId,
            type: deviation.type,
            description: deviation.description,
            impact: deviation.impact || 'low',
            action_taken: deviation.correctiveAction || null,
          });
        }
      }

      // Handle attendance - same pattern
      const existingAttendanceIds = existingReport?.attendance?.map((a: any) => a.id) || [];
      const currentAttendanceIds = formData.attendance.filter(a => a.id).map(a => a.id);
      const attendanceToDelete = existingAttendanceIds.filter((id: string) => !currentAttendanceIds.includes(id));

      if (attendanceToDelete.length > 0) {
        await supabase.from('report_attendance').delete().in('id', attendanceToDelete);
      }

      for (const person of formData.attendance) {
        if (person.id && existingAttendanceIds.includes(person.id)) {
          await supabase.from('report_attendance').update({
            user_name: person.userName,
            present: person.present,
            arrival_time: person.arrivalTime || null,
            departure_time: person.departureTime || null,
            function_role: person.functionRole || null,
          }).eq('id', person.id);
        } else {
          await supabase.from('report_attendance').insert({
            report_id: reportId,
            user_name: person.userName,
            user_id: person.userId || null,
            present: person.present,
            arrival_time: person.arrivalTime || null,
            departure_time: person.departureTime || null,
            function_role: person.functionRole || null,
          });
        }
      }

      // Handle photos - same pattern
      const existingPhotoUrls = existingReport?.photos?.map((p: any) => p.url) || [];
      const currentPhotoUrls = formData.photos;
      const photosToDelete = existingReport?.photos?.filter((p: any) => !currentPhotoUrls.includes(p.url)).map((p: any) => p.id) || [];

      if (photosToDelete.length > 0) {
        await supabase.from('report_photos').delete().in('id', photosToDelete);
      }

      // Insert new photos only
      const newPhotos = currentPhotoUrls.filter(url => !existingPhotoUrls.includes(url));
      if (newPhotos.length > 0) {
        await supabase.from('report_photos').insert(
          newPhotos.map(url => ({ report_id: reportId, url, description: null }))
        );
      }

      return { id: reportId };
    } else {
      // INSERT new report
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          project_id: formData.projectId,
          team_id: teamIdToSave,
          date: format(formData.date, 'yyyy-MM-dd'),
          shift: formData.shift,
          location: formData.activityLocation,
          start_time: formData.startTime || null,
          end_time: formData.endTime || null,
          comments: formData.comments || null,
          ai_summary: formData.aiSummary || null,
          status: status,
          created_by: user.id,
          contract_number: formData.contractNumber || null,
          technical_responsible_name: formData.technicalResponsibleName || null,
          technical_responsible_role: formData.technicalResponsibleRole || null,
          supervisor_name: formData.supervisorName || null,
          supervisor_role: formData.supervisorRole || null,
          planned_workforce: formData.plannedWorkforce || 0,
          actual_workforce: formData.attendance.filter(a => a.present).length,
          real_percentage: formData.realPercentage || null,
        })
        .select()
        .single();

      if (reportError) {
        console.error('Error inserting report:', reportError);
        throw reportError;
      }

      reportId = report.id;

      // Insert activities
      if (formData.activities.length > 0) {
        const activitiesData = formData.activities.map(activity => ({
          report_id: reportId,
          description: activity.description,
          completed: activity.completed || false,
          progress: 0,
          notes: null,
        }));

        await supabase.from('report_activities').insert(activitiesData);
      }

      // Insert deviations
      if (formData.deviations.length > 0) {
        const deviationsData = formData.deviations.map(deviation => ({
          report_id: reportId,
          type: deviation.type,
          description: deviation.description,
          impact: deviation.impact || 'low',
          action_taken: deviation.correctiveAction || null,
        }));

        await supabase.from('report_deviations').insert(deviationsData);
      }

      // Insert attendance
      if (formData.attendance.length > 0) {
        const attendanceData = formData.attendance.map(person => ({
          report_id: reportId,
          user_name: person.userName,
          user_id: person.userId || null,
          present: person.present,
          arrival_time: person.arrivalTime || null,
          departure_time: person.departureTime || null,
          function_role: person.functionRole || null,
          notes: null,
        }));

        await supabase.from('report_attendance').insert(attendanceData);
      }

      // Insert photos
      if (formData.photos.length > 0) {
        const photosData = formData.photos.map(url => ({
          report_id: reportId,
          url: url,
          description: null,
        }));

        await supabase.from('report_photos').insert(photosData);
      }

      return report;
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await saveReportToDatabase('completed');
      localStorage.removeItem('report-draft');
      toast({
        title: 'Relatório enviado!',
        description: 'Seu relatório foi salvo com sucesso.',
      });
      navigate('/reports');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Transform data for step components
  const projectsForStep = projects.map(p => ({
    id: p.id,
    name: p.name,
    siteId: p.site_id,
    companyId: p.company_id,
    code: '',
    location: '',
    startDate: new Date(),
    status: 'in_progress' as const,
    supervisorId: '',
    active: true,
  }));

  const teamsForStep = teams.map(t => ({
    id: t.id,
    name: t.name,
    projectId: t.project_id,
    leaderId: t.leader_id || '',
    active: true,
  }));

  const teamMembersForStep = teamMembers.map(tm => ({
    id: tm.id,
    name: tm.name,
    email: '',
    role: (tm as any).role || 'collaborator',
    teamId: formData.teamId,
    companyId: '',
    active: true,
    createdAt: new Date(),
  }));

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepBasicInfo
            data={formData}
            onChange={updateFormData}
            teams={teamsForStep}
            projects={projectsForStep}
            eligibleSupervisors={eligibleSupervisors}
          />
        );
      case 2:
        return <StepSafety data={formData} onChange={updateFormData} />;
      case 3:
        return <StepDocumentation data={formData} onChange={updateFormData} />;
      case 4:
        return <StepActivities data={formData} onChange={updateFormData} />;
      case 5:
        return <StepDeviations data={formData} onChange={updateFormData} />;
      case 6:
        return (
          <StepAttendance
            data={formData}
            onChange={updateFormData}
            teamMembers={teamMembersForStep}
            allProfiles={allProfiles}
            defaultArrivalTime={formData.startTime || '07:00'}
            defaultDepartureTime={formData.endTime || '17:00'}
          />
        );
      case 7:
        return (
          <StepPhotosReview
            data={formData}
            onChange={updateFormData}
            projects={projectsForStep}
            teams={teamsForStep}
          />
        );
      default:
        return null;
    }
  };

  const handleAIParsedData = (parsedData: Partial<ReportFormData>) => {
    setFormData(prev => ({
      ...prev,
      ...parsedData,
    }));
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">
            {isEditing ? 'Editar Relatório' : 'Novo Relatório'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Passo {currentStep} de {steps.length}: {steps[currentStep - 1].title}
          </p>
        </div>
        {!isEditing && (
          <ParseReportModal 
            onDataParsed={handleAIParsedData}
            teamMembers={teamMembers}
            allProfiles={allProfiles}
          />
        )}
      </div>

      {/* Progress */}
      <WizardProgress steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />

      {/* Step Content */}
      <Card className="mt-6">
        <CardContent className="p-4 md:p-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 md:relative md:mt-6 p-4 bg-background border-t md:border-0 md:p-0 flex items-center justify-between gap-3 z-40">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Salvar Rascunho</span>
          </Button>

          {currentStep === steps.length ? (
            <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          ) : (
            <Button onClick={handleNext} className="gap-2">
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
