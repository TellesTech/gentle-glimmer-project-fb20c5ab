import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
 import {
   ChevronLeft, Sun, Sunset, Moon, MapPin, Clock, Users, User,
   AlertTriangle, AlertCircle, CheckCircle2, Circle, Camera, Building2, FolderKanban,
   Edit, Copy, Download, Loader2, X, Archive, Trash2, RotateCcw,
   FileText, CalendarDays, Timer, MessageSquare, ClipboardList, History, Share2,
   PenTool, Globe, Send, Sparkles, Edit3, RefreshCw, Check, Bot
 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState, StatusBadge } from '@/components/shared';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PhotoGallery } from '@/components/reports/PhotoGallery';
import { ApprovalTimeline } from '@/components/reports/ApprovalTimeline';
import { ReportProgressStepper } from '@/components/reports/ReportProgressStepper';
import { ShareReportDialog } from '@/components/client/ShareReportDialog';
import { SendAutentiqueDialog } from '@/components/reports/SendAutentiqueDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

import { toast } from 'sonner';
import { generateReportPdf } from '@/lib/generateReportPdf';
import type { Shift, DeviationType, ImpactLevel, ReportStatus } from '@/types';
import { cn } from '@/lib/utils';
import { ReportDetailTabs } from '@/components/reports/ReportDetailTabs';
import { OneClickSignatureCard } from '@/components/signatures/OneClickSignatureCard';


const SHIFT_CONFIG: Record<Shift, { label: string; icon: typeof Sun; color: string }> = {
  morning: { label: 'Manhã', icon: Sun, color: 'bg-warning/20 text-warning' },
  afternoon: { label: 'Tarde', icon: Sunset, color: 'bg-primary/20 text-primary' },
  night: { label: 'Noite', icon: Moon, color: 'bg-muted text-foreground/70' },
};

const DEVIATION_TYPE_LABELS: Record<DeviationType, string> = {
  delay: 'Atraso',
  equipment: 'Equipamento',
  safety: 'Segurança',
  other: 'Outro',
  weather: 'Clima',
  materials: 'Materiais',
  labor: 'Mão de Obra',
  stoppage: 'Paralização',
  contractor: 'Contratante',
  supplier: 'Fornecedor',
  project_design: 'Projeto',
  planning: 'Planejamento',
  execution: 'Execução',
};

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; color: string; badge: string }> = {
  high: { label: 'Alto', color: 'border-destructive bg-destructive/10', badge: 'bg-destructive text-destructive-foreground' },
  medium: { label: 'Médio', color: 'border-warning bg-warning/10', badge: 'bg-warning text-warning-foreground' },
  low: { label: 'Baixo', color: 'border-success bg-success/10', badge: 'bg-success text-success-foreground' },
};

