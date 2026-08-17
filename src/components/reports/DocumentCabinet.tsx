import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO, subDays, startOfDay, endOfDay, isWithinInterval, differenceInDays, getYear, getMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Folder, FileText, ChevronLeft, ChevronRight,
  Building2, MapPin, Calendar, Download, Loader2, HardHat, FolderKanban,
  MoreVertical, Pencil, Trash2, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActivityNames } from '@/hooks/useActivityNames';
import { RenameActivityDialog, type RenameActivityTarget } from '@/components/reports/RenameActivityDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FolderCard from '@/components/reports/FolderCard';
import { StatusBadge, ConfirmDialog } from '@/components/shared';
import { WhatsAppIcon } from '@/components/shared/WhatsAppIcon';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminSiteAccess } from '@/hooks/useAdminSiteAccess';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  exportReportsBatch,
  uploadBatchExportToCloud,
  type BatchExportProgress,
} from '@/lib/generateBatchReportsPdf';
import { triggerDownloadFromBlob } from '@/lib/downloadUtils';
import { BatchDownloadOptionsDialog } from './BatchDownloadOptionsDialog';
import type { ReportStatus } from '@/types';
import type { PdfOptions } from '@/lib/generateReportPdf';



interface Report {
  id: string;
  date: string;
  shift: string;
  location: string | null;
  status: ReportStatus;
  rdo_number: number | null;
  actual_workforce: number | null;
  daily_progress: number | null;
  maintenance_order_title: string | null;
  maintenance_order_number: string | null;
  source?: string | null;
  project: {
    id: string;
    name: string;
    code: string | null;
    status: string | null;
    progress: number | null;
  site: {
      id: string;
      name: string;
      photo_url: string | null;
      company: {
        id: string;
        name: string;
        logo_url: string | null;
        photo_url: string | null;
      } | null;
    } | null;
  } | null;
  signed_pdf_url: string | null;
}

interface ProjectFolder {
  id: string;
  name: string;
  code: string | null;
  reports: Report[];
  count: number;
  totalWorkforce: number;
  progress: number;
  status: string;
  lastDate: string | null;
  omNumbers: string[];
  omTitles: string[];
  omNumber: string | null;
  omTitle: string | null;
  sourceProjects: { id: string; name: string }[];
  titleCounts?: Record<string, { label: string; count: number }>;
}

interface MonthFolder {
  month: number;
  monthName: string;
  reports: Report[];
  count: number;
  projects: ProjectFolder[];
}

import {
  sanitizeOmNumber,
  normalizeOmKeyNumber,
  normalizeOmTitle,
  omTitleTokens,
  tokenSimilarity,
  TITLE_MERGE_THRESHOLD,
} from '@/lib/rdoActivityGroups';

export { sanitizeOmNumber, normalizeOmKeyNumber, normalizeOmTitle };

interface YearFolder {
  year: number;
  reports: Report[];
  count: number;
  months: MonthFolder[];
}

interface SiteFolder {
  id: string;
  name: string;
  photo_url: string | null;
  company_logo_url: string | null;
  reports: Report[];
  totalCount: number;
  years: YearFolder[];
}

interface CompanyFolder {
  id: string;
  name: string;
  logo_url: string | null;
  photo_url: string | null;
  reports: Report[];
  totalCount: number;
  sites: SiteFolder[];
}

const shiftLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    planning: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    in_progress: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    suspended: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    planning: 'Planejamento',
    in_progress: 'Em Execução',
    completed: 'Concluída',
    suspended: 'Suspensa',
  };
  return labels[status] || status;
};

export interface CabinetBreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface CabinetContext {
  companyId: string | null;
  companyName: string | null;
  siteId: string | null;
  siteName: string | null;
}

interface DocumentCabinetProps {
  onBreadcrumbChange?: (breadcrumbs: CabinetBreadcrumbItem[]) => void;
  onContextChange?: (context: CabinetContext) => void;
}

