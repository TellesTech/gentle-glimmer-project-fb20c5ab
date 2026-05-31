import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, Search, Filter, Calendar, Building2, 
  Clock, MapPin, Users, ChevronRight, FileText,
  Loader2, CheckSquare, Square, X, Download,
  FolderOpen, Timer, FileSignature, ChevronLeft, Send,
  MoreVertical, Edit, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge, NoActivityBadge, EmptyState } from '@/components/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BatchExportDialog, DocumentCabinet, SignedDocumentsSection, ReportProgressStepper } from '@/components/reports';
import type { CabinetBreadcrumbItem } from '@/components/reports';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import { toast } from 'sonner';
import { 
  exportReportsBatch, 
  uploadBatchExportToCloud,
  type BatchExportFormat, 
  type BatchExportDestination,
  type BatchExportProgress 
} from '@/lib/generateBatchReportsPdf';
import type { ReportStatus } from '@/types';

const shiftLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

interface ReportWithRelations {
  id: string;
  date: string;
  shift: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  status: ReportStatus;
  comments: string | null;
  created_at: string | null;
  archived_at?: string | null;
  no_activity?: boolean | null;
  maintenance_order_title?: string | null;
  project: {
    id: string;
    name: string;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
  creator: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  activities: { id: string }[];
  deviations: { id: string; impact: string }[];
  attendance: { id: string; present: boolean }[];
  signed_pdf_url: string | null;
}

export default function Reports() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { siteIds, isLoading: isLoadingAdminSites } = useAdminSiteAccess();
  const isRestrictedAdmin = role === 'admin' && siteIds.length > 0;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  
  // Selection mode states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [showBatchExportDialog, setShowBatchExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'cabinet' | 'signed'>('cabinet');
  const [exportProgress, setExportProgress] = useState<BatchExportProgress | null>(null);
  const [cabinetBreadcrumbs, setCabinetBreadcrumbs] = useState<CabinetBreadcrumbItem[]>([]);

  // Fetch project IDs for admin's restricted sites
  const { data: adminProjectIds } = useQuery({
    queryKey: ['admin-project-ids', siteIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .in('site_id', siteIds);
      if (error) throw error;
      return (data || []).map(p => p.id);
    },
    enabled: isRestrictedAdmin && siteIds.length > 0,
  });

