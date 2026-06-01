import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import { 
  ArrowLeft, Building2, MapPin, FolderKanban, Plus, Search, ChevronRight,
  FileText, Users, TrendingUp, PieChart as PieChartIcon, Calendar, Activity,
  FileSignature, CheckCircle2, Clock, XCircle, UsersRound,
  MoreVertical, Pencil, Trash2, Loader2
} from 'lucide-react';
import { format, subDays, parseISO, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';

type PeriodFilter = '7' | '30' | '90';
import { ptBR } from 'date-fns/locale';

interface Site {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  projectsCount: number;
  reportsCount: number;
  totalWorkforce: number;
  avgProgress: number;
  lastReportDate: string | null;
  inProgressCount: number;
  totalCollaborators: number;
}

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  photo_url: string | null;
  cnpj: string | null;
}

interface CompanyStats {
  totalSites: number;
  totalProjects: number;
  totalReports: number;
  totalPlannedWorkforce: number;
  totalActualWorkforce: number;
  workforceEfficiency: number;
  totalCollaborators: number;
}

interface ReportByDay {
  date: string;
  count: number;
}

interface ReportByStatus {
  status: string;
  count: number;
  label: string;
}

interface WorkforceBySite {
  name: string;
  planned: number;
  actual: number;
}

interface ProjectProgress {
  name: string;
  progress: number;
}

interface SignatureStats {
  totalDocuments: number;
  signedDocuments: number;
  pendingDocuments: number;
  signatureRate: number;
}

interface SignaturesByStatus {
  status: string;
  count: number;
  label: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(var(--muted-foreground))',
  completed: 'hsl(var(--primary))',
  sent: 'hsl(var(--warning))',
  signed: 'hsl(var(--success))',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  completed: 'Concluído',
  sent: 'Enviado',
  signed: 'Assinado',
};

const SIGNATURE_STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(var(--muted-foreground))',
  pending: 'hsl(var(--warning))',
  signed: 'hsl(var(--success))',
  cancelled: 'hsl(var(--destructive))',
};

