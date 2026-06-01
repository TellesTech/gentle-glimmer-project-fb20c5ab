import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, getYear, getMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Folder, FileText, ChevronLeft, ChevronRight,
  Building2, MapPin, Calendar, Download, Loader2, HardHat, FolderKanban,
  MoreVertical, Pencil, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FolderCard from '@/components/reports/FolderCard';
import { StatusBadge, ConfirmDialog } from '@/components/shared';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
}

interface MonthFolder {
  month: number;
  monthName: string;
  reports: Report[];
  count: number;
  projects: ProjectFolder[];
}

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

interface DocumentCabinetProps {
  onBreadcrumbChange?: (breadcrumbs: CabinetBreadcrumbItem[]) => void;
}

export function DocumentCabinet({ onBreadcrumbChange }: DocumentCabinetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { siteIds } = useAdminSiteAccess();
  const isRestrictedAdmin = role === 'admin' && siteIds.length > 0;
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
  const [deletingItem, setDeletingItem] = useState<{ id: string; type: 'company' | 'site' | 'project' | 'report'; name: string } | null>(null);
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

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const table = {
        report: 'reports',
        project: 'projects',
        site: 'sites',
        company: 'companies',
      }[deletingItem.type] as 'reports' | 'projects' | 'sites' | 'companies';

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
        throw new Error('Sem permissão para excluir este item.');
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

  const CardActions = ({ id, type, name, onEdit }: { id: string; type: 'company' | 'site' | 'project' | 'report'; name: string; onEdit?: () => void }) => {
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
          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingItem({ id, type, name })}>
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Excluir
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
  };

  const handleDownloadWithOptions = async (options: {
    includeSignatureFields: boolean;
    signatureFieldLabels: string[];
    downloadWindow?: Window | null;
  }) => {
    if (!pendingDownload) return;

    const { reportIds, folderName, folderId } = pendingDownload;

    setIsExporting(true);
    setExportingId(folderId);
    setExportProgress(null);

    const pdfOptions: PdfOptions = {
      includeSignatureFields: options.includeSignatureFields,
      signatureFieldLabels: options.signatureFieldLabels,
    };

    try {
      const { blob } = await exportReportsBatch(
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
        description: `${reportIds.length} relatório(s) sendo baixado(s).`,
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

  // Fetch completed AND draft reports with company hierarchy
  const { data: reports = [], isLoading } = useQuery({
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
          .select(`
            id,
            date,
            shift,
            location,
            status,
            rdo_number,
            actual_workforce,
            daily_progress,
            maintenance_order_title,
            maintenance_order_number,
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
          `)
          .in('status', ['completed', 'draft', 'sent', 'signed'])
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
      const company = report.project?.site?.company;
      const site = report.project?.site;
      const project = report.project;
      if (!company || !site || !project) return;
      
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
      
      let projectFolder = monthFolder.projects.find(p => p.id === project.id);
      const isGenericName = !project.name || project.name === '*' || project.name.startsWith('Atividade criada via');
      const displayName = isGenericName ? (report.location || report.maintenance_order_title || project.name) : project.name;
      if (!projectFolder) {
        projectFolder = { 
          id: project.id, 
          name: displayName,
          code: project.code || null,
          reports: [], 
          count: 0,
          totalWorkforce: 0,
          progress: 0,
          status: project.status || 'planning',
          lastDate: null,
        };
        monthFolder.projects.push(projectFolder);
      }
      projectFolder.reports.push(report);
      projectFolder.count++;
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

      if (!monthFolder.projects.find(pf => pf.id === p.id)) {
        const isGenericName = !p.name || p.name === '*' || (p.name || '').startsWith('Atividade criada via');
        monthFolder.projects.push({
          id: p.id,
          name: isGenericName ? (p.name || 'Atividade') : p.name,
          code: p.code || null,
          reports: [],
          count: 0,
          totalWorkforce: 0,
          progress: 0,
          status: p.status || 'planning',
          lastDate: null,
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
            month.projects.sort((a, b) => b.count - a.count);
          });
        });
      });
    });
    
    return Array.from(map.values()).sort((a, b) => {
      if (a.totalCount > 0 && b.totalCount === 0) return -1;
      if (a.totalCount === 0 && b.totalCount > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [reports, allCompanies, allSites, allProjects]);

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

  const dialogs = (
    <>
      <BatchDownloadOptionsDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        onConfirm={handleDownloadWithOptions}
        reportCount={pendingDownload?.reportIds.length || 0}
        folderName={pendingDownload?.folderName || ''}
      />
      <ConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={`Excluir ${deletingItem?.type === 'company' ? 'empresa' : deletingItem?.type === 'site' ? 'unidade' : deletingItem?.type === 'project' ? 'atividade' : 'relatório'}`}
        description={`Tem certeza que deseja excluir "${deletingItem?.name}"? Esta ação não pode ser desfeita.`}
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
            <DownloadButton
              reportIds={selectedProjectFolder.reports.map(r => r.id)}
              folderName={`${selectedCompany.name}_${selectedSiteFolder.name}_${selectedYearFolder.year}_${selectedMonthFolder.monthName}_${selectedProjectFolder.name}`}
              folderId={`project-${selectedProjectFolder.id}-${openMonth}-${openYear}`}
            />
          </div>

          {/* Reports list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedProjectFolder.reports.map((report) => (
              <div
                key={report.id}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="relative rounded-xl border bg-card p-4 hover:bg-muted/60 transition-colors cursor-pointer shadow-sm group"
              >
                {/* Actions */}
                {isSuperAdmin && (
                  <div className="absolute top-2 right-2 z-10">
                    <CardActions
                      id={report.id}
                      type="report"
                      name={`RDO Nº ${(report.rdo_number ?? 1).toString().padStart(3, '0')}`}
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
                      RDO Nº {(report.rdo_number ?? 1).toString().padStart(3, '0')}
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
                </div>
              </div>
            ))}
          </div>
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
                  {selectedMonthFolder.projects.length} atividade(s) • {selectedMonthFolder.count} relatório(s)
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
                {isSuperAdmin && (
                  <div className="absolute top-2 right-2 z-10">
                    <CardActions
                      id={projectFolder.id}
                      type="project"
                      name={projectFolder.name}
                      onEdit={() => navigate(`/projects/${projectFolder.id}`)}
                    />
                  </div>
                )}

                {/* Header: icon + name + chevron */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-foreground/10 shrink-0">
                    <FolderKanban className="h-5 w-5 text-foreground/70" />
                  </div>
                  <span className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">{projectFolder.name}</span>
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
                  {selectedSiteFolder.totalCount} relatório(s) • {selectedSiteFolder.years.length} ano(s)
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
                    {siteFolder.photo_url ? (
                      <img src={siteFolder.photo_url} alt={siteFolder.name} className="w-full h-full object-cover" />
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

  // Level 1: Main view - company folders
  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-6">
        {companyFolders.map((company) => (
          <FolderCard
            key={company.id}
            onClick={() => setOpenCompanyId(company.id)}
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

      {dialogs}
    </>
  );
}

export default DocumentCabinet;