export function DocumentCabinet({ onBreadcrumbChange, onContextChange }: DocumentCabinetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const { siteIds } = useAdminSiteAccess();
  // Escopo restrito: admin ou super admin com fábricas selecionadas no cadastro.
  const isRestrictedAdmin = (role === 'admin' || role === 'super_admin') && siteIds.length > 0;
  const isSuperAdmin = role === 'super_admin' || role === 'admin';

  const [searchParams, setSearchParams] = useSearchParams();

  const openCompanyId = searchParams.get('company');
  const openSiteId = searchParams.get('site');
  const openYear = searchParams.get('year') ? Number(searchParams.get('year')) : null;
  const openMonth = searchParams.get('month') !== null ? Number(searchParams.get('month')) : null;
  const openProjectId = searchParams.get('project');

  const setOpenCompanyId = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) { next.set('company', id); } else { next.delete('company'); }
      next.delete('site'); next.delete('year'); next.delete('month'); next.delete('project');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setOpenSiteId = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) { next.set('site', id); } else { next.delete('site'); }
      next.delete('year'); next.delete('month'); next.delete('project');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setOpenYear = useCallback((year: number | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (year !== null) { next.set('year', String(year)); } else { next.delete('year'); }
      next.delete('month'); next.delete('project');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setOpenMonth = useCallback((month: number | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (month !== null) { next.set('month', String(month)); } else { next.delete('month'); }
      next.delete('project');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setOpenProjectId = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) { next.set('project', id); } else { next.delete('project'); }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<BatchExportProgress | null>(null);
  
  // Delete state
  const [deletingItem, setDeletingItem] = useState<{
    id: string;
    type: 'company' | 'site' | 'project' | 'report' | 'reportGroup';
    name: string;
    /** RDOs atingidos pela exclusão (usado para aviso e para exclusão seletiva em lote). */
    reportIds?: string[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit site state
  const [editingSite, setEditingSite] = useState<{ id: string; name: string; city: string; state: string } | null>(null);
  const [isSavingSite, setIsSavingSite] = useState(false);

  // Download options dialog state
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{
    reportIds: string[];
    folderName: string;
    folderId: string;
  } | null>(null);
  /** Ids dos RDOs assinados dentro da pasta selecionada para download. */
  const [signedReportIds, setSignedReportIds] = useState<string[]>([]);

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      // Exclusão seletiva de um único RDO (ou de um conjunto explícito de RDOs).
      if (deletingItem.type === 'report' || deletingItem.type === 'reportGroup') {
        const ids =
          deletingItem.type === 'report'
            ? [deletingItem.id]
            : Array.from(new Set(deletingItem.reportIds || []));

        if (ids.length === 0) {
          toast({ title: 'Nada para excluir', description: 'Nenhum RDO selecionado.' });
          return;
        }

        const { error, count } = await supabase
          .from('reports')
          .delete({ count: 'exact' })
          .in('id', ids);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
        toast({
          title: count === 0 ? 'RDO já removido' : 'Excluído com sucesso',
          description:
            count === 0
              ? 'O registro não foi encontrado no banco. Lista atualizada.'
              : `${count} RDO(s) removido(s). Os demais relatórios foram mantidos.`,
        });
        return;
      }

      const table = {
        project: 'projects',
        site: 'sites',
        company: 'companies',
      }[deletingItem.type] as 'projects' | 'sites' | 'companies';

      const { error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .eq('id', deletingItem.id);

      if (error) {
        if (error.code === '23503') {
          throw new Error('Existem dados vinculados que impedem a exclusão. Remova-os primeiro.');
        }
        throw error;
      }
      if (count === 0) {
        toast({
          title: 'Item já removido',
          description: `"${deletingItem.name}" não foi encontrado no banco. Atualizando a lista...`,
        });
        queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
        queryClient.invalidateQueries({ queryKey: ['all-companies-cabinet-v2'] });
        if (deletingItem.type === 'company' && deletingItem.id === openCompanyId) setOpenCompanyId(null);
        if (deletingItem.type === 'site' && deletingItem.id === openSiteId) setOpenSiteId(null);
        if (deletingItem.type === 'project' && deletingItem.id === openProjectId) setOpenProjectId(null);
        return;
      }

      toast({ title: 'Excluído com sucesso', description: `"${deletingItem.name}" foi removido.` });
      queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
      queryClient.invalidateQueries({ queryKey: ['all-companies-cabinet-v2'] });
      if (deletingItem.type === 'company' && deletingItem.id === openCompanyId) setOpenCompanyId(null);
      if (deletingItem.type === 'site' && deletingItem.id === openSiteId) setOpenSiteId(null);
      if (deletingItem.type === 'project' && deletingItem.id === openProjectId) setOpenProjectId(null);
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeletingItem(null);
    }
  };

  const handleSaveSite = async () => {
    if (!editingSite) return;
    setIsSavingSite(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update({ name: editingSite.name, city: editingSite.city, state: editingSite.state })
        .eq('id', editingSite.id);
      if (error) throw error;
      toast({ title: 'Unidade atualizada' });
      queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
      setEditingSite(null);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingSite(false);
    }
  };

  const mergeReportsMutation = useMutation({
    mutationFn: async ({ sourceReportId, targetFolder }: { sourceReportId: string, targetFolder: ProjectFolder }) => {
      // Find the source report
      const report = reports.find(r => r.id === sourceReportId);
      if (!report) throw new Error('Relatório não encontrado');

      // Prepare data to sync with target folder
      const updateData: any = {};
      
      // If target folder is an OM, apply that OM info
      if (targetFolder.omNumber) {
        updateData.maintenance_order_number = targetFolder.omNumber;
      }
      
      // Use the most frequent title from target folder
      if (targetFolder.omTitle) {
        updateData.maintenance_order_title = targetFolder.omTitle;
      }

      // If the target folder is rooted in a specific project, ensure we might want to link it?
      // For now, we mainly normalize the OM fields which drives the grouping.
      
      const { error } = await supabase
        .from('reports')
        .update(updateData)
        .eq('id', sourceReportId);

      if (error) throw error;
      return { sourceReportId, targetFolder };
    },
    onSuccess: () => {
      toast({ title: 'Organização atualizada', description: 'O relatório foi movido com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao mover', description: error.message, variant: 'destructive' });
    }
  });

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    
    // Check if dropping onto a folder (droppableId will be the folder ID)
    if (source.droppableId === 'reports-list' && destination.droppableId !== 'reports-list') {
      const targetFolder = selectedMonthFolder?.projects.find(p => p.id === destination.droppableId);
      if (targetFolder) {
        mergeReportsMutation.mutate({ sourceReportId: draggableId, targetFolder });
      }
    }
  };

  const CardActions = ({ id, type, name, onEdit, reportIds }: { id: string; type: 'company' | 'site' | 'project' | 'report' | 'reportGroup'; name: string; onEdit?: () => void; reportIds?: string[] }) => {

    if (!isSuperAdmin) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 pointer-events-auto"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => onEdit?.()}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingItem({ id, type, name, reportIds })}>
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            {type === 'reportGroup' ? `Excluir ${reportIds?.length ?? 0} RDO(s) desta pasta` : 'Excluir'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const openDownloadOptions = (
    e: React.MouseEvent,
    reportIds: string[], 
    folderName: string,
    folderId: string
  ) => {
    e.stopPropagation();
    
    if (reportIds.length === 0) {
      toast({
        title: "Nenhum relatório",
        description: "Esta pasta não contém relatórios para baixar.",
        variant: "destructive",
      });
      return;
    }
    
    setPendingDownload({ reportIds, folderName, folderId });
    setDownloadDialogOpen(true);

    // Descobre quais RDOs desta pasta já estão assinados (para o filtro do diálogo)
    setSignedReportIds([]);
    supabase
      .from('reports')
      .select('id')
      .in('id', reportIds)
      .in('status', ['signed', 'finalized'])
      .then(({ data, error }) => {
        if (error) {
          console.warn('[download] falha ao buscar RDOs assinados', error);
          return;
        }
        setSignedReportIds((data || []).map((r: any) => r.id));
      });
  };

  const handleDownloadWithOptions = async (options: {
    includeSignatureFields: boolean;
    signatureFieldLabels: string[];
    onlySigned: boolean;
    downloadWindow?: Window | null;
  }) => {
    if (!pendingDownload) return;

    const { reportIds: allReportIds, folderName, folderId } = pendingDownload;
    const reportIds = options.onlySigned
      ? allReportIds.filter((id) => signedReportIds.includes(id))
      : allReportIds;
    const skipped = allReportIds.length - reportIds.length;

    if (reportIds.length === 0) {
      toast({
        title: 'Nenhum RDO assinado',
        description: 'Esta pasta não possui RDOs assinados para baixar.',
        variant: 'destructive',
      });
      setPendingDownload(null);
      return;
    }

    setIsExporting(true);
    setExportingId(folderId);
    setExportProgress(null);

    const pdfOptions: PdfOptions = {
      includeSignatureFields: options.includeSignatureFields,
      signatureFieldLabels: options.signatureFieldLabels,
    };

    try {
      const { blob, failed } = await exportReportsBatch(
        reportIds,
        'zip',
        (progress) => setExportProgress(progress),
        pdfOptions
      );

      const safeName = `${folderName.replace(/[^a-zA-Z0-9]/g, '_')}_relatorios_${Date.now()}.zip`;

      triggerDownloadFromBlob(blob, safeName, { preOpenedWindow: options.downloadWindow });

      uploadBatchExportToCloud(blob, safeName).catch((err) => {
        console.warn('[download] uploadBatchExportToCloud failed:', err);
      });

      toast({
        title: 'Download iniciado',
        description: failed > 0
          ? `${reportIds.length - failed} de ${reportIds.length} relatório(s) no ZIP. ${failed} falharam.${skipped > 0 ? ` ${skipped} ignorado(s) por não estarem assinados.` : ''}`
          : `${reportIds.length} relatório(s) sendo baixado(s).${skipped > 0 ? ` ${skipped} ignorado(s) por não estarem assinados.` : ''}`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
    } catch (error) {
      console.error('Error exporting reports:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível exportar os relatórios. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportingId(null);
      setExportProgress(null);
      setPendingDownload(null);
    }
  };

  const DownloadButton = ({ 
    reportIds, 
    folderName, 
    folderId,
    size = 'default'
  }: { 
    reportIds: string[]; 
    folderName: string; 
    folderId: string;
    size?: 'default' | 'sm';
  }) => {
    const isThisExporting = isExporting && exportingId === folderId;
    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
    
    return (
      <Button
        type="button"
        variant="ghost"
        size={size === 'sm' ? 'icon' : 'sm'}
        className={size === 'sm' ? 'h-7 w-7 pointer-events-auto' : 'gap-2 pointer-events-auto'}
        onPointerDown={(e) => openDownloadOptions(e as unknown as React.MouseEvent, reportIds, folderName, folderId)}
        onClick={(e) => openDownloadOptions(e, reportIds, folderName, folderId)}
        disabled={isExporting}
        title={`Baixar ${reportIds.length} relatório(s) como ZIP`}
      >
        {isThisExporting ? (
          <>
            <Loader2 className={`${iconSize} animate-spin`} />
            {size !== 'sm' && exportProgress && (
              <span className="text-xs">
                {exportProgress.current}/{exportProgress.total}
              </span>
            )}
          </>
        ) : (
          <>
            <Download className={iconSize} />
            {size !== 'sm' && <span>Baixar todos</span>}
          </>
        )}
      </Button>
    );
  };

  // Fetch project IDs for restricted admin
  const { data: adminProjectIds } = useQuery({
    queryKey: ['admin-cabinet-project-ids', siteIds],
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

  // Fetch all companies (restricted admin: only companies that own the assigned sites)
  const { data: allCompanies = [] } = useQuery({
    queryKey: ['all-companies-cabinet-v2', isRestrictedAdmin ? siteIds : null],
    queryFn: async () => {
      if (isRestrictedAdmin) {
        // Get company IDs from the admin's sites
        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('company_id')
          .in('id', siteIds);
        if (siteError) throw siteError;
        const companyIds = [...new Set((siteData || []).map(s => s.company_id))];
        if (companyIds.length === 0) return [];
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, logo_url, photo_url')
          .in('id', companyIds)
          .order('name');
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url, photo_url')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sites (restricted admin: only assigned sites)
  const { data: allSites = [] } = useQuery({
    queryKey: ['all-sites-cabinet-v2', isRestrictedAdmin ? siteIds : null],
    queryFn: async () => {
      let query = supabase
        .from('sites')
        .select('id, name, photo_url, company_id')
        .order('name');
      if (isRestrictedAdmin) {
        query = query.in('id', siteIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Nomes personalizados das pastas de atividade (compartilhados com o portal do cliente)
  const cabinetSiteIds = useMemo(() => (allSites || []).map((s: any) => s.id).filter(Boolean), [allSites]);
  const {
    namesBySite: activityNamesBySite,
    rename: renameActivity,
    resetName: resetActivityName,
    isSaving: renamingActivity,
  } = useActivityNames(cabinetSiteIds);
  const [renameTarget, setRenameTarget] = useState<RenameActivityTarget | null>(null);

  // Fetch completed AND draft reports with company hierarchy
  const REPORT_SELECT = `
            id,
            date,
            project_id,
            shift,
            location,
            status,
            rdo_number,
            actual_workforce,
            daily_progress,
            maintenance_order_title,
            maintenance_order_number,
            source,
            project:projects(
              id, 
              name,
              code,
              status,
              progress,
              site:sites(
                id,
                name,
                photo_url,
                company:companies(id, name, logo_url, photo_url)
              )
            ),
            signed_pdf_url
          `;

  const { data: scopedReports = [], isLoading } = useQuery({
    queryKey: ['reports-cabinet-all-v2', isRestrictedAdmin ? adminProjectIds : null],
    queryFn: async () => {
      if (isRestrictedAdmin && (!adminProjectIds || adminProjectIds.length === 0)) {
        return [] as Report[];
      }

      // Pagina em chunks de 1000 para evitar o teto padrão do PostgREST.
      const pageSize = 1000;
      const all: Report[] = [];
      let from = 0;
      // Loop até esgotar; segurança extra com hard cap.
      for (let i = 0; i < 50; i++) {
        let query = supabase
          .from('reports')
          .select(REPORT_SELECT)
          .in('status', ['completed', 'draft', 'sent', 'signed', 'finalized'])
          .is('archived_at', null)
          .order('date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (isRestrictedAdmin && adminProjectIds && adminProjectIds.length > 0) {
          query = query.in('project_id', adminProjectIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        const batch = (data || []) as Report[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    enabled: !isRestrictedAdmin || (adminProjectIds !== undefined),
  });

  // RDOs criados pelo usuário logado — sempre visíveis, independentemente da unidade.
  const { data: ownReports = [] } = useQuery({
    queryKey: ['reports-cabinet-own-v1', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(REPORT_SELECT)
        .eq('created_by', user!.id)
        .in('status', ['completed', 'draft', 'sent', 'signed', 'finalized'])
        .is('archived_at', null)
        .order('date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as Report[];
    },
    enabled: !!user?.id,
  });

  // União (sem duplicatas) entre o escopo da unidade e os RDOs do próprio usuário.
  const reports = useMemo<Report[]>(() => {
    const byId = new Map<string, Report>();
    scopedReports.forEach(r => byId.set(r.id, r));
    ownReports.forEach(r => { if (!byId.has(r.id)) byId.set(r.id, r); });
    return Array.from(byId.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [scopedReports, ownReports]);

  // Fetch projects (to surface activities created this month even without RDOs)
  const { data: allProjects = [] } = useQuery({
    queryKey: ['document-cabinet-projects', isRestrictedAdmin ? adminProjectIds : null],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('id, name, code, status, site_id, created_at');
      if (isRestrictedAdmin && adminProjectIds && adminProjectIds.length > 0) {
        query = query.in('id', adminProjectIds);
      } else if (isRestrictedAdmin) {
        return [] as any[];
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !isRestrictedAdmin || (adminProjectIds !== undefined),
  });

  // Group reports by company -> site -> year -> month -> project
  const companyFolders = useMemo<CompanyFolder[]>(() => {
    const map = new Map<string, CompanyFolder>();

    // Fallbacks locais: se o join aninhado (project->site->company) vier vazio
    // por RLS/relacionamento, resolvemos a hierarquia pelas listas já carregadas.
    const projectsById = new Map<string, any>((allProjects as any[]).map(p => [p.id, p]));
    const sitesByIdLocal = new Map<string, any>(allSites.map((s: any) => [s.id, s]));
    const companiesByIdLocal = new Map<string, any>(allCompanies.map((c: any) => [c.id, c]));
    
    allCompanies.forEach(company => {
      map.set(company.id, {
        id: company.id,
        name: company.name,
        logo_url: company.logo_url,
        photo_url: company.photo_url,
        reports: [],
        totalCount: 0,
        sites: [],
      });
    });
    
    reports.forEach(report => {
      const rawProjectId = report.project?.id || (report as any).project_id || null;
      const fallbackProject = rawProjectId ? projectsById.get(rawProjectId) : null;
      const project: any = report.project || fallbackProject;
      if (!project) return;
      const fallbackSite = sitesByIdLocal.get(report.project?.site?.id || project.site_id);
      const site: any = report.project?.site || fallbackSite;
      if (!site) return;
      const company: any =
        report.project?.site?.company || companiesByIdLocal.get(site.company_id);
      if (!company) return;
      
      const reportDate = parseISO(report.date);
      const year = getYear(reportDate);
      const month = getMonth(reportDate);
      
      if (!map.has(company.id)) {
        map.set(company.id, {
          id: company.id,
          name: company.name,
          logo_url: company.logo_url,
          photo_url: company.photo_url,
          reports: [],
          totalCount: 0,
          sites: [],
        });
      }
      
      const folder = map.get(company.id)!;
      folder.reports.push(report);
      folder.totalCount++;
      
      let siteFolder = folder.sites.find(s => s.id === site.id);
      if (!siteFolder) {
        siteFolder = { 
          id: site.id, 
          name: site.name, 
          photo_url: site.photo_url,
          company_logo_url: company.logo_url || company.photo_url || null,
          reports: [], 
          totalCount: 0, 
          years: [] 
        };
        folder.sites.push(siteFolder);
      }
      siteFolder.reports.push(report);
      siteFolder.totalCount++;
      
      let yearFolder = siteFolder.years.find(y => y.year === year);
      if (!yearFolder) {
        yearFolder = { year, reports: [], count: 0, months: [] };
        siteFolder.years.push(yearFolder);
      }
      yearFolder.reports.push(report);
      yearFolder.count++;
      
      let monthFolder = yearFolder.months.find(m => m.month === month);
      if (!monthFolder) {
        monthFolder = { 
          month, 
          monthName: monthNames[month], 
          reports: [], 
          count: 0, 
          projects: [] 
        };
        yearFolder.months.push(monthFolder);
      }
      monthFolder.reports.push(report);
      monthFolder.count++;
      
      // Agrupamento por OM: número da OM > título da OM > atividade (fallback "Sem OM")
      const omNum = normalizeOmKeyNumber(report.maintenance_order_number);
      const omTitle = (report.maintenance_order_title || '').trim();
      const omTitleKey = normalizeOmTitle(omTitle);
      const isGenericName = !project.name || project.name === '*' || project.name.startsWith('Atividade criada via');
      const projectDisplayName = isGenericName
        ? (report.location || omTitle || project.name || 'Atividade')
        : project.name;

      const omKey = omNum
        ? `om:${omNum}`
        : omTitleKey
          ? `title:${omTitleKey}`
          : `project:${project.id}`;

      let projectFolder = monthFolder.projects.find(p => p.id === omKey);
      if (!projectFolder) {
        projectFolder = {
          id: omKey,
          name: omNum ? `OM ${omNum}` : (omTitle || projectDisplayName),
          code: project.code || null,
          reports: [],
          count: 0,
          totalWorkforce: 0,
          progress: 0,
          status: project.status || 'planning',
          lastDate: null,
          omNumbers: [],
          omTitles: [],
          omNumber: omNum,
          omTitle: omTitle || null,
          sourceProjects: [],
          titleCounts: {},
        };
        monthFolder.projects.push(projectFolder);
      }
      projectFolder.reports.push(report);
      projectFolder.count++;
      if (!projectFolder.sourceProjects.some(sp => sp.id === project.id)) {
        projectFolder.sourceProjects.push({ id: project.id, name: projectDisplayName });
      }
      const rawOmNum = sanitizeOmNumber(report.maintenance_order_number);
      if (rawOmNum && !projectFolder.omNumbers.includes(rawOmNum)) projectFolder.omNumbers.push(rawOmNum);
      if (omTitle) {
        if (!projectFolder.omTitles.includes(omTitle)) projectFolder.omTitles.push(omTitle);
        const tc = projectFolder.titleCounts!;
        const k = omTitleKey || omTitle;
        tc[k] = { label: omTitle, count: (tc[k]?.count || 0) + 1 };
      }
      projectFolder.totalWorkforce += report.actual_workforce || 0;
      projectFolder.progress = Math.min(
        Math.round((projectFolder.progress + (report.daily_progress || 0)) * 10) / 10,
        100
      );
      if (!projectFolder.lastDate || report.date > projectFolder.lastDate) {
        projectFolder.lastDate = report.date;
      }
    });
    
    // Add sites that have no reports yet
    allSites.forEach(site => {
      const folder = map.get(site.company_id);
      if (folder && !folder.sites.find(s => s.id === site.id)) {
        folder.sites.push({
          id: site.id,
          name: site.name,
          photo_url: site.photo_url,
          company_logo_url: folder.logo_url || folder.photo_url || null,
          reports: [],
          totalCount: 0,
          years: [],
        });
      }
    });

    // Surface TODAS as atividades (mesmo sem RDOs), agrupadas pelo ano/mês de criação.
    const nowFallback = new Date();
    const sitesById = new Map(allSites.map(s => [s.id, s]));
    allProjects.forEach((p: any) => {
      const created = p.created_at ? parseISO(p.created_at) : nowFallback;
      const pYear = getYear(created);
      const pMonth = getMonth(created);
      const site = sitesById.get(p.site_id);
      if (!site) return;
      const folder = map.get(site.company_id);
      if (!folder) return;

      let siteFolder = folder.sites.find(s => s.id === site.id);
      if (!siteFolder) {
        siteFolder = {
          id: site.id,
          name: site.name,
          photo_url: site.photo_url,
          company_logo_url: folder.logo_url || folder.photo_url || null,
          reports: [],
          totalCount: 0,
          years: [],
        };
        folder.sites.push(siteFolder);
      }

      let yearFolder = siteFolder.years.find(y => y.year === pYear);
      if (!yearFolder) {
        yearFolder = { year: pYear, reports: [], count: 0, months: [] };
        siteFolder.years.push(yearFolder);
      }

      let monthFolder = yearFolder.months.find(m => m.month === pMonth);
      if (!monthFolder) {
        monthFolder = {
          month: pMonth,
          monthName: monthNames[pMonth],
          reports: [],
          count: 0,
          projects: [],
        };
        yearFolder.months.push(monthFolder);
      }

      if (!monthFolder.projects.some(pf => pf.sourceProjects.some(sp => sp.id === p.id))) {
        const isGenericName = !p.name || p.name === '*' || (p.name || '').startsWith('Atividade criada via');
        monthFolder.projects.push({
          id: `project:${p.id}`,
          name: isGenericName ? (p.name || 'Atividade') : p.name,
          code: p.code || null,
          reports: [],
          count: 0,
          totalWorkforce: 0,
          progress: 0,
          status: p.status || 'planning',
          lastDate: null,
          omNumbers: [],
          omTitles: [],
          omNumber: null,
          omTitle: null,
          sourceProjects: [{ id: p.id, name: isGenericName ? (p.name || 'Atividade') : p.name }],
          titleCounts: {},
        });
      }
    });



    map.forEach(folder => {
      folder.sites.sort((a, b) => b.totalCount - a.totalCount || a.name.localeCompare(b.name));
      folder.sites.forEach(site => {
        site.years.sort((a, b) => b.year - a.year);
        site.years.forEach(year => {
          year.months.sort((a, b) => b.month - a.month);
          year.months.forEach(month => {
            // Mescla pastas SEM número de OM cujos títulos são variações do mesmo serviço
            // (ex.: "Inspeção e reparo chaminé e FEA" / "Inspeção e reparo na chaminé").
            const merged: ProjectFolder[] = [];
            const tokensOf = new Map<ProjectFolder, Set<string>>();
            month.projects.forEach(pf => {
              if (pf.omNumber) { merged.push(pf); return; }
              const tks = omTitleTokens(pf.omTitle || pf.name);
              // Compara sempre com o conjunto ORIGINAL de tokens da pasta destino.
              // (Unir tokens gerava efeito cascata: um título "ponte" acabava
              // juntando serviços totalmente distintos no mesmo card.)
              const target = merged.find(m =>
                !m.omNumber && tokenSimilarity(tokensOf.get(m) || new Set(), tks) >= TITLE_MERGE_THRESHOLD
              );
              if (!target) {
                tokensOf.set(pf, tks);
                merged.push(pf);
                return;
              }
              target.reports.push(...pf.reports);
              target.count += pf.count;
              target.totalWorkforce += pf.totalWorkforce;
              target.progress = Math.min(Math.round((target.progress + pf.progress) * 10) / 10, 100);
              if (!target.lastDate || (pf.lastDate && pf.lastDate > target.lastDate)) target.lastDate = pf.lastDate;
              pf.omNumbers.forEach(n => { if (!target.omNumbers.includes(n)) target.omNumbers.push(n); });
              pf.omTitles.forEach(t => { if (!target.omTitles.includes(t)) target.omTitles.push(t); });
              pf.sourceProjects.forEach(sp => {
                if (!target.sourceProjects.some(s => s.id === sp.id)) target.sourceProjects.push(sp);
              });
              const tc = target.titleCounts || (target.titleCounts = {});
              Object.entries(pf.titleCounts || {}).forEach(([k, v]) => {
                tc[k] = { label: v.label, count: (tc[k]?.count || 0) + v.count };
              });
            });
            month.projects = merged;

            // Nome final do card: OM <número> — <título mais frequente>
            month.projects.forEach(pf => {
              const best = Object.values(pf.titleCounts || {}).sort((a, b) => b.count - a.count)[0];
              const bestTitle = best?.label || pf.omTitle || null;
              pf.omTitle = bestTitle;
              if (pf.omNumber) {
                pf.name = bestTitle ? `OM ${pf.omNumber} — ${bestTitle}` : `OM ${pf.omNumber}`;
              } else if (bestTitle) {
                pf.name = bestTitle;
              } else if (pf.count > 0) {
                pf.name = `${pf.sourceProjects[0]?.name || 'Atividade'} — Sem OM`;
              }
              // Nome personalizado (renomeado aqui ou no portal do cliente)
              const custom = activityNamesBySite.get(`${site.id}::${pf.id}`);
              if (custom) pf.name = custom;
              pf.reports.sort((a, b) => (a.date < b.date ? 1 : -1));
            });
            month.projects.sort((a, b) => {
              const da = a.lastDate || '';
              const db = b.lastDate || '';
              if (da !== db) return db.localeCompare(da);
              return b.count - a.count;
            });
          });
        });
      });
    });
    
    return Array.from(map.values()).sort((a, b) => {
      if (a.totalCount > 0 && b.totalCount === 0) return -1;
      if (a.totalCount === 0 && b.totalCount > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [reports, allCompanies, allSites, allProjects, activityNamesBySite]);

  const selectedCompany = companyFolders.find(c => c.id === openCompanyId);
  const selectedSiteFolder = selectedCompany?.sites.find(s => s.id === openSiteId);
  const selectedYearFolder = selectedSiteFolder?.years.find(y => y.year === openYear);
  const selectedMonthFolder = selectedYearFolder?.months.find(m => m.month === openMonth);
  const selectedProjectFolder = selectedMonthFolder?.projects.find(p => p.id === openProjectId);

  const handleBack = () => {
    if (openProjectId) {
      setOpenProjectId(null);
    } else if (openMonth !== null) {
      setOpenMonth(null);
    } else if (openYear !== null) {
      setOpenYear(null);
    } else if (openSiteId !== null) {
      setOpenSiteId(null);
    } else {
      setOpenCompanyId(null);
    }
  };

  // Anos disponíveis e pastas filtradas — precisam ficar acima de qualquer
  // return antecipado (níveis de navegação), senão a contagem de hooks muda
  // entre renders e o React derruba a tela.
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    reports.forEach(r => years.add(getYear(parseISO(r.date))));
    allProjects.forEach((p: any) => {
      if (p.created_at) years.add(getYear(parseISO(p.created_at)));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [reports, allProjects, currentYear]);

  const selectedMainYear = openYear || currentYear;

  const filteredCompanyFolders = useMemo(() => {
    return companyFolders.map(cf => {
      const filteredSites = cf.sites.filter(s => s.years.some(y => y.year === selectedMainYear));
      return { ...cf, sites: filteredSites };
    }).filter(cf => cf.sites.length > 0 || cf.reports.length === 0);
  }, [companyFolders, selectedMainYear]);

  // Emit breadcrumbs to parent
  useEffect(() => {
    if (!onBreadcrumbChange) return;
    const crumbs: CabinetBreadcrumbItem[] = [];

    if (selectedCompany) {
      crumbs.push({ label: selectedCompany.name, onClick: () => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('site'); next.delete('year'); next.delete('month'); next.delete('project');
          return next;
        }, { replace: true });
      } });
    }
    if (selectedSiteFolder) {
      crumbs.push({ label: selectedSiteFolder.name, onClick: () => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('year'); next.delete('month'); next.delete('project');
          return next;
        }, { replace: true });
      } });
    }
    if (selectedYearFolder) {
      crumbs.push({ label: String(selectedYearFolder.year), onClick: () => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('month'); next.delete('project');
          return next;
        }, { replace: true });
      } });
    }
    if (selectedMonthFolder) {
      crumbs.push({ label: selectedMonthFolder.monthName, onClick: () => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('project');
          return next;
        }, { replace: true });
      } });
    }
    if (selectedProjectFolder) {
      crumbs.push({ label: selectedProjectFolder.name });
    }

    onBreadcrumbChange(crumbs);
  }, [onBreadcrumbChange, selectedCompany, selectedSiteFolder, selectedYearFolder, selectedMonthFolder, selectedProjectFolder, setOpenSiteId, setOpenYear, setOpenMonth, setOpenProjectId]);

  // Emit current company/site context to parent (used by "Novo Relatório")
  useEffect(() => {
    onContextChange?.({
      companyId: selectedCompany?.id ?? null,
      companyName: selectedCompany?.name ?? null,
      siteId: selectedSiteFolder?.id ?? null,
      siteName: selectedSiteFolder?.name ?? null,
    });
  }, [onContextChange, selectedCompany, selectedSiteFolder]);

  /** Quantidade de RDOs removidos em cascata ao excluir empresa/unidade/atividade. */
  const deleteImpactCount = !deletingItem
    ? 0
    : deletingItem.type === 'company'
    ? reports.filter((r) => r.project?.site?.company?.id === deletingItem.id).length
    : deletingItem.type === 'site'
    ? reports.filter((r) => r.project?.site?.id === deletingItem.id).length
    : deletingItem.type === 'project'
    ? reports.filter((r) => r.project?.id === deletingItem.id).length
    : deletingItem.reportIds?.length ?? 1;

  const dialogs = (
    <>
      <RenameActivityDialog
        target={renameTarget}
        onOpenChange={(open) => { if (!open) setRenameTarget(null); }}
        isSaving={renamingActivity}
        onSave={async (name) => {
          if (!renameTarget?.siteId) return;
          await renameActivity({ siteId: renameTarget.siteId, groupKey: renameTarget.groupKey, name });
          setRenameTarget(null);
        }}
        onReset={async () => {
          if (!renameTarget?.siteId) return;
          await resetActivityName({ siteId: renameTarget.siteId, groupKey: renameTarget.groupKey });
          setRenameTarget(null);
        }}
      />
      <BatchDownloadOptionsDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        onConfirm={handleDownloadWithOptions}
        reportCount={pendingDownload?.reportIds.length || 0}
        signedCount={
          pendingDownload
            ? pendingDownload.reportIds.filter((id) => signedReportIds.includes(id)).length
            : 0
        }
        folderName={pendingDownload?.folderName || ''}
      />
      <ConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={`Excluir ${
          deletingItem?.type === 'company'
            ? 'empresa'
            : deletingItem?.type === 'site'
            ? 'unidade'
            : deletingItem?.type === 'project'
            ? 'atividade'
            : deletingItem?.type === 'reportGroup'
            ? 'RDOs da pasta'
            : 'relatório'
        }`}
        description={
          deletingItem?.type === 'report'
            ? `Tem certeza que deseja excluir apenas o "${deletingItem?.name}"? Os demais RDOs não serão afetados. Esta ação não pode ser desfeita.`
            : deletingItem?.type === 'reportGroup'
            ? `Serão excluídos ${deletingItem?.reportIds?.length ?? 0} RDO(s) da pasta "${deletingItem?.name}". Nenhum outro relatório será afetado. Esta ação não pode ser desfeita.`
            : `ATENÇÃO: excluir "${deletingItem?.name}" também remove ${deleteImpactCount} RDO(s) vinculado(s) e todos os seus dados. Esta ação não pode ser desfeita.`
        }
        confirmText="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
      <Dialog open={!!editingSite} onOpenChange={(open) => !open && setEditingSite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Unidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editingSite?.name || ''} onChange={(e) => setEditingSite(prev => prev ? { ...prev, name: e.target.value } : null)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input value={editingSite?.city || ''} onChange={(e) => setEditingSite(prev => prev ? { ...prev, city: e.target.value } : null)} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={editingSite?.state || ''} onChange={(e) => setEditingSite(prev => prev ? { ...prev, state: e.target.value } : null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSite(null)}>Cancelar</Button>
            <Button onClick={handleSaveSite} disabled={isSavingSite}>
              {isSavingSite && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (companyFolders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Folder className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">Nenhum relatório encontrado</h3>
        <p className="text-muted-foreground">Crie um relatório para vê-lo aqui</p>
      </div>
    );
  }

  // Level 6: Inside a project folder - show reports list
  if (selectedCompany && selectedSiteFolder && selectedYearFolder && selectedMonthFolder && selectedProjectFolder) {
    // Numeração sequencial única dentro da OM: mais antigo = 001
    const omSeq = new Map<string, number>();
    [...selectedProjectFolder.reports]
      .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))
      .forEach((r, i) => omSeq.set(r.id, i + 1));
    // Prioriza o número real gravado no RDO (mesmo exibido na criação/visualização).
    // Só usa a sequência calculada quando o registro ainda não tem rdo_number.
    const seqLabel = (report: { id: string; rdo_number: number | null }) => {
      const real = Number(report.rdo_number);
      if (Number.isFinite(real) && real > 0) return String(real).padStart(3, '0');
      return String(omSeq.get(report.id) ?? 1).padStart(3, '0');
    };
    return (
      <>
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
                <HardHat className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-xl">{selectedProjectFolder.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedProjectFolder.count} relatório(s) em {selectedMonthFolder.monthName}/{selectedYearFolder.year}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  navigate('/reports/new', {
                    state: {
                      companyId: selectedCompany.id,
                      companyName: selectedCompany.name,
                      siteId: selectedSiteFolder.id,
                      siteName: selectedSiteFolder.name,
                      omNumber: selectedProjectFolder.omNumber,
                      omTitle: selectedProjectFolder.omTitle,
                    }
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Relatório
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setRenameTarget({
                    groupKey: selectedProjectFolder.id,
                    siteId: openSiteId,
                    currentName: selectedProjectFolder.name,
                    hasCustomName: activityNamesBySite.has(`${openSiteId}::${selectedProjectFolder.id}`),
                  })
                }
              >
                <Pencil className="h-3.5 w-3.5" />
                Renomear
              </Button>
              <DownloadButton
              reportIds={selectedProjectFolder.reports.map(r => r.id)}
              folderName={`${selectedCompany.name}_${selectedSiteFolder.name}_${selectedYearFolder.year}_${selectedMonthFolder.monthName}_${
                selectedProjectFolder.omNumber ? `OM-${selectedProjectFolder.omNumber}` : selectedProjectFolder.name
              }`}
              folderId={`om-${selectedProjectFolder.id}-${openMonth}-${openYear}`}
              />
            </div>
          </div>

          {/* Reports list with Drag and Drop */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Main reports list (Draggable items) */}
              <div className="flex-1">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">Relatórios (Arraste para organizar)</h3>
                <Droppable droppableId="reports-list">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      {selectedProjectFolder.reports.map((report, index) => (
                        <Draggable key={report.id} draggableId={report.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => navigate(`/reports/${report.id}`)}
                              className={cn(
                                "relative rounded-xl border bg-card p-4 hover:bg-muted/60 transition-colors cursor-pointer shadow-sm group",
                                snapshot.isDragging && "shadow-xl border-primary/50 ring-2 ring-primary/20 scale-105 z-50 bg-accent"
                              )}
                            >
                              {/* Actions */}
                              {isSuperAdmin && (
                                <div className="absolute top-2 right-2 z-10">
                                  <CardActions
                                    id={report.id}
                                    type="report"
                                    name={`RDO Nº ${seqLabel(report)}`}
                                    onEdit={() => navigate(`/reports/${report.id}/edit`)}
                                  />
                                </div>
                              )}

                              {/* Header: RDO number + status badges */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-2 rounded-lg bg-foreground/10 shrink-0">
                                    <FileText className="h-5 w-5 text-foreground/70" />
                                  </div>
                                  <span className="text-sm font-semibold text-foreground truncate">
                                    RDO Nº {seqLabel(report)}
                                    {report.maintenance_order_number && (
                                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                        · OM {report.maintenance_order_number}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                              </div>

                              {/* Date + shift */}
                              <p className="text-xs text-muted-foreground mb-1.5">
                                {format(parseISO(report.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                              </p>

                              <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                  {shiftLabels[report.shift] || report.shift}
                                </span>
                                {report.location && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{report.location}</span>
                                  </span>
                                )}
                              </div>

                              {/* Status badges */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <StatusBadge status={report.status} />
                                {report.source === 'whatsapp_ai' && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-2 py-0.5 gap-1 bg-green-500/10 text-green-600 border border-green-500/20"
                                    title="Registro criado automaticamente pela IA a partir de mensagem no WhatsApp"
                                  >
                                    <WhatsAppIcon className="h-3 w-3" />
                                    IA via WhatsApp
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* Destination folders (Drop targets) */}
              <div className="w-full lg:w-72 shrink-0">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">Mover para outra Atividade/OM</h3>
                <div className="flex flex-col gap-2">
                  {selectedMonthFolder.projects
                    .filter(p => p.id !== selectedProjectFolder.id)
                    .map((otherProject) => (
                      <Droppable key={otherProject.id} droppableId={otherProject.id}>
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={cn(
                              "rounded-lg border p-3 transition-all duration-200",
                              snapshot.isDraggingOver 
                                ? "bg-primary/5 border-primary shadow-inner scale-102 ring-2 ring-primary/20" 
                                : "bg-card hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-md transition-colors",
                                snapshot.isDraggingOver ? "bg-primary/20" : "bg-muted"
                              )}>
                                <HardHat className={cn(
                                  "h-4 w-4",
                                  snapshot.isDraggingOver ? "text-primary" : "text-muted-foreground"
                                )} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  "text-xs font-semibold truncate",
                                  snapshot.isDraggingOver ? "text-primary" : "text-card-foreground"
                                )}>
                                  {otherProject.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {otherProject.count} RDOs
                                </p>
                              </div>
                            </div>
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}
                  {selectedMonthFolder.projects.filter(p => p.id !== selectedProjectFolder.id).length === 0 && (
                    <div className="text-center py-6 px-4 rounded-lg border-2 border-dashed border-muted bg-muted/20">
                      <p className="text-xs text-muted-foreground">Nenhuma outra pasta disponível neste mês.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DragDropContext>
        </div>

        {dialogs}
      </>
    );
  }

  // Level 5: Inside a month folder - show project folders
  if (selectedCompany && selectedSiteFolder && selectedYearFolder && selectedMonthFolder) {
    return (
      <>
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-xl">{selectedMonthFolder.monthName} {selectedYearFolder.year}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedMonthFolder.projects.length} OM(s) • {selectedMonthFolder.count} relatório(s)
                </p>
              </div>
            </div>
            <DownloadButton
              reportIds={selectedMonthFolder.reports.map(r => r.id)}
              folderName={`${selectedCompany.name}_${selectedSiteFolder.name}_${selectedYearFolder.year}_${selectedMonthFolder.monthName}`}
              folderId={`month-${selectedCompany.id}-${openSiteId}-${openYear}-${openMonth}`}
            />
          </div>

          {/* Project folders list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedMonthFolder.projects.map((projectFolder) => (
              <div
                key={projectFolder.id}
                className="relative rounded-xl border bg-card p-3.5 hover:bg-muted/60 transition-colors cursor-pointer shadow-sm group"
                onClick={() => setOpenProjectId(projectFolder.id)}
              >
                {/* Actions */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  <button
                    type="button"
                    title="Renomear pasta"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameTarget({
                        groupKey: projectFolder.id,
                        siteId: openSiteId,
                        currentName: projectFolder.name,
                        hasCustomName: activityNamesBySite.has(`${openSiteId}::${projectFolder.id}`),
                      });
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {isSuperAdmin && (
                    <CardActions
                      id={projectFolder.sourceProjects[0]?.id || projectFolder.id}
                      type="reportGroup"
                      name={projectFolder.name}
                      reportIds={projectFolder.reports.map((r) => r.id)}
                      onEdit={() => {
                        const ids = projectFolder.sourceProjects.map((sp) => sp.id).filter(Boolean);
                        const primary = ids[0] || '';
                        const extras = ids.slice(1);
                        navigate(
                          `/projects/${primary}${extras.length ? `?projects=${extras.join(',')}` : ''}`,
                        );
                      }}
                    />
                  )}
                </div>

                {/* Header: icon + name + chevron */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-foreground/10 shrink-0">
                    <FolderKanban className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {projectFolder.omNumber ? (
                      <span
                        title={`OM ${projectFolder.omNumber}`}
                        className="inline-block mb-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wide"
                      >
                        OM {projectFolder.omNumber}
                      </span>
                    ) : (
                      <span className="inline-block mb-0.5 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-bold tracking-wide">
                        SEM Nº DE OM
                      </span>
                    )}
                    <p className="text-sm font-semibold text-foreground break-words leading-snug" title={projectFolder.name}>
                      {projectFolder.name}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* Metrics */}
                <p className="text-xs text-muted-foreground mb-2.5">
                  {projectFolder.count} RDOs · {projectFolder.totalWorkforce} Efetivo · {projectFolder.lastDate
                    ? format(parseISO(projectFolder.lastDate), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Sem RDOs'}
                </p>

                {/* Progress bar + percentage + status badge */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${projectFolder.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-8 text-right">{Math.round(projectFolder.progress)}%</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
                    getStatusColor(projectFolder.status)
                  )}>
                    {getStatusLabel(projectFolder.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  // Level 4: Inside a year folder - show month folders
  if (selectedCompany && selectedSiteFolder && selectedYearFolder) {
    return (
      <>
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-xl">{selectedYearFolder.year}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedYearFolder.months.length} mês(es) • {selectedYearFolder.count} relatório(s)
                </p>
              </div>
            </div>
            <DownloadButton
              reportIds={selectedYearFolder.reports.map(r => r.id)}
              folderName={`${selectedCompany.name}_${selectedSiteFolder.name}_${selectedYearFolder.year}`}
              folderId={`year-${selectedCompany.id}-${openSiteId}-${selectedYearFolder.year}`}
            />
          </div>

          {/* Month folders grid */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {selectedYearFolder.months.map((monthFolder) => (
              <FolderCard
                key={monthFolder.month}
                onClick={() => setOpenMonth(monthFolder.month)}
                icon={
                  <div className="w-[4.2rem] h-[3.6rem] rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                }
                title={monthFolder.monthName}
                stats={[
                  { icon: <FolderKanban className="h-3 w-3" />, label: `${monthFolder.projects.length} atividade(s)` },
                  { icon: <FileText className="h-3 w-3" />, label: `${monthFolder.count} relatório(s)` },
                ]}
                topRightActions={
                  <DownloadButton
                    reportIds={monthFolder.reports.map(r => r.id)}
                    folderName={`${selectedCompany.name}_${selectedSiteFolder.name}_${selectedYearFolder.year}_${monthFolder.monthName}`}
                    folderId={`month-${selectedCompany.id}-${openSiteId}-${selectedYearFolder.year}-${monthFolder.month}`}
                    size="sm"
                  />
                }
              />
            ))}
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  // Level 3: Inside a site folder - show year folders
  if (selectedCompany && selectedSiteFolder) {
    return (
      <>
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-xl">{selectedSiteFolder.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedSiteFolder.years.reduce((acc, y) => acc + y.months.reduce((a, m) => a + m.projects.length, 0), 0)} atividade(s) • {selectedSiteFolder.totalCount} relatório(s) • {selectedSiteFolder.years.length} ano(s)
                </p>
              </div>
            </div>
            <DownloadButton
              reportIds={selectedSiteFolder.reports.map(r => r.id)}
              folderName={`${selectedCompany.name}_${selectedSiteFolder.name}`}
              folderId={`site-${selectedSiteFolder.id}`}
            />
          </div>

          {/* Year folders grid */}
           <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {selectedSiteFolder.years.map((yearFolder) => (
              <FolderCard
                key={yearFolder.year}
                onClick={() => setOpenYear(yearFolder.year)}
                icon={
                  <div className="w-[4.2rem] h-[3.6rem] rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                }
                title={String(yearFolder.year)}
                stats={[
                  { icon: <Calendar className="h-3 w-3" />, label: `${yearFolder.months.length} mês(es)` },
                  { icon: <FileText className="h-3 w-3" />, label: `${yearFolder.count} relatório(s)` },
                ]}
                topRightActions={
                  <DownloadButton
                    reportIds={yearFolder.reports.map(r => r.id)}
                    folderName={`${selectedCompany.name}_${selectedSiteFolder.name}_${yearFolder.year}`}
                    folderId={`year-${selectedCompany.id}-${openSiteId}-${yearFolder.year}`}
                    size="sm"
                  />
                }
              />
            ))}
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  // Level 2: Inside a company folder - show site folders
  if (selectedCompany) {
    // Handle empty company (no reports yet)
    if (selectedCompany.sites.length === 0) {
      return (
        <>
          <div className="space-y-4">
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Nenhum relatório ainda</h3>
              <p className="text-muted-foreground max-w-md">
                A fábrica <span className="font-medium">{selectedCompany.name}</span> ainda não possui relatórios. 
                Crie um relatório vinculado a uma atividade desta fábrica.
              </p>
            </div>
          </div>
          {dialogs}
        </>
      );
    }

    return (
      <>
        <div className="space-y-4">
          {/* Site folders grid */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {selectedCompany.sites.map((siteFolder) => (
              <FolderCard
                key={siteFolder.id}
                onClick={() => setOpenSiteId(siteFolder.id)}
                icon={
                   <div className="w-20 h-[4.2rem] rounded-lg overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
                    {(siteFolder.photo_url || siteFolder.company_logo_url) ? (
                      <img
                        src={siteFolder.photo_url || siteFolder.company_logo_url!}
                        alt={siteFolder.name}
                        className={siteFolder.photo_url ? "w-full h-full object-cover" : "max-h-full max-w-full object-contain p-1"}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <MapPin className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                }
                title={siteFolder.name}
                stats={[
                  { icon: <FileText className="h-3 w-3" />, label: `${siteFolder.totalCount} relatório(s)` },
                  { icon: <Calendar className="h-3 w-3" />, label: `${siteFolder.years.length} ano(s)` },
                ]}
                topRightActions={
                  <>
                    <CardActions
                      id={siteFolder.id}
                      type="site"
                      name={siteFolder.name}
                      onEdit={() => setEditingSite({ id: siteFolder.id, name: siteFolder.name, city: '', state: '' })}
                    />
                    <DownloadButton
                      reportIds={siteFolder.reports.map(r => r.id)}
                      folderName={`${selectedCompany.name}_${siteFolder.name}`}
                      folderId={`site-${siteFolder.id}`}
                      size="sm"
                    />
                  </>
                }
              />
            ))}
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  // Level 1: Main view - show year selection then company folders
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Ano de Referência</h3>
              <p className="text-lg font-bold">{selectedMainYear}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="year-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">
              Selecionar Ano:
            </Label>
            <Select
              value={String(selectedMainYear)}
              onValueChange={(val) => setOpenYear(Number(val))}
            >
              <SelectTrigger id="year-select" className="w-[120px] bg-background">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredCompanyFolders.map((company) => (
            <FolderCard
              key={company.id}
              onClick={() => {
                // Uma única atualização de URL: duas chamadas encadeadas fazem a
                // segunda ler os params antigos e descartar o "company".
                setSearchParams(prev => {
                  const next = new URLSearchParams(prev);
                  next.set('company', company.id);
                  next.set('year', String(selectedMainYear));
                  next.delete('site'); next.delete('month'); next.delete('project');
                  return next;
                }, { replace: true });
              }}
              badge={
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-neutral-700 text-neutral-300 border-0">
                  Fábrica
                </Badge>
              }
              icon={
                <div className="w-20 h-[4.2rem] rounded-lg overflow-hidden flex items-center justify-center p-1" style={{ backgroundColor: '#ffffff' }}>
                  {(company.logo_url || company.photo_url) ? (
                    <img
                      src={company.logo_url || company.photo_url!}
                      alt={company.name}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
              }
              title={company.name}
              stats={
                company.totalCount === 0
                  ? [{ icon: <FileText className="h-3 w-3" />, label: 'Nenhum relatório ainda' }]
                  : [
                      { icon: <MapPin className="h-3 w-3" />, label: `${company.sites.length} unidade(s)` },
                      { icon: <FileText className="h-3 w-3" />, label: `${company.totalCount} relatório(s)` },
                    ]
              }
              topRightActions={
                <>
                  <CardActions
                    id={company.id}
                    type="company"
                    name={company.name}
                    onEdit={() => navigate(`/super-admin?tab=companies&edit=${company.id}`)}
                  />
                  <DownloadButton
                    reportIds={company.reports.map((r) => r.id)}
                    folderName={company.name}
                    folderId={`company-${company.id}`}
                    size="sm"
                  />
                </>
              }
            />
          ))}
        </div>
      </div>

      {dialogs}
    </>
  );
}


export default DocumentCabinet;