export default function ReportDetail() {
  const { id: reportId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAutentiqueDialog, setShowAutentiqueDialog] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // AI Summary edit state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);

  const queryClient = useQueryClient();

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!reportId) throw new Error('Report ID is required');

      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          project:projects(*, site:sites(*, company:companies(*))),
          team:teams(*),
          creator:profiles!created_by(id, name, avatar_url),
          approver:profiles!approved_by(id, name),
          activities:report_activities(*),
          deviations:report_deviations(*),
          attendance:report_attendance(*),
          photos:report_photos(*),
          signatures:report_signatures(*)
        `)
        .eq('id', reportId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });

  // Query for report history
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['report-history', reportId],
    queryFn: async () => {
      if (!reportId) return [];

      const { data, error } = await supabase
        .from('report_history')
        .select(`
          id,
          action,
          action_at,
          details,
          old_values,
          new_values,
          actor:profiles!action_by(id, name, avatar_url)
        `)
        .eq('report_id', reportId)
        .order('action_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!reportId,
  });

  // Query for sibling reports (same project + date)
  const { data: siblingReports } = useQuery({
    queryKey: ['sibling-reports', reportData?.project_id, reportData?.date],
    queryFn: async () => {
      if (!reportData?.project_id || !reportData?.date) return [];

      const { data, error } = await supabase
        .from('reports')
        .select('id, shift, rdo_number, created_at')
        .eq('project_id', reportData.project_id)
        .eq('date', reportData.date)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!reportData?.project_id && !!reportData?.date,
  });

  // Current user profile (for one-click signing on this RDO)
  const { data: currentUserProfile } = useQuery({
    queryKey: ['current-user-signing-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('id, name, email, job_title, signature_data')
        .eq('id', user.id)
        .maybeSingle();
      return prof || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Branding (system_name) for the WEES badge
  const { data: brandingName } = useQuery({
    queryKey: ['report-detail-branding-name'],
    queryFn: async () => {
      const { data: brand } = await (supabase as any).rpc('get_public_branding');
      const row = Array.isArray(brand) ? brand[0] : brand;
      return row?.system_name || 'WEES';
    },
    staleTime: 10 * 60 * 1000,
  });

  const [isSigningInline, setIsSigningInline] = useState(false);
  const [isReverifying, setIsReverifying] = useState(false);

  const handleReverifyAttendance = async () => {
    if (!reportId || !report?.attendance) return;
    const unmatched = report.attendance.filter((a: any) => !a.user_id);
    if (unmatched.length === 0) {
      toast.info('Todos os colaboradores já estão cadastrados.');
      return;
    }
    setIsReverifying(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, job_title');
      if (error) throw error;

      const stripAccents = (s: string) =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const norm = (s: string) =>
        stripAccents(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
      const tokens = (s: string) =>
        norm(s).split(' ').filter((t) => t.length >= 3);
      // Levenshtein distance for fuzzy single-token comparisons
      const lev = (a: string, b: string) => {
        const m = a.length, n = b.length;
        if (!m) return n; if (!n) return m;
        const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++)
          for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
              ? dp[i - 1][j - 1]
              : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        return dp[m][n];
      };
      const tokenSimilar = (a: string, b: string) => {
        if (a === b) return true;
        if (Math.abs(a.length - b.length) > 2) return false;
        const maxLen = Math.max(a.length, b.length);
        const d = lev(a, b);
        return d <= 1 || d / maxLen <= 0.2; // tolerate small typos
      };
      const findMatch = (name: string) => {
        const needle = norm(name);
        if (!needle) return null;
        // 1) exact normalized
        let match = (profiles || []).find((p: any) => p.name && norm(p.name) === needle);
        if (match) return match;
        // 2) token-based: at least 2 tokens match (or 1 if needle has only 1)
        const needleTokens = tokens(name);
        if (needleTokens.length === 0) return null;
        let best: { p: any; score: number } | null = null;
        for (const p of profiles || []) {
          if (!p.name) continue;
          const pTokens = tokens(p.name);
          if (pTokens.length === 0) continue;
          let score = 0;
          for (const nt of needleTokens) {
            if (pTokens.some((pt) => tokenSimilar(nt, pt))) score++;
          }
          const required = needleTokens.length === 1 ? 1 : 2;
          if (score >= required && (!best || score > best.score)) {
            best = { p, score };
          }
        }
        return best?.p || null;
      };

      let updated = 0;
      for (const a of unmatched) {
        const m = findMatch(a.user_name || '');
        if (!m) continue;
        const { error: updErr } = await supabase
          .from('report_attendance')
          .update({
            user_id: m.id,
            user_name: m.name,
            function_role: m.job_title || a.function_role,
          })
          .eq('id', a.id);
        if (!updErr) updated++;
      }

      if (updated > 0) {
        toast.success(`${updated} de ${unmatched.length} colaborador(es) vinculado(s).`);
        queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      } else {
        toast.warning('Nenhum cadastro correspondente encontrado.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao reverificar cadastros');
    } finally {
      setIsReverifying(false);
    }
  };

  const handleInlineSign = async (signatureDataUrl: string) => {
    if (!reportId || !currentUserProfile) return;
    setIsSigningInline(true);
    try {
      const signerName = currentUserProfile.name || user?.email || 'Colaborador';
      const signerRole =
        currentUserProfile.job_title ||
        (role === 'super_admin'
          ? 'Super Administrador'
          : role === 'admin'
          ? 'Administrador'
          : 'Colaborador');
      const signerEmail = currentUserProfile.email || user?.email || null;

      const response = await supabase.functions.invoke('submit-signature', {
        body: {
          reportId,
          signatureData: signatureDataUrl,
          signerName,
          signerRole,
          signerEmail,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('✨ Relatório assinado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['report-history', reportId] });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao assinar relatório');
    } finally {
      setIsSigningInline(false);
    }
  };

  useEffect(() => {
    if (!reportId) return;

    const channel = supabase
      .channel(`report-history-${reportId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'report_history',
          filter: `report_id=eq.${reportId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['report-history', reportId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reportId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reportData) {
    return (
      <EmptyState
        icon={Camera}
        title="Relatório não encontrado"
        action={<Button asChild><Link to="/reports">Voltar</Link></Button>}
      />
    );
  }

  const report = reportData;
  const project = report.project;
  const site = project?.site;
  const company = site?.company;

  const shift = report.shift as Shift;
  const ShiftIcon = SHIFT_CONFIG[shift]?.icon || Sun;
  const completedActivities = report.activities?.filter((a: any) => a.completed).length || 0;
  const totalActivities = report.activities?.length || 0;
  const presentAttendance = report.attendance?.filter((a: any) => a.present).length || 0;
  const totalAttendance = report.attendance?.length || 0;

  // Generate RDO code with sequential number
  const rdoNumber = (report.rdo_number ?? 1).toString().padStart(3, '0');
  const rdoDateFormatted = format(parseISO(report.date), 'dd/MM/yyyy');
  const rdoCode = `RDO-${project?.code || 'XXX'}-${format(parseISO(report.date), 'yyyyMMdd')}`;

  const handleDownloadPdf = async () => {
    if (report && company && site && project) {
      setIsGeneratingPdf(true);
      try {
        // Fetch system settings for brand colors and logo
        const { data: systemSettings } = await supabase
          .from('system_settings')
          .select('primary_color, accent_color, logo_url, pdf_logo_url')
          .limit(1)
          .single();

        const reportForPdf = {
          id: report.id,
          date: parseISO(report.date),
          shift: report.shift as Shift,
          activityLocation: report.location || '',
          startTime: report.start_time || '',
          endTime: report.end_time || '',
          status: report.status as ReportStatus,
          comments: report.comments || '',
          ai_summary: report.ai_summary || '',
          routine: report.routine || '',
          projectId: project.id,
          projectName: project.name,
          teamId: report.team_id || '',
          teamName: report.team?.name || '',
          createdById: report.created_by || '',
          createdByName: report.creator?.name || '',
          maintenanceOrderTitle: report.maintenance_order_title || '',
          maintenanceOrderNumber: report.maintenance_order_number || '',
          ambulancePoint: report.ambulance_point || '',
          meetingPoint: report.meeting_point || '',
          radioFrequencyWees: report.radio_frequency_wees || '',
          radioFrequencyOperation: report.radio_frequency_operation || '',
          arrivalTimeAtLiberator: report.arrival_time_at_liberator || '',
          documentReleaseTime: report.document_release_time || '',
          blockRevalidationTime: report.blockage_revalidation_time || '',
          activities: (report.activities || []).map((a: any, index: number) => ({
            id: a.id,
            reportId: report.id,
            description: a.description,
            completed: a.completed,
            order: index,
          })),
          deviations: (report.deviations || []).map((d: any) => ({
            id: d.id,
            reportId: report.id,
            type: d.type as DeviationType,
            description: d.description,
            impact: d.impact as ImpactLevel,
            correctiveAction: d.action_taken,
            resolved: false,
          })),
          attendance: (report.attendance || []).map((a: any) => ({
            id: a.id,
            reportId: report.id,
            userId: a.user_id || '',
            userName: a.user_name,
            present: a.present,
            arrivalTime: a.arrival_time,
            departureTime: a.departure_time,
            functionRole: a.function_role,
          })),
          photos: (report.photos || []).map((p: any) => ({
            id: p.id,
            reportId: report.id,
            url: p.url,
            description: p.description,
            uploadedAt: new Date(p.created_at || Date.now()),
          })),
          signatures: (report.signatures || []).map((s: any) => ({
            id: s.id,
            reportId: report.id,
            signerName: s.signer_name,
            signerRole: s.signer_role,
            signatureData: s.signature_data,
            signedAt: new Date(s.signed_at),
            ipAddress: s.ip_address,
          })),
          createdAt: new Date(report.created_at || Date.now()),
          updatedAt: new Date(report.updated_at || Date.now()),
        };

        const companyForPdf = {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj || '',
          logo: company.logo_url || undefined,
          address: company.address || undefined,
          phone: company.phone || undefined,
          email: company.email || undefined,
          active: true,
          createdAt: new Date(company.created_at || Date.now()),
        };

        const siteForPdf = {
          id: site.id,
          companyId: site.company_id,
          name: site.name,
          city: site.city || '',
          state: site.state || '',
          address: site.address || undefined,
          active: true,
          createdAt: new Date(site.created_at || Date.now()),
        };

        const projectForPdf = {
          id: project.id,
          companyId: project.company_id,
          siteId: project.site_id,
          name: project.name,
          code: project.code || '',
          location: '',
          startDate: new Date(project.start_date || Date.now()),
          expectedEndDate: project.end_date ? new Date(project.end_date) : undefined,
          status: (project.status || 'in_progress') as any,
          supervisorId: '',
          active: true,
        };

        const signaturesForPdf = (report.signatures || []).map((s: any) => ({
          id: s.id,
          signerName: s.signer_name,
          signerRole: s.signer_role,
          signatureData: s.signature_data,
          signedAt: s.signed_at,
          ipAddress: s.ip_address,
        }));

        // Pass system settings (colors + logo) to the PDF generator
        const tenantColors = systemSettings ? {
          primary_color: systemSettings.primary_color,
          accent_color: systemSettings.accent_color,
          logo_url: systemSettings.logo_url,
          pdf_logo_url: systemSettings.pdf_logo_url,
        } : undefined;

        await generateReportPdf(reportForPdf, companyForPdf, siteForPdf, projectForPdf, signaturesForPdf, tenantColors);
        toast.success('PDF baixado com sucesso!');
      } catch (error) {
        console.error('Error generating PDF:', error);
        toast.error('Erro ao gerar PDF');
      } finally {
        setIsGeneratingPdf(false);
      }
    }
  };

  const handleDuplicate = () => {
    // Dados do formulário (sem fotos, progresso zerado)
    const duplicatedFormData = {
      date: format(new Date(), 'yyyy-MM-dd'),
      shift: report.shift as 'morning' | 'afternoon' | 'night',
      startTime: report.start_time || '',
      endTime: report.end_time || '',
      location: report.location || '',
      dailyProgress: 0,
      activities: (report.activities || []).map((a: any) => ({
        description: a.description,
        completed: false,
        progress: 0,
      })),
      attendance: (report.attendance || []).map((a: any) => ({
        userId: a.user_id,
        userName: a.user_name,
        present: true,
      })),
      hasDeviations: false,
      deviations: [],
      photos: [],
      comments: report.comments || '',
      aiSummary: '',
    };

    // Dados da hierarquia
    const selectionData = {
      companyId: company?.id || '',
      companyName: company?.name || '',
      siteId: site?.id || '',
      siteName: site?.name || '',
      projectId: project?.id || '',
      projectName: project?.name || '',
      teamId: report.team?.id || null,
      teamName: report.team?.name || null,
    };

    toast.success('Relatório duplicado! Complete os dados e salve.');

    // Navegar diretamente para o formulário com os dados
    navigate(`/reports/create/${report.project_id}`, {
      state: {
        ...selectionData,
        duplicatedData: duplicatedFormData,
      },
    });
  };

  const canEdit = role === 'super_admin' || role === 'admin' ||
                  (user?.id === report.created_by && (report.status === 'draft' || report.status === 'completed'));
  const canDelete = role === 'super_admin' || role === 'admin';
  const canArchive = canEdit;
  const isArchived = !!report.archived_at;

  const handleArchive = async () => {
    const { error } = await supabase
      .from('reports')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', reportId);
    
    if (error) {
      toast.error('Erro ao arquivar relatório');
    } else {
      toast.success('Relatório arquivado!');
      navigate('/reports');
    }
  };

  const handleUnarchive = async () => {
    const { error } = await supabase
      .from('reports')
      .update({ archived_at: null })
      .eq('id', reportId);
    
    if (error) {
      toast.error('Erro ao restaurar relatório');
    } else {
      toast.success('Relatório restaurado!');
      navigate('/reports');
    }
  };

  const handleDelete = async () => {
    try {
      const { error, count } = await supabase
        .from('reports')
        .delete({ count: 'exact' })
        .eq('id', reportId);

      if (error) {
        if (error.code === '23503') {
          throw new Error('Existem dados vinculados que impedem a exclusão.');
        }
        throw error;
      }
      if (count === 0) {
        toast.error('Sem permissão para excluir este relatório.');
        return;
      }

      toast.success('Relatório apagado!');
      navigate('/reports');
    } catch (error: any) {
      console.error('Error deleting report:', error);
      toast.error(error.message || 'Erro ao apagar relatório');
    }
  };
  const handleSaveSummary = async () => {
    if (!reportId) return;
    setIsSavingSummary(true);
    const { data, error } = await supabase
      .from('reports')
      .update({ ai_summary: editedSummary })
      .eq('id', reportId)
      .select('id');
    setIsSavingSummary(false);
    if (error) {
      toast.error('Erro ao salvar resumo');
    } else if (!data || data.length === 0) {
      toast.error('Sem permissão para editar este RDO');
    } else {
      toast.success('Resumo salvo!');
      setIsEditingSummary(false);
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    }
  };

  const handleRegenerateSummary = async () => {
    if (!report) return;
    setIsRegeneratingSummary(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-report-summary', {
        body: {
          activities: (report.activities || []).map((a: any) => ({
            description: a.description,
            completed: a.completed,
          })),
          deviations: (report.deviations || []).map((d: any) => ({
            description: d.description,
          })),
          attendance: (report.attendance || []).map((a: any) => ({
            present: a.present,
          })),
          date: format(parseISO(report.date), 'dd/MM/yyyy'),
          shift: report.shift,
          projectName: project?.name,
        },
      });

      if (error || !result?.summary) {
        toast.error(result?.error || 'Erro ao regenerar resumo');
      } else {
        // Save directly
        const { data: updated, error: updErr } = await supabase
          .from('reports')
          .update({ ai_summary: result.summary })
          .eq('id', reportId)
          .select('id');
        if (updErr) {
          toast.error('Erro ao salvar resumo regenerado');
        } else if (!updated || updated.length === 0) {
          toast.error('Sem permissão para editar este RDO');
        } else {
          toast.success('Resumo regenerado!');
          queryClient.invalidateQueries({ queryKey: ['report', reportId] });
        }
      }
    } catch (err) {
      toast.error('Erro ao conectar com a IA');
    } finally {
      setIsRegeneratingSummary(false);
    }
  };

  const reportForTimeline = {
    id: report.id,
    date: parseISO(report.date),
    shift: report.shift as Shift,
    status: report.status as ReportStatus,
    createdAt: new Date(report.created_at || Date.now()),
    updatedAt: new Date(report.updated_at || Date.now()),
    createdByName: report.creator?.name || '',
    approvedAt: report.approved_at ? new Date(report.approved_at) : undefined,
    approvedByName: report.approver?.name || undefined,
    activityLocation: report.location || '',
    startTime: report.start_time || '',
    endTime: report.end_time || '',
    projectId: report.project_id,
    projectName: project?.name || '',
    teamId: report.team_id || '',
    teamName: report.team?.name || '',
    createdById: report.created_by || '',
    maintenanceOrderTitle: report.location || '',
    activities: (report.activities || []).map((a: any, index: number) => ({
      id: a.id,
      reportId: report.id,
      description: a.description,
      completed: a.completed,
      order: index,
    })),
    deviations: (report.deviations || []).map((d: any) => ({
      id: d.id,
      reportId: report.id,
      type: d.type as DeviationType,
      description: d.description,
      impact: d.impact as ImpactLevel,
      correctiveAction: d.action_taken,
      resolved: false,
    })),
    attendance: (report.attendance || []).map((a: any) => ({
      id: a.id,
      reportId: report.id,
      userId: a.user_id || '',
      userName: a.user_name,
      present: a.present,
      arrivalTime: a.arrival_time,
      departureTime: a.departure_time,
    })),
    photos: (report.photos || []).map((p: any) => ({
      id: p.id,
      reportId: report.id,
      url: p.url,
      description: p.description,
      uploadedAt: new Date(p.created_at || Date.now()),
    })),
    comments: report.comments || '',
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Sibling Report Tabs - always visible */}
      {siblingReports && (
        <ReportDetailTabs
          siblings={siblingReports}
          activeReportId={reportId!}
          projectId={report.project_id}
          reportDate={report.date}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Content wrapper */}
      <div className="rounded-lg space-y-6">

      {/* Premium Header - Corporate Style */}
      <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-primary-foreground shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shrink-0">
              <FileText className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight truncate">{company?.name || 'Relatório Diário'}</h1>
              <p className="text-primary-foreground/80 text-xs sm:text-sm font-mono mt-0.5 sm:mt-1">RDO Nº {rdoNumber} - {rdoDateFormatted}</p>
            </div>
          </div>
          
          <div className="flex flex-col xs:flex-row xs:flex-wrap sm:flex-col items-start xs:items-center sm:items-end gap-2 w-full sm:w-auto">
            <StatusBadge status={report.status as ReportStatus} />
            <p className="text-xs sm:text-sm text-primary-foreground/80">
              {format(parseISO(report.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-muted/30 to-background">
        <CardContent className="py-4 px-4 sm:px-6">
          <ReportProgressStepper 
            status={report.status as ReportStatus}
            hasDocuments={!!(report as any).signed_pdf_url}
          />
        </CardContent>
      </Card>

      {/* General Info Card */}
      <Card className="border-2 border-border/50 shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Informações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Empresa */}
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fábrica</p>
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <p className="font-medium text-sm truncate">{company?.name || 'N/A'}</p>
              </div>
            </div>
            
            {/* Unidade/Site */}
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Unidade</p>
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <p className="font-medium text-sm truncate">{site?.name || 'N/A'}</p>
              </div>
            </div>
            
            {/* Atividade */}
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Atividade</p>
              <div className="flex items-center gap-2 min-w-0">
                <FolderKanban className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <p className="font-medium text-sm truncate">
                  {report.location || report.maintenance_order_title || 
                    ((project?.name && project.name !== '*' && !project.name.startsWith('Atividade criada via'))
                      ? project.name : 'N/A')}
                </p>
              </div>
            </div>
            
            {/* Local */}
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Local de Atividade</p>
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <p className="font-medium text-sm truncate">{report.location || 'Não informado'}</p>
              </div>
            </div>

            {/* Ordem de Manutenção */}
            {(report.maintenance_order_title || report.maintenance_order_number) && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ordem de Manutenção</p>
                <div className="space-y-1">
                  {report.is_emergency && (
                    <Badge className="bg-destructive text-destructive-foreground text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Emergência
                    </Badge>
                  )}
                  {report.maintenance_order_number && (
                    <p className="font-medium text-sm">Nº OM: {report.maintenance_order_number}</p>
                  )}
                  {report.maintenance_order_title && (
                    <p className="font-medium text-sm">{report.maintenance_order_title}</p>
                  )}
                  {report.blockage_status && (
                    <p className="text-xs text-muted-foreground">Bloqueio: {report.blockage_status}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Data/Turno */}
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Data / Turno</p>
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <CalendarDays className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <p className="font-medium text-sm">
                  {format(parseISO(report.date), 'dd/MM/yyyy')}
                </p>
                <Badge className={cn('text-xs', SHIFT_CONFIG[shift]?.color)}>
                  <ShiftIcon className="w-3 h-3 mr-1" />
                  {SHIFT_CONFIG[shift]?.label}
                </Badge>
              </div>
            </div>
            
            {/* Horário */}
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Horário de Trabalho</p>
              <div className="flex items-center gap-2 min-w-0">
                <Timer className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <p className="font-medium text-sm">
                  {report.start_time || '--:--'} às {report.end_time || '--:--'}
                </p>
              </div>
            </div>

            {/* Faixa de Rádio Wees */}
            {report.radio_frequency_wees && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Faixa de Rádio Wees</p>
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-4 h-4 text-warning shrink-0" />
                  <p className="font-medium text-sm">{report.radio_frequency_wees}</p>
                </div>
              </div>
            )}

            {/* Faixa de Rádio Operação */}
            {report.radio_frequency_operation && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Faixa de Rádio Operação</p>
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-4 h-4 text-success shrink-0" />
                  <p className="font-medium text-sm">{report.radio_frequency_operation}</p>
                </div>
              </div>
            )}

            {/* Ponto de Encontro */}
            {report.meeting_point && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ponto de Encontro</p>
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-medium text-sm">{report.meeting_point}</p>
                </div>
              </div>
            )}

            {/* Ponto de Ambulância */}
            {report.ambulance_point && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ponto de Ambulância</p>
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-destructive shrink-0" />
                  <p className="font-medium text-sm">{report.ambulance_point}</p>
                </div>
              </div>
            )}

            {/* Chegada no Liberador */}
            {report.arrival_time_at_liberator && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Chegada no Liberador</p>
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-medium text-sm">{report.arrival_time_at_liberator}</p>
                </div>
              </div>
            )}

            {/* Liberação da Documentação */}
            {report.document_release_time && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Liberação da Documentação</p>
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-success shrink-0" />
                  <p className="font-medium text-sm">{report.document_release_time}</p>
                </div>
              </div>
            )}

            {/* Revalidação de Bloqueio */}
            {report.blockage_revalidation_time && (
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Revalidação de Bloqueio</p>
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 text-warning shrink-0" />
                  <p className="font-medium text-sm">{report.blockage_revalidation_time}</p>
                </div>
              </div>
            )}

            {/* Criado Por */}
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Criado Por</p>
              {(() => {
                const creatorName = (report.creator as any)?.name;
                const creatorAvatar = (report.creator as any)?.avatar_url;
                const whatsAppEntry = !creatorName && historyData?.find((h: any) => h.action === 'whatsapp_created');
                const whatsAppSender = whatsAppEntry?.details && typeof whatsAppEntry.details === 'object' && !Array.isArray(whatsAppEntry.details) ? (whatsAppEntry.details as Record<string, unknown>).sender_name as string | undefined : undefined;
                const validWhatsAppSender = whatsAppSender && whatsAppSender.trim().length >= 2 && /[a-zA-ZÀ-ú]/.test(whatsAppSender) ? whatsAppSender.trim() : undefined;
                const displayName = creatorName || validWhatsAppSender || (whatsAppEntry ? 'Supervisor (via WhatsApp)' : 'N/A');
                const isWhatsApp = !creatorName && !!whatsAppEntry;

                return (
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-6 w-6">
                      {!isWhatsApp && <AvatarImage src={creatorAvatar || undefined} />}
                      <AvatarFallback className={cn(
                        "text-xs",
                        isWhatsApp ? "bg-emerald-500/20 text-emerald-600" : "bg-primary/10 text-primary"
                      )}>
                        {isWhatsApp 
                          ? <Bot className="w-3 h-3" />
                          : getInitials(displayName)
                        }
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {displayName}
                        {isWhatsApp && <span className="text-xs font-normal text-muted-foreground ml-1">(via WhatsApp)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.created_at ? format(parseISO(report.created_at), "dd/MM/yyyy 'às' HH:mm") : ''}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities Card - Industrial Style */}
      {report.activities && report.activities.length > 0 && (
        <Card className="border-l-4 border-l-success shadow-sm">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-success" />
              {report.location || 'Atividades Executadas'}
            </CardTitle>
            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
              {completedActivities}/{totalActivities} concluídas
            </Badge>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {report.activities.map((activity: any) => (
                <li key={activity.id} className="py-3 flex items-start gap-3">
                  {activity.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      'text-sm',
                      activity.completed ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {activity.description}
                    </p>
                    {activity.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {activity.notes}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Rotina Card */}
      {report.routine && (
        <Card className="border-l-4 border-l-info shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-info" />
              Rotina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <p className="text-sm text-foreground whitespace-pre-wrap">{report.routine}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deviations Card - Industrial Style with Risk Classification */}
      {report.deviations && report.deviations.length > 0 && (
        <Card className="border-l-4 border-l-destructive shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Desvios / Segurança
              <Badge variant="destructive" className="ml-auto">
                {report.deviations.length} {report.deviations.length === 1 ? 'desvio' : 'desvios'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.deviations.map((deviation: any) => (
              <div
                key={deviation.id}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all',
                  IMPACT_CONFIG[deviation.impact as ImpactLevel]?.color || 'border-muted bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className={IMPACT_CONFIG[deviation.impact as ImpactLevel]?.badge || 'bg-muted'}>
                    {deviation.impact === 'high' && '🔴 '}
                    {deviation.impact === 'medium' && '🟡 '}
                    {deviation.impact === 'low' && '🟢 '}
                    Impacto {IMPACT_CONFIG[deviation.impact as ImpactLevel]?.label || deviation.impact}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {DEVIATION_TYPE_LABELS[deviation.type as DeviationType] || deviation.type}
                  </Badge>
                </div>
                <p className="text-sm font-medium mb-2 whitespace-pre-wrap">{deviation.description}</p>
                {deviation.action_taken && (
                  <div className="text-sm bg-background/50 p-3 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">
                      Ação Corretiva
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">{deviation.action_taken}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Attendance Card - Industrial Style with Mini-Cards */}
      {report.attendance && report.attendance.length > 0 && (
        <Card className="border-l-4 border-l-info shadow-sm">
          <CardHeader className="flex-row items-center justify-between pb-3 gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-info" />
              Efetivo
            </CardTitle>
            <div className="flex items-center gap-2">
              {report.attendance?.some((a: any) => !a.user_id) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReverifyAttendance}
                  disabled={isReverifying}
                  className="h-8"
                >
                  {isReverifying ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Reverificar cadastros
                </Button>
              )}
              <Badge variant="secondary" className="bg-info/10 text-info border-info/20">
                {presentAttendance}/{totalAttendance} presentes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {report.attendance.map((person: any) => {
                const isUnmatched = !person.user_id;
                
                return (
                  <div
                    key={person.id}
                    className={cn(
                      'p-3 rounded-xl flex items-center gap-3 transition-all border',
                      isUnmatched
                        ? 'bg-destructive/5 border-destructive/40 shadow-sm'
                        : person.present 
                          ? 'bg-success/10 border-success/20' 
                          : 'bg-destructive/10 border-destructive/20'
                    )}
                  >
                    <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                      <AvatarFallback className={cn(
                        'text-xs font-bold',
                        isUnmatched 
                          ? 'bg-destructive/20 text-destructive'
                          : person.present 
                            ? 'bg-success/20 text-success' 
                            : 'bg-destructive/20 text-destructive'
                      )}>
                        {getInitials(person.user_name || 'NN')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        isUnmatched && "text-destructive"
                      )}>
                        {person.user_name}
                      </p>
                      {person.function_role && (
                        <p className="text-xs text-muted-foreground truncate">{person.function_role}</p>
                      )}
                      
                      {isUnmatched ? (
                        <p className="text-[10px] font-bold text-destructive mt-0.5 flex items-center gap-1 uppercase">
                          <AlertTriangle className="w-3 h-3" />
                          Não cadastrado
                        </p>
                      ) : (
                        <p className={cn(
                          'text-xs',
                          person.present ? 'text-success' : 'text-destructive'
                        )}>
                          {person.present ? (
                            <>
                              {person.arrival_time || '—'}
                              {person.departure_time && ` → ${person.departure_time}`}
                            </>
                          ) : 'Ausente'}
                        </p>
                      )}
                    </div>
                    {isUnmatched ? (
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 animate-pulse" />
                    ) : person.present ? (
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos Card - Premium Grid */}
      {report.photos && report.photos.length > 0 && (
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Registro Fotográfico
            </CardTitle>
            <Badge variant="outline">
              {report.photos.length} {report.photos.length === 1 ? 'foto' : 'fotos'}
            </Badge>
          </CardHeader>
          <CardContent>
            <PhotoGallery photos={report.photos.map((p: any) => ({
              id: p.id,
              reportId: report.id,
              url: p.url,
              description: p.description,
              uploadedAt: new Date(p.created_at || Date.now()),
            }))} />
          </CardContent>
        </Card>
      )}

      {/* Comments & AI Summary Card */}
      {(report.comments || report.ai_summary || canEdit) && (
        <Card className="border-l-4 border-l-muted-foreground/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.comments && (
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                <p className="text-sm text-foreground whitespace-pre-wrap">{report.comments}</p>
              </div>
            )}
            {/* AI Summary - editable */}
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Resumo:
                </p>
                {canEdit && !isEditingSummary && (
                  <div className="flex items-center gap-1">
                    {report.ai_summary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditedSummary(report.ai_summary || '');
                          setIsEditingSummary(true);
                        }}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={handleRegenerateSummary}
                      disabled={isRegeneratingSummary}
                    >
                      {isRegeneratingSummary ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      {report.ai_summary ? 'Regenerar' : 'Gerar'}
                    </Button>
                  </div>
                )}
              </div>
              {isEditingSummary ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    className="min-h-[120px] text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingSummary(false)}
                      disabled={isSavingSummary}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveSummary}
                      disabled={isSavingSummary}
                    >
                      {isSavingSummary ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : report.ai_summary ? (
                <p className="text-sm text-foreground/80 italic whitespace-pre-wrap">{report.ai_summary}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum resumo gerado ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inline Signature Card - allow current logged-in user to sign with one click */}
      {(() => {
        if (!user?.id || !currentUserProfile) return null;
        const alreadySigned = (report.signatures || []).some(
          (s: any) =>
            s.signer_user_id === user.id ||
            (s.signer_email &&
              currentUserProfile.email &&
              s.signer_email.toLowerCase().trim() ===
                currentUserProfile.email.toLowerCase().trim())
        );
        if (alreadySigned) return null;

        // Don't offer signing on archived reports
        if (report.archived_at) return null;

        return (
          <OneClickSignatureCard
            title="Assinar este RDO"
            identity={{
              name: currentUserProfile.name || user.email || 'Colaborador',
              role:
                currentUserProfile.job_title ||
                (role === 'super_admin'
                  ? 'Super Administrador'
                  : role === 'admin'
                  ? 'Administrador'
                  : 'Colaborador'),
              company: brandingName || 'WEES',
              isWees: true,
              savedSignature: currentUserProfile.signature_data || null,
            }}
            onSign={handleInlineSign}
            isSubmitting={isSigningInline}
            onRegisterSignature={() => navigate('/settings')}
          />
        );
      })()}

      {/* Signatures Card - apenas assinaturas manuais (não Autentique) */}
      {(() => {
        const manualSignatures = (report.signatures || []).filter(
          (sig: any) => sig.signature_data && !sig.signature_data.startsWith('autentique:')
        );
        
        return manualSignatures.length > 0 ? (
          <Card className="border-l-4 border-l-success shadow-sm">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PenTool className="w-5 h-5 text-success" />
                Assinaturas
              </CardTitle>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                {manualSignatures.length} {manualSignatures.length === 1 ? 'assinatura' : 'assinaturas'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {manualSignatures.map((sig: any) => (
                <div
                  key={sig.id}
                  className="p-4 rounded-xl border-2 border-success/20 bg-success/5"
                >
                  {/* Signature image */}
                  <div className="bg-white rounded-lg p-3 mb-4 border border-border/50">
                    <img 
                      src={sig.signature_data} 
                      alt={`Assinatura de ${sig.signer_name}`}
                      className="max-h-24 mx-auto object-contain"
                    />
                  </div>
                  
                  {/* Informações do assinante */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{sig.signer_name}</span>
                    </div>
                    {sig.signer_role && (
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-muted-foreground" />
                        <span>{sig.signer_role}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(sig.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    {sig.ip_address && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-xs">
                          {sig.ip_address.replace(/\.\d+\.\d+$/, '.xxx.xxx')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* Autentique section removed — signatures are now native (report_signatures + signed_pdf_url) */}

      {/* Approval Timeline Card */}
      <Card className="border-l-4 border-l-muted-foreground/30 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalTimeline 
            history={historyData}
            isLoading={isHistoryLoading}
          />
        </CardContent>
      </Card>

      {/* Archived Banner */}
      {isArchived && (
        <Card className="border-warning bg-warning/10 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <Archive className="w-5 h-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-warning">Relatório Arquivado</p>
              <p className="text-sm text-muted-foreground">
                Arquivado em {format(new Date(report.archived_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleUnarchive}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* System Footer */}
      <Card className="bg-muted/30 border-dashed shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="text-center md:text-left space-y-0.5">
              <p className="font-semibold text-foreground/80">{company?.name || 'WEES Soluções'}</p>
              <p>{company?.email || 'contato@wees.com.br'}</p>
              <p className="hidden md:block">{company?.phone || 'www.wees.com.br'}</p>
            </div>
            <div className="text-center md:text-right space-y-0.5">
              <p className="italic">Documento gerado automaticamente</p>
              <p>Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - Fixed at bottom on mobile */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t md:relative md:border-0 md:p-0 md:bg-transparent">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
          
          {/* Botão Principal - Baixar PDF */}
          <Button 
            variant="default" 
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="w-full md:w-auto"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </>
            )}
          </Button>
          
          {/* Grupo de Ações de Edição - Centralizado */}
          <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center w-full">
            <Button variant="outline" size="sm" className="min-w-0 px-2 sm:px-3" onClick={() => navigate(-1)}>
              <ChevronLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            {canEdit && !isArchived && (
              <Button asChild variant="outline" size="sm" className="min-w-0 px-2 sm:px-3">
                <Link to={`/reports/${report.id}/edit-simple`}>
                  <Edit className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Editar</span>
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="min-w-0 px-2 sm:px-3" onClick={handleDuplicate}>
              <Copy className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Duplicar</span>
            </Button>
            {(role === 'super_admin' || role === 'admin') && (
              <div className="flex flex-col items-center gap-0.5">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="min-w-0 px-2 sm:px-3"
                  onClick={() => setShowAutentiqueDialog(true)}
                >
                  <Send className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Enviar para Assinatura</span>
                </Button>
                <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[160px]">
                  Envia o RDO ao portal do cliente
                </span>
              </div>
            )}
          </div>
          
          {/* Ações de Gerenciamento - Centralizado */}
          {(canArchive || canDelete) && (
            <div className="flex gap-1.5 sm:gap-2 justify-center pt-2 border-t border-border/50 w-full">
              {canArchive && !isArchived && (
                <Button variant="ghost" size="sm" className="min-w-0 px-2 sm:px-3" onClick={() => setShowArchiveDialog(true)}>
                  <Archive className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Arquivar</span>
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="sm" className="min-w-0 px-2 sm:px-3 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Apagar</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      </div>{/* End colored content wrapper */}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        title="Arquivar Relatório"
        description="O relatório será movido para arquivados e não aparecerá mais na listagem principal. Você poderá restaurá-lo a qualquer momento."
        confirmText="Arquivar"
        onConfirm={handleArchive}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Apagar Relatório"
        description="Esta ação é irreversível. O relatório e todos os seus dados (fotos, atividades, desvios, efetivo) serão permanentemente excluídos."
        confirmText="Apagar"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Share Dialog */}
      <ShareReportDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        reportId={report.id}
      />

      {/* Autentique Dialog */}
      <SendAutentiqueDialog
        open={showAutentiqueDialog}
        onOpenChange={setShowAutentiqueDialog}
        report={report}
        company={company}
        site={site}
        project={project}
      />
    </div>
  );
}