const SIGNATURE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  signed: 'Assinado',
  cancelled: 'Cancelado',
};

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function CompanyDashboard() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Edit/Delete site state
  const [editSiteDialogOpen, setEditSiteDialogOpen] = useState(false);
  const [deleteSiteDialogOpen, setDeleteSiteDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [savingSite, setSavingSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: '', city: '', state: '' });

  const handleEditSite = (site: Site, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSite(site);
    setSiteForm({ name: site.name, city: site.city || '', state: site.state || '' });
    setEditSiteDialogOpen(true);
  };

  const handleSaveSite = async () => {
    if (!selectedSite || !siteForm.name.trim()) return;
    setSavingSite(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update({ name: siteForm.name, city: siteForm.city || null, state: siteForm.state || null })
        .eq('id', selectedSite.id);
      if (error) throw error;
      toast({ title: 'Unidade atualizada com sucesso' });
      setEditSiteDialogOpen(false);
      fetchCompanyData();
    } catch (error) {
      console.error('Error saving site:', error);
      toast({ title: 'Erro ao salvar unidade', variant: 'destructive' });
    } finally {
      setSavingSite(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!selectedSite) return;
    try {
      const { error } = await supabase.from('sites').delete().eq('id', selectedSite.id);
      if (error) throw error;
      toast({ title: 'Unidade removida com sucesso' });
      setDeleteSiteDialogOpen(false);
      setSelectedSite(null);
      fetchCompanyData();
    } catch (error) {
      console.error('Error deleting site:', error);
      toast({ title: 'Erro ao remover unidade. Verifique se não há dados vinculados.', variant: 'destructive' });
    }
  };
  
  // Stats and chart data
  const [stats, setStats] = useState<CompanyStats>({
    totalSites: 0,
    totalProjects: 0,
    totalReports: 0,
    totalPlannedWorkforce: 0,
    totalActualWorkforce: 0,
    workforceEfficiency: 0,
    totalCollaborators: 0,
  });
  const [reportsByDay, setReportsByDay] = useState<ReportByDay[]>([]);
  const [reportsByStatus, setReportsByStatus] = useState<ReportByStatus[]>([]);
  const [workforceBySite, setWorkforceBySite] = useState<WorkforceBySite[]>([]);
  const [projectsProgress, setProjectsProgress] = useState<ProjectProgress[]>([]);
  
  // Signature stats
  const [signatureStats, setSignatureStats] = useState<SignatureStats>({
    totalDocuments: 0,
    signedDocuments: 0,
    pendingDocuments: 0,
    signatureRate: 0,
  });
  const [signaturesByStatus, setSignaturesByStatus] = useState<SignaturesByStatus[]>([]);
  
  // Period filter
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30');

  const fetchCompanyData = useCallback(async () => {
    if (!companyId) return;
    
    try {
      // Buscar empresa e unidades em paralelo
      const [{ data: companyData }, { data: allSitesData }] = await Promise.all([
        supabase.from('companies').select('id, name, logo_url, photo_url, cnpj').eq('id', companyId).single(),
        supabase.from('sites').select('id, name, city, state, address').eq('company_id', companyId).order('name'),
      ]);

      setCompany(companyData);

      // Restringir unidades visíveis com base no acesso do usuário (exceto super_admin)
      let sitesData = allSitesData || [];
      if (role !== 'super_admin' && user?.id && sitesData.length > 0) {
        const [{ data: paa }, { data: srs }] = await Promise.all([
          supabase.from('portal_admin_access').select('site_id').eq('user_id', user.id),
          supabase.from('site_responsibles').select('site_id').eq('user_id', user.id),
        ]);
        const allowed = new Set<string>([
          ...((paa || []) as any[]).map((r) => r.site_id),
          ...((srs || []) as any[]).map((r) => r.site_id),
        ]);
        // Se o usuário tiver alguma atribuição, filtra; senão mantém comportamento atual
        if (allowed.size > 0) {
          sitesData = sitesData.filter((s: any) => allowed.has(s.id));
        }
      }

      if (!sitesData || sitesData.length === 0) {
        setSites([]);
        setLoading(false);
        return;
      }

      const siteIds = sitesData.map(s => s.id);
      const daysAgo = parseInt(periodFilter);
      const periodStartDate = format(subDays(new Date(), daysAgo), 'yyyy-MM-dd');

      // Buscar projetos e relatórios em paralelo
      const [
        { data: projectsData },
        { data: reportsData },
        { data: teamsData },
      ] = await Promise.all([
        supabase.from('projects').select('id, name, site_id, progress, status').in('site_id', siteIds),
        supabase.from('reports').select('id, date, status, planned_workforce, actual_workforce, project_id')
          .in('project_id', (await supabase.from('projects').select('id').in('site_id', siteIds)).data?.map(p => p.id) || []),
        supabase.from('teams').select('id, project_id').in('project_id', (await supabase.from('projects').select('id').in('site_id', siteIds)).data?.map(p => p.id) || []),
      ]);

      // Buscar membros das equipes
      const teamIds = (teamsData || []).map(t => t.id);
      const { data: membersData } = teamIds.length > 0
        ? await supabase.from('team_members').select('id, team_id').in('team_id', teamIds)
        : { data: [] };

      // Mapeamento de projeto para unidade
      const projectToSiteMap: Record<string, string> = {};
      (projectsData || []).forEach(p => {
        projectToSiteMap[p.id] = p.site_id;
      });

      // Mapeamento de equipe para projeto
      const teamToProjectMap: Record<string, string> = {};
      (teamsData || []).forEach(t => {
        teamToProjectMap[t.id] = t.project_id;
      });

      // Contagem e métricas por unidade
      const projectCountMap: Record<string, number> = {};
      const reportsCountMap: Record<string, number> = {};
      const workforceMap: Record<string, number> = {};
      const progressMap: Record<string, number[]> = {};
      const lastReportMap: Record<string, string> = {};
      const inProgressMap: Record<string, number> = {};
      const collaboratorsMap: Record<string, number> = {};

      (projectsData || []).forEach(p => {
        projectCountMap[p.site_id] = (projectCountMap[p.site_id] || 0) + 1;
        if (!progressMap[p.site_id]) progressMap[p.site_id] = [];
        if (p.progress !== null && p.progress !== undefined) {
          progressMap[p.site_id].push(Number(p.progress));
        }
        if (p.status === 'in_progress') {
          inProgressMap[p.site_id] = (inProgressMap[p.site_id] || 0) + 1;
        }
      });

      (reportsData || []).forEach(r => {
        const siteId = projectToSiteMap[r.project_id];
        if (siteId) {
          reportsCountMap[siteId] = (reportsCountMap[siteId] || 0) + 1;
          workforceMap[siteId] = (workforceMap[siteId] || 0) + (r.actual_workforce || 0);
          if (!lastReportMap[siteId] || r.date > lastReportMap[siteId]) {
            lastReportMap[siteId] = r.date;
          }
        }
      });

      // Count collaborators per site
      (membersData || []).forEach(m => {
        const projectId = teamToProjectMap[m.team_id];
        if (projectId) {
          const siteId = projectToSiteMap[projectId];
          if (siteId) {
            collaboratorsMap[siteId] = (collaboratorsMap[siteId] || 0) + 1;
          }
        }
      });

      const sitesWithCount: Site[] = sitesData.map(s => {
        const progresses = progressMap[s.id] || [];
        const avgProgress = progresses.length > 0 
          ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
          : 0;
        return {
          ...s,
          projectsCount: projectCountMap[s.id] || 0,
          reportsCount: reportsCountMap[s.id] || 0,
          totalWorkforce: workforceMap[s.id] || 0,
          avgProgress,
          lastReportDate: lastReportMap[s.id] || null,
          inProgressCount: inProgressMap[s.id] || 0,
          totalCollaborators: collaboratorsMap[s.id] || 0,
        };
      });
      setSites(sitesWithCount);

      // Calcular estatísticas
      const totalProjects = projectsData?.length || 0;
      const reportsInPeriod = (reportsData || []).filter(r => r.date >= periodStartDate);
      const totalReports = reportsInPeriod.length;
      
      // Buscar attendance de todos os RDOs para contagem única
      const reportIds = reportsInPeriod.map(r => r.id);
      const { data: attendanceData } = reportIds.length > 0
        ? await supabase
            .from('report_attendance')
            .select('user_id, user_name, present, report_id')
            .in('report_id', reportIds)
            .eq('present', true)
        : { data: [] };

      // Mapeamento de report para site
      const projectToSite: Record<string, string> = {};
      (projectsData || []).forEach(p => {
        projectToSite[p.id] = p.site_id;
      });
      
      const reportToSite: Record<string, string> = {};
      reportsInPeriod.forEach(r => {
        reportToSite[r.id] = projectToSite[r.project_id];
      });
      
      let totalPlanned = 0;
      reportsInPeriod.forEach(r => {
        totalPlanned += r.planned_workforce || 0;
      });
      
      // Efetivo real = pessoas únicas presentes no período
      const uniquePeople = new Set((attendanceData || []).map(a => a.user_id || a.user_name));
      const totalActual = uniquePeople.size;
      
      const efficiency = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

      // Calculate total collaborators across all sites
      const totalCollaborators = Object.values(collaboratorsMap).reduce((sum, count) => sum + count, 0);

      setStats({
        totalSites: sitesData.length,
        totalProjects,
        totalReports,
        totalPlannedWorkforce: totalPlanned,
        totalActualWorkforce: totalActual,
        workforceEfficiency: efficiency,
        totalCollaborators,
      });

      // Relatórios por dia (dinâmico conforme período)
      const dayMap: Record<string, number> = {};
      const chartDays = periodFilter === '7' ? 7 : periodFilter === '30' ? 14 : 12;
      
      if (periodFilter === '90') {
        // Para 90 dias, usar semanas
        const weeks = eachWeekOfInterval({
          start: subDays(new Date(), 84), // 12 semanas
          end: new Date()
        }, { weekStartsOn: 1 });
        
        weeks.forEach(weekStart => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          const weekKey = format(weekStart, 'yyyy-MM-dd');
          dayMap[weekKey] = 0;
          
          (reportsData || []).forEach(r => {
            const reportDate = parseISO(r.date);
            if (reportDate >= weekStart && reportDate <= weekEnd) {
              dayMap[weekKey]++;
            }
          });
        });
        
        setReportsByDay(Object.entries(dayMap).map(([date, count]) => ({
          date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
          count,
        })));
      } else {
        // Para 7 ou 30 dias, usar dias individuais
        for (let i = chartDays - 1; i >= 0; i--) {
          const day = format(subDays(new Date(), i), 'yyyy-MM-dd');
          dayMap[day] = 0;
        }
        
        const chartStartDate = format(subDays(new Date(), chartDays - 1), 'yyyy-MM-dd');
        (reportsData || []).filter(r => r.date >= chartStartDate).forEach(r => {
          if (dayMap[r.date] !== undefined) {
            dayMap[r.date]++;
          }
        });
        
        setReportsByDay(Object.entries(dayMap).map(([date, count]) => ({
          date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
          count,
        })));
      }

      // Relatórios por status (filtrado pelo período)
      const statusMap: Record<string, number> = {};
      reportsInPeriod.forEach(r => {
        const status = r.status || 'draft';
        statusMap[status] = (statusMap[status] || 0) + 1;
      });
      setReportsByStatus(Object.entries(statusMap).map(([status, count]) => ({
        status,
        count,
        label: STATUS_LABELS[status] || status,
      })));

      // Efetivo por unidade - pessoas únicas por site
      const siteWorkforce: Record<string, { name: string; planned: number; actual: Set<string> }> = {};
      sitesData.forEach(s => {
        siteWorkforce[s.id] = { 
          name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name, 
          planned: 0, 
          actual: new Set() 
        };
      });
      
      reportsInPeriod.forEach(r => {
        const siteId = projectToSite[r.project_id];
        if (siteId && siteWorkforce[siteId]) {
          siteWorkforce[siteId].planned += r.planned_workforce || 0;
        }
      });

      // Adicionar pessoas únicas por site
      (attendanceData || []).forEach(a => {
        const siteId = reportToSite[a.report_id];
        if (siteId && siteWorkforce[siteId]) {
          siteWorkforce[siteId].actual.add(a.user_id || a.user_name);
        }
      });

      setWorkforceBySite(
        Object.values(siteWorkforce)
          .filter(s => s.planned > 0 || s.actual.size > 0)
          .map(s => ({ name: s.name, planned: s.planned, actual: s.actual.size }))
      );

      // Progresso dos projetos (top 8)
      const projectsWithProgress = (projectsData || [])
        .filter(p => p.progress !== null && p.progress !== undefined)
        .sort((a, b) => (b.progress || 0) - (a.progress || 0))
        .slice(0, 8)
        .map(p => ({
          name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
          progress: p.progress || 0,
        }));
      setProjectsProgress(projectsWithProgress);

      // Buscar status de assinatura via approvers nativos - filtrado pelo período
      const projectIds = (projectsData || []).map(p => p.id);
      if (projectIds.length > 0) {
        const reportIds = reportsInPeriod.map(r => r.id);

        if (reportIds.length > 0) {
          const { data: approversData } = await supabase
            .from('report_company_approvers')
            .select('id, status, report_id')
            .in('report_id', reportIds);

          if (approversData && approversData.length > 0) {
            const totalDocs = approversData.length;
            const signedDocs = approversData.filter(d => d.status === 'approved').length;
            const pendingDocs = approversData.filter(d => d.status === 'pending').length;
            const rate = totalDocs > 0 ? Math.round((signedDocs / totalDocs) * 100) : 0;

            setSignatureStats({
              totalDocuments: totalDocs,
              signedDocuments: signedDocs,
              pendingDocuments: pendingDocs,
              signatureRate: rate,
            });

            // Agrupar por status
            const sigStatusMap: Record<string, number> = {};
            approversData.forEach(d => {
              const status = d.status || 'pending';
              sigStatusMap[status] = (sigStatusMap[status] || 0) + 1;
            });
            setSignaturesByStatus(Object.entries(sigStatusMap).map(([status, count]) => ({
              status,
              count,
              label: SIGNATURE_STATUS_LABELS[status] || status,
            })));
          }
        }
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, periodFilter, role, user?.id]);

  useEffect(() => {
    if (!companyId) return;
    
    fetchCompanyData();

    // Configurar subscription Realtime
    const channel = supabase
      .channel(`company-dashboard-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
        },
        () => {
          console.log('📊 RDO atualizado - recarregando dashboard...');
          fetchCompanyData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
        },
        () => {
          console.log('📊 Projeto atualizado - recarregando dashboard...');
          fetchCompanyData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sites',
        },
        () => {
          console.log('📊 Unidade atualizada - recarregando dashboard...');
          fetchCompanyData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, periodFilter, fetchCompanyData]);

  // Filtrar unidades
  const filteredSites = sites.filter(site =>
    site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.state?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Verificar acesso - permitir admin e super_admin
  if (role !== 'super_admin' && role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Acesso restrito a Administradores.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Empresa não encontrada</p>
      </div>
    );
  }

  const chartConfig = {
    count: { label: 'Relatórios', color: 'hsl(var(--primary))' },
    planned: { label: 'Planejado', color: 'hsl(var(--chart-1))' },
    actual: { label: 'Real', color: 'hsl(var(--chart-2))' },
    progress: { label: 'Progresso', color: 'hsl(var(--primary))' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-3 xs:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 min-w-0">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList className="text-xs sm:text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/super-admin" className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-primary transition-colors">
                   {(company.logo_url || company.photo_url) ? (
                    <img src={company.logo_url || company.photo_url} alt="" className="h-5 w-5 sm:h-6 sm:w-6 rounded object-contain" />
                  ) : (
                    <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                  <span className="hidden xs:inline">{company.name}</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium truncate max-w-[150px] xs:max-w-none">{company.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header da Empresa */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="rounded-full hover:bg-primary/10 h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            
            <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 min-w-0">
              {(company.logo_url || company.photo_url) ? (
                <img 
                  src={company.logo_url || company.photo_url} 
                  alt={company.name}
                  className="h-10 w-10 xs:h-12 xs:w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl object-contain border-2 border-primary/20 flex-shrink-0 bg-white p-1"
                />
              ) : (
                <div className="h-10 w-10 xs:h-12 xs:w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate">{company.name}</h1>
                {company.cnpj && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">CNPJ: {company.cnpj}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar unidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <ToggleGroup 
                type="single" 
                value={periodFilter} 
                onValueChange={(v) => v && setPeriodFilter(v as PeriodFilter)}
                className="bg-muted/50 rounded-lg p-1"
              >
                <ToggleGroupItem value="7" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  7 dias
                </ToggleGroupItem>
                <ToggleGroupItem value="30" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  30 dias
                </ToggleGroupItem>
                <ToggleGroupItem value="90" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  90 dias
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 xs:gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardContent className="p-3 xs:p-4">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-2 xs:p-2.5 rounded-xl bg-primary/10">
                  <Building2 className="h-4 w-4 xs:h-5 xs:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl font-bold">{stats.totalSites}</p>
                  <p className="text-[10px] xs:text-xs text-muted-foreground">Unidades</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardContent className="p-3 xs:p-4">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-2 xs:p-2.5 rounded-xl bg-chart-2/10">
                  <FolderKanban className="h-4 w-4 xs:h-5 xs:w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl font-bold">{stats.totalProjects}</p>
                  <p className="text-[10px] xs:text-xs text-muted-foreground">Atividades</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardContent className="p-3 xs:p-4">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-2 xs:p-2.5 rounded-xl bg-chart-3/10">
                  <FileText className="h-4 w-4 xs:h-5 xs:w-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl font-bold">{stats.totalReports}</p>
                  <p className="text-[10px] xs:text-xs text-muted-foreground">RDOs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardContent className="p-3 xs:p-4">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-2 xs:p-2.5 rounded-xl bg-chart-4/10">
                  <Users className="h-4 w-4 xs:h-5 xs:w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl font-bold">{stats.workforceEfficiency}%</p>
                  <p className="text-[10px] xs:text-xs text-muted-foreground">Eficiência</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardContent className="p-3 xs:p-4">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-2 xs:p-2.5 rounded-xl bg-cyan-500/10">
                  <UsersRound className="h-4 w-4 xs:h-5 xs:w-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl font-bold">{stats.totalCollaborators}</p>
                  <p className="text-[10px] xs:text-xs text-muted-foreground">Colaboradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Estatísticas de Assinaturas */}
        {signatureStats.totalDocuments > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-3 sm:gap-4">
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardContent className="p-3 xs:p-4">
                <div className="flex items-center gap-2 xs:gap-3">
                  <div className="p-2 xs:p-2.5 rounded-xl bg-primary/10">
                    <FileSignature className="h-4 w-4 xs:h-5 xs:w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg xs:text-2xl font-bold">{signatureStats.totalDocuments}</p>
                    <p className="text-[10px] xs:text-xs text-muted-foreground">Docs Enviados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardContent className="p-3 xs:p-4">
                <div className="flex items-center gap-2 xs:gap-3">
                  <div className="p-2 xs:p-2.5 rounded-xl bg-success/10">
                    <CheckCircle2 className="h-4 w-4 xs:h-5 xs:w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-lg xs:text-2xl font-bold">{signatureStats.signedDocuments}</p>
                    <p className="text-[10px] xs:text-xs text-muted-foreground">Assinados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardContent className="p-3 xs:p-4">
                <div className="flex items-center gap-2 xs:gap-3">
                  <div className="p-2 xs:p-2.5 rounded-xl bg-warning/10">
                    <Clock className="h-4 w-4 xs:h-5 xs:w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-lg xs:text-2xl font-bold">{signatureStats.pendingDocuments}</p>
                    <p className="text-[10px] xs:text-xs text-muted-foreground">Pendentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardContent className="p-3 xs:p-4">
                <div className="flex items-center gap-2 xs:gap-3">
                  <div className="p-2 xs:p-2.5 rounded-xl bg-chart-5/10">
                    <TrendingUp className="h-4 w-4 xs:h-5 xs:w-5 text-chart-5" />
                  </div>
                  <div>
                    <p className="text-lg xs:text-2xl font-bold">{signatureStats.signatureRate}%</p>
                    <p className="text-[10px] xs:text-xs text-muted-foreground">Taxa Assinatura</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Relatórios por Dia */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Relatórios por {periodFilter === '90' ? 'Semana' : 'Dia'}
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {periodFilter} dias
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <LineChart data={reportsByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Relatórios por Status */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Status dos Relatórios
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {periodFilter} dias
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={reportsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="label"
                    >
                      {reportsByStatus.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={STATUS_COLORS[entry.status] || CHART_COLORS[index % CHART_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend 
                      formatter={(value) => <span className="text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Efetivo por Unidade */}
          {workforceBySite.length > 0 && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
              <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Efetivo por Unidade
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {periodFilter} dias
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <BarChart data={workforceBySite} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend formatter={(value) => <span className="text-xs">{value === 'planned' ? 'Planejado' : 'Real'}</span>} />
                    <Bar dataKey="planned" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={12} />
                    <Bar dataKey="actual" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Progresso das Atividades */}
          {projectsProgress.length > 0 && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  Progresso das Atividades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <BarChart data={projectsProgress} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="progress" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]} 
                      barSize={14}
                      label={{ position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Status das Assinaturas */}
          {signaturesByStatus.length > 0 && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
              <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-primary" />
                  Status das Assinaturas
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {periodFilter} dias
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={signaturesByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="label"
                      >
                        {signaturesByStatus.map((entry, index) => (
                          <Cell 
                            key={`sig-cell-${index}`} 
                            fill={SIGNATURE_STATUS_COLORS[entry.status] || CHART_COLORS[index % CHART_COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend 
                        formatter={(value) => <span className="text-xs">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contador de Unidades */}
        <div className="flex items-center gap-2 text-muted-foreground pt-4">
          <MapPin className="h-5 w-5" />
          <span className="text-sm font-medium">
            {filteredSites.length} {filteredSites.length === 1 ? 'unidade' : 'unidades'}
            {searchTerm && ` encontrada${filteredSites.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Grid de Cards das Unidades */}
        {filteredSites.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <MapPin className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? 'Nenhuma unidade encontrada' : 'Nenhuma unidade cadastrada'}
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                {searchTerm 
                  ? 'Tente buscar com outros termos' 
                  : 'Cadastre a primeira unidade desta empresa para começar a gerenciar suas atividades.'}
              </p>
              {!searchTerm && (
                <Button 
                  onClick={() => navigate('/reports/new')}
                  className="rounded-xl gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar Unidade
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSites.map((site, index) => (
              <div key={site.id} className="relative">
                {/* Dropdown ⋮ */}
                <div className="absolute top-3 right-3 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={(e) => handleEditSite(site, e)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); setSelectedSite(site); setDeleteSiteDialogOpen(true); }} 
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Card
                  onClick={() => navigate(`/sites/${site.id}/dashboard`)}
                  className={cn(
                    "group cursor-pointer overflow-hidden border-0",
                    "bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm",
                    "hover:shadow-2xl hover:shadow-primary/10 hover:scale-[1.02]",
                    "transition-all duration-300 ease-out",
                    "opacity-0 animate-fade-up"
                  )}
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                >
                  <CardContent className="p-5">
                    {/* Header com nome e localização */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">
                          {site.name}
                        </h3>
                        {(site.city || site.state) && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{[site.city, site.state].filter(Boolean).join(' - ')}</span>
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                    </div>

                    {/* Grid de Métricas 2x2 */}
                    <div className="grid grid-cols-2 gap-2.5 mb-4">
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                        <FolderKanban className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{site.projectsCount}</p>
                          <p className="text-[10px] text-muted-foreground truncate">Atividades</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-chart-2/5 group-hover:bg-chart-2/10 transition-colors">
                        <FileText className="h-4 w-4 text-chart-2 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{site.reportsCount}</p>
                          <p className="text-[10px] text-muted-foreground truncate">RDOs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-chart-3/5 group-hover:bg-chart-3/10 transition-colors">
                        <Users className="h-4 w-4 text-chart-3 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{site.totalWorkforce}</p>
                          <p className="text-[10px] text-muted-foreground truncate">Efetivo Total</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-chart-4/5 group-hover:bg-chart-4/10 transition-colors">
                        <Activity className="h-4 w-4 text-chart-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{site.avgProgress}%</p>
                          <p className="text-[10px] text-muted-foreground truncate">Progresso</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">
                          {site.totalCollaborators} colaborador{site.totalCollaborators !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      {site.inProgressCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium whitespace-nowrap flex-shrink-0">
                          {site.inProgressCount} em andamento
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Site Dialog */}
      <Dialog open={editSiteDialogOpen} onOpenChange={setEditSiteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Unidade</DialogTitle>
            <DialogDescription>Atualize os dados da unidade</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={siteForm.name}
                onChange={(e) => setSiteForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome da unidade"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={siteForm.city}
                  onChange={(e) => setSiteForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  value={siteForm.state}
                  onChange={(e) => setSiteForm(f => ({ ...f, state: e.target.value }))}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSiteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSite} disabled={savingSite}>
              {savingSite && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteSiteDialogOpen}
        onOpenChange={setDeleteSiteDialogOpen}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja excluir a unidade "${selectedSite?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        onConfirm={handleDeleteSite}
      />
    </div>
  );
}