  // Fetch reports from Supabase
  const { data: reports = [], isLoading: isLoadingReports } = useQuery({
    queryKey: ['reports', isRestrictedAdmin ? adminProjectIds : null],
    queryFn: async () => {
      let query = supabase
        .from('reports')
        .select(`
          id,
          date,
          shift,
          location,
          start_time,
          end_time,
          status,
          comments,
          created_at,
          archived_at,
          no_activity,
          maintenance_order_title,
          project:projects(id, name),
          team:teams(id, name),
          creator:profiles!created_by(id, name, avatar_url),
          activities:report_activities(id),
          deviations:report_deviations(id, impact),
          attendance:report_attendance(id, present),
          signed_pdf_url
        `)
        .order('date', { ascending: false });

      if (isRestrictedAdmin && adminProjectIds && adminProjectIds.length > 0) {
        query = query.in('project_id', adminProjectIds);
      } else if (isRestrictedAdmin) {
        // Admin has sites but no projects yet — return empty
        return [] as ReportWithRelations[];
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ReportWithRelations[];
    },
    enabled: !isRestrictedAdmin || (adminProjectIds !== undefined),
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Fetch projects for filter
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-filter', isRestrictedAdmin ? siteIds : null],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('id, name, reports(location, maintenance_order_title)')
        .order('name');

      if (isRestrictedAdmin && siteIds.length > 0) {
        query = query.in('site_id', siteIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const isGenericName = (name: string) => !name || name === '*' || name.startsWith('Atividade criada via') || name.trim().length <= 1;
      
      return (data || []).map(p => {
        const latestReport = p.reports?.[0] as any;
        const latestLocation = latestReport?.location;
        const latestOmTitle = latestReport?.maintenance_order_title;
        return {
          id: p.id,
          name: isGenericName(p.name) ? (latestLocation || latestOmTitle || p.name) : p.name,
        };
      });
    },
  });

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      // Archive filter
      const isArchived = !!report.archived_at;
      if (showArchived !== isArchived) return false;

      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (report.location?.toLowerCase() || '').includes(searchLower) ||
        (report.project?.name?.toLowerCase() || '').includes(searchLower) ||
        (report.team?.name?.toLowerCase() || '').includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;

      // Project filter
      const matchesProject = projectFilter === 'all' || report.project?.id === projectFilter;

      return matchesSearch && matchesStatus && matchesProject;
    });
  }, [reports, searchTerm, statusFilter, projectFilter, showArchived]);

  const archivedCount = useMemo(() => 
    reports.filter(r => !!r.archived_at).length, 
  [reports]);

  const getStatusCount = (status: ReportStatus) => 
    reports.filter(r => r.status === status && !r.archived_at).length;

  // Fetch active projects count
  const { data: activeProjectsCount = 0 } = useQuery({
    queryKey: ['active-projects-count', isRestrictedAdmin ? siteIds : null],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress');
      if (isRestrictedAdmin && siteIds.length > 0) {
        query = query.in('site_id', siteIds);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Fetch signed reports count (scoped for restricted admin) — alinhado com a Área do Cliente:
  // considera tanto 'signed' quanto 'finalized'.
  const { data: signedDocsCount = 0 } = useQuery({
    queryKey: ['signed-reports-count', isRestrictedAdmin ? adminProjectIds : null],
    queryFn: async () => {
      let query = supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .in('status', ['signed', 'finalized'])
        .is('archived_at', null);
      if (isRestrictedAdmin) {
        if (!adminProjectIds || adminProjectIds.length === 0) return 0;
        query = query.in('project_id', adminProjectIds);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !isRestrictedAdmin || (adminProjectIds !== undefined),
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Fetch RDOs effectively sent to the client portal — mesma regra do ClientDashboard:
  // status in (sent, signed, finalized) AND (has approver OR active autentique doc).
  const { data: sentToClientCount = 0 } = useQuery({
    queryKey: ['sent-to-client-count', isRestrictedAdmin ? adminProjectIds : null],
    queryFn: async () => {
      let baseQuery = supabase
        .from('reports')
        .select('id')
        .in('status', ['sent', 'signed', 'finalized'])
        .is('archived_at', null);
      if (isRestrictedAdmin) {
        if (!adminProjectIds || adminProjectIds.length === 0) return 0;
        baseQuery = baseQuery.in('project_id', adminProjectIds);
      }
      const { data: candidates, error } = await baseQuery;
      if (error) throw error;
      const ids = (candidates || []).map((r: any) => r.id);
      if (!ids.length) return 0;

      const [{ data: rca }, { data: rcoa }, { data: ad }] = await Promise.all([
        supabase.from('report_client_approvers').select('report_id').in('report_id', ids),
        supabase.from('report_company_approvers').select('report_id').in('report_id', ids),
        supabase.from('autentique_documents').select('report_id, status').in('report_id', ids),
      ]);
      const valid = new Set<string>();
      (rca || []).forEach((r: any) => valid.add(r.report_id));
      (rcoa || []).forEach((r: any) => valid.add(r.report_id));
      (ad || []).forEach((d: any) => {
        if (d.status === 'pending' || d.status === 'signed') valid.add(d.report_id);
      });
      return ids.filter((id) => valid.has(id)).length;
    },
    enabled: !isRestrictedAdmin || (adminProjectIds !== undefined),
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Fetch total projects/obras count
  const { data: totalActivitiesCount = 0 } = useQuery({
    queryKey: ['total-projects-count', isRestrictedAdmin ? siteIds : null],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });
      if (isRestrictedAdmin && siteIds.length > 0) {
        query = query.in('site_id', siteIds);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Calculate metrics for the current month
  const monthlyMetrics = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

    const thisMonthReports = reports.filter(r => 
      r.date >= monthStartStr && r.date <= monthEndStr && !r.archived_at
    );

    // Calculate total hours worked this month
    let totalMinutes = 0;
    thisMonthReports.forEach(r => {
      if (r.start_time && r.end_time) {
        const [startH, startM] = r.start_time.split(':').map(Number);
        const [endH, endM] = r.end_time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        // Handle overnight shifts
        const diff = endMinutes >= startMinutes 
          ? endMinutes - startMinutes 
          : (24 * 60 - startMinutes) + endMinutes;
        totalMinutes += diff;
      }
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    // Calculate completion rate
    const totalReports = reports.filter(r => !r.archived_at).length;
    const completedReports = reports.filter(r => r.status === 'completed' && !r.archived_at).length;
    const completionRate = totalReports > 0 
      ? Math.round((completedReports / totalReports) * 100) 
      : 0;

    return {
      totalHours,
      remainingMinutes,
      completionRate,
      thisMonthReportsCount: thisMonthReports.length,
    };
  }, [reports]);

  // Selection handlers
  const toggleSelection = (reportId: string) => {
    setSelectedReports(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedReports(new Set(filteredReports.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedReports(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedReports(new Set());
  };

  const handleBatchExport = async (formatType: BatchExportFormat, destination: BatchExportDestination) => {
    if (selectedReports.size === 0) return;
    
    setIsExporting(true);
    setExportProgress(null);
    
    try {
      const result = await exportReportsBatch(
        Array.from(selectedReports),
        formatType,
        (progress) => setExportProgress(progress)
      );
      
      // Download if needed
      if (destination === 'download' || destination === 'both') {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      // Upload to cloud if needed
      if (destination === 'cloud' || destination === 'both') {
        const uploadPath = await uploadBatchExportToCloud(result.blob, result.filename);
        if (!uploadPath) {
          toast.error('Erro ao salvar na nuvem');
        }
      }
      
      toast.success(`${selectedReports.size} relatórios exportados com sucesso!`);
      setShowBatchExportDialog(false);
      exitSelectionMode();
    } catch (error) {
      console.error('Batch export error:', error);
      toast.error('Erro ao exportar relatórios');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  if (isLoadingReports) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-0 min-w-0">
      {/* Dynamic Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap -mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (cabinetBreadcrumbs.length > 0 && cabinetBreadcrumbs[0].onClick) {
              // Go back one level: find the second-to-last crumb with onClick
              const backIndex = cabinetBreadcrumbs.length - 2;
              if (backIndex >= 0 && cabinetBreadcrumbs[backIndex].onClick) {
                cabinetBreadcrumbs[backIndex].onClick!();
              } else {
                // At first level, go to root (clear company)
                navigate('/reports', { replace: true });
              }
            } else {
              navigate(-1);
            }
          }}
          className="gap-1 h-7 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        {cabinetBreadcrumbs.length > 0 && (
          <>
            {cabinetBreadcrumbs.map((crumb, index) => {
              const isLast = index === cabinetBreadcrumbs.length - 1;
              return (
                <React.Fragment key={index}>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  {crumb.onClick && !isLast ? (
                    <button
                      onClick={crumb.onClick}
                      className="hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-none"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="font-medium text-foreground truncate max-w-[120px] sm:max-w-none">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl xs:text-2xl font-bold text-foreground truncate">Meus Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            {getStatusCount('completed')} concluído(s)
            {selectionMode && ` • ${selectedReports.size} selecionado(s)`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectionMode ? (
            <>
              <Button variant="outline" size="sm" onClick={exitSelectionMode} className="gap-1.5">
                <X className="h-4 w-4" />
                <span className="hidden xs:inline">Cancelar</span>
              </Button>
              {selectedReports.size === filteredReports.length ? (
                <Button variant="outline" size="sm" onClick={deselectAll} className="gap-1.5">
                  <Square className="h-4 w-4" />
                  <span className="hidden xs:inline">Desmarcar</span>
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={selectAll} className="gap-1.5">
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden xs:inline">Selecionar Todos</span>
                </Button>
              )}
              <Button 
                size="sm"
                onClick={() => setShowBatchExportDialog(true)} 
                disabled={selectedReports.size === 0}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Exportar ({selectedReports.size})
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)} className="gap-1.5">
                <CheckSquare className="h-4 w-4" />
                <span className="hidden xs:inline">Selecionar</span>
              </Button>
              <Link to="/reports/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span className="hidden xs:inline">Novo Relatório</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats - 6 Cards */}
      <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-6 gap-2 xs:gap-3">
        {/* Rascunhos */}
        <button
          onClick={() => {
            setShowArchived(false);
            setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft');
            setViewMode('list');
          }}
          className={`p-4 rounded-xl border transition-all ${
            !showArchived && statusFilter === 'draft' 
              ? 'ring-2 ring-primary border-primary bg-card' 
              : 'hover:bg-muted/40 bg-card'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">{getStatusCount('draft')}</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Rascunhos</p>
        </button>

        {/* Atividades */}
        <div className="p-4 rounded-xl border transition-all hover:bg-muted/40 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">{totalActivitiesCount}</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Atividades</p>
        </div>

        {/* RDOs Enviados ao Cliente — mesma regra da Área do Cliente */}
        <button
          onClick={() => {
            setShowArchived(false);
            setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent');
          }}
          className={`p-4 rounded-xl border transition-all ${
            !showArchived && statusFilter === 'sent' 
              ? 'ring-2 ring-primary border-primary bg-card' 
              : 'hover:bg-muted/40 bg-card'
          }`}
          title="RDOs efetivamente enviados ao cliente (com aprovador ou documento ativo de assinatura)"
        >
          <div className="flex items-center gap-2 mb-1">
            <Send className="h-5 w-5 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">{sentToClientCount}</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">RDOs Enviados</p>
        </button>

        {/* RDOs Assinados */}
        <button
          onClick={() => {
            setShowArchived(false);
            setStatusFilter('all');
            setViewMode(viewMode === 'signed' ? 'cabinet' : 'signed');
          }}
          className={`p-4 rounded-xl border transition-all ${
            viewMode === 'signed'
              ? 'ring-2 ring-primary border-primary bg-card' 
              : 'hover:bg-muted/40 bg-card'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <FileSignature className="h-5 w-5 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">{signedDocsCount}</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">RDOs Assinados</p>
        </button>

        {/* Horas do Mês */}
        <div className="p-4 rounded-xl border bg-card hover:bg-muted/40 transition-all">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="h-5 w-5 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">
              {monthlyMetrics.totalHours}
              <span className="text-sm font-normal text-muted-foreground">h{monthlyMetrics.remainingMinutes > 0 ? `${monthlyMetrics.remainingMinutes}m` : ''}</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Horas do Mês</p>
        </div>

      </div>

      {/* Conditional rendering: Cabinet vs List vs Signed view */}
      {viewMode === 'signed' ? (
        <SignedDocumentsSection onClose={() => setViewMode('cabinet')} adminProjectIds={isRestrictedAdmin ? adminProjectIds : undefined} />
      ) : viewMode === 'cabinet' ? (
        <DocumentCabinet onBreadcrumbChange={setCabinetBreadcrumbs} />
      ) : (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por local, atividade, equipe..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReportStatus | 'all')}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Atividade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as atividades</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reports List */}
          {filteredReports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum relatório encontrado"
              description="Tente ajustar os filtros ou crie um novo relatório"
              action={
                <Link to="/reports/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Relatório
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredReports.map((report) => (
                <ReportCard 
                  key={report.id} 
                  report={report}
                  selectionMode={selectionMode}
                  isSelected={selectedReports.has(report.id)}
                  onToggleSelection={() => toggleSelection(report.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Mobile FAB */}
      {!selectionMode && (
        <Link
          to="/reports/new"
          className="fixed bottom-20 right-4 md:hidden z-40"
        >
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg">
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      )}

      {/* Batch Export Dialog */}
      <BatchExportDialog
        open={showBatchExportDialog}
        onOpenChange={setShowBatchExportDialog}
        selectedCount={selectedReports.size}
        onExport={handleBatchExport}
        isExporting={isExporting}
        progress={exportProgress}
      />
    </div>
  );
}

interface ReportCardProps {
  report: ReportWithRelations;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}

function ReportCard({ report, selectionMode, isSelected, onToggleSelection }: ReportCardProps) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const presentCount = report.attendance.filter(a => a.present).length;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isSuperAdmin = role === 'super_admin';
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error, count } = await supabase
        .from('reports')
        .delete({ count: 'exact' })
        .eq('id', report.id);
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
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    } catch (error: any) {
      console.error('Error deleting report:', error);
      toast.error(error.message || 'Erro ao apagar relatório');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  const projectName = (!report.project?.name || report.project.name === '*' || report.project.name.startsWith('Atividade criada via'))
    ? (report.location || report.maintenance_order_title || report.project?.name || 'Sem projeto')
    : report.project.name;

  const cardContent = (
    <Card className={`h-full ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4 flex flex-col items-center text-center gap-3">
        {/* Top row: checkbox left, actions right */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            {selectionMode && (
              <Checkbox 
                checked={isSelected}
                onCheckedChange={onToggleSelection}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
          {isSuperAdmin && !selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); navigate(`/reports/edit/${report.id}`); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.preventDefault(); setShowDeleteConfirm(true); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Apagar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10">
          <FileText className="h-7 w-7 text-primary" />
        </div>

        {/* Title + Date */}
        <div className="space-y-1 w-full">
          <p className="font-semibold text-foreground truncate">{projectName}</p>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(report.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <StatusBadge status={report.status} />
          {report.no_activity && <NoActivityBadge />}
        </div>
      </CardContent>
    </Card>
  );
  
  if (selectionMode) {
    return (
      <div onClick={onToggleSelection} className="cursor-pointer">
        {cardContent}
      </div>
    );
  }
  
  return (
    <>
      <Link to={`/reports/${report.id}`}>
        {cardContent}
      </Link>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Apagar relatório"
        description="Tem certeza que deseja apagar este relatório? Esta ação não pode ser desfeita."
        confirmText="Apagar"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </>
  );
}
