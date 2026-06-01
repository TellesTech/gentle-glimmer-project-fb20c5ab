import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/loose-client';
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
import { 
  ArrowLeft, Building2, MapPin, FolderKanban, Users, FileText, 
  TrendingUp, ChevronRight, Calendar, BarChart3, UsersRound, Clock,
  MoreVertical, Pencil, Trash2, Loader2
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseIntervalToMinutes, formatMinutesToHours } from '@/lib/formatters';

interface Site {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  code: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  reportsCount: number;
  progress: number;
  totalWorkforce: number;
  lastReportDate: string | null;
  teamsCount: number;
  membersCount: number;
  totalDelayMinutes: number;
}

interface DashboardMetrics {
  totalProjects: number;
  totalReports: number;
  plannedWorkforce: number;
  actualWorkforce: number;
  avgProgress: number;
}

interface WorkforceData {
  date: string;
  planejado: number;
  real: number;
}

export default function SiteDashboard() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();

  const [site, setSite] = useState<Site | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProjects: 0,
    totalReports: 0,
    plannedWorkforce: 0,
    actualWorkforce: 0,
    avgProgress: 0,
  });
  const [workforceData, setWorkforceData] = useState<WorkforceData[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Delete activity state
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', code: '' });

  const handleEditProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProject(project);
    setProjectForm({ name: project.name, code: project.code || '' });
    setEditProjectDialogOpen(true);
  };

  const handleSaveProject = async () => {
    if (!selectedProject || !projectForm.name.trim()) return;
    setSavingProject(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: projectForm.name, code: projectForm.code || null })
        .eq('id', selectedProject.id);
      if (error) throw error;
      toast({ title: 'Atividade atualizada com sucesso' });
      setEditProjectDialogOpen(false);
      fetchDashboardData();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({ title: 'Erro ao salvar atividade', variant: 'destructive' });
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', selectedProject.id);
      if (error) throw error;
      toast({ title: 'Atividade removida com sucesso' });
      setDeleteProjectDialogOpen(false);
      setSelectedProject(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ title: 'Erro ao remover atividade. Verifique se não há dados vinculados.', variant: 'destructive' });
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!siteId) return;

    try {
      // Buscar site
      const { data: siteData } = await supabase
        .from('sites')
        .select('id, name, city, state, address, company_id')
        .eq('id', siteId)
        .single();

      if (!siteData) {
        setLoading(false);
        return;
      }

      setSite(siteData);

      // Buscar empresa
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', siteData.company_id)
        .single();

      setCompany(companyData);

      // Buscar projetos da unidade (incluindo default_planned_workforce)
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, status, code, description, start_date, end_date, progress, default_planned_workforce')
        .eq('site_id', siteId)
        .order('name');

      if (projectsData && projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id);

        // Buscar relatórios dos projetos (incluindo campos de atraso)
        const { data: reportsData } = await supabase
          .from('reports')
          .select('id, project_id, planned_workforce, actual_workforce, real_percentage, date, daily_progress, operational_deviation_hours, climatic_deviation_hours, amt_deviation_hours, maintenance_order_title')
          .in('project_id', projectIds);

        // Buscar efetivo programado por dia de todos os projetos
        const { data: dailyWorkforceData } = await supabase
          .from('project_daily_workforce')
          .select('project_id, date, planned_count')
          .in('project_id', projectIds);

        // Buscar equipes dos projetos
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, project_id')
          .in('project_id', projectIds);

        // Buscar membros das equipes
        const teamIds = (teamsData || []).map(t => t.id);
        const { data: membersData } = teamIds.length > 0 
          ? await supabase
              .from('team_members')
              .select('id, team_id')
              .in('team_id', teamIds)
          : { data: [] };

        // Buscar attendance de todos os RDOs para contagem única
        const reportIds = (reportsData || []).map(r => r.id);
        const { data: attendanceData } = reportIds.length > 0
          ? await supabase
              .from('report_attendance')
              .select('user_id, user_name, present, report_id')
              .in('report_id', reportIds)
              .eq('present', true)
          : { data: [] };

        // Contagem de relatórios e métricas por projeto
        const projectsWithMetrics: Project[] = projectsData.map(p => {
          const projectReports = (reportsData || []).filter(r => r.project_id === p.id);
          const sortedReports = [...projectReports].sort((a, b) => 
            parseISO(b.date).getTime() - parseISO(a.date).getTime()
          );
          
          // Calcular progresso real somando daily_progress de todos os RDOs, limitado a 100%
          const calculatedProgress = Math.min(
            projectReports.reduce((sum, r) => sum + (r.daily_progress || 0), 0),
            100
          );
          
          // Contar equipes do projeto
          const projectTeams = (teamsData || []).filter(t => t.project_id === p.id);
          const projectTeamIds = projectTeams.map(t => t.id);
          
          // Contar membros das equipes do projeto
          const projectMembers = (membersData || []).filter(m => projectTeamIds.includes(m.team_id));

          // Contar pessoas únicas nos RDOs do projeto
          const projectReportIds = projectReports.map(r => r.id);
          const projectAttendance = (attendanceData || []).filter(a => projectReportIds.includes(a.report_id));
          const uniqueProjectPeople = new Set(projectAttendance.map(a => a.user_id || a.user_name));
          
          // Calcular total de atrasos do projeto
          const totalDelayMinutes = projectReports.reduce((sum, r) => {
            const opHours = r.operational_deviation_hours as string | null;
            const climHours = r.climatic_deviation_hours as string | null;
            const amtHours = r.amt_deviation_hours as string | null;
            return sum + 
              parseIntervalToMinutes(opHours) +
              parseIntervalToMinutes(climHours) +
              parseIntervalToMinutes(amtHours);
          }, 0);
          
          // Fallback: usar maintenance_order_title do relatório mais recente se nome for genérico
          let displayName = p.name;
          if (!displayName || displayName === '*' || displayName.startsWith('Atividade criada via')) {
            const omTitle = sortedReports.find(r => (r as any).maintenance_order_title)?.['maintenance_order_title' as keyof typeof sortedReports[0]];
            if (omTitle) displayName = String(omTitle);
          }

          return {
            ...p,
            name: displayName,
            reportsCount: projectReports.length,
            // Usar progresso calculado, limitado a 100%
            progress: Math.min(Math.round(calculatedProgress * 10) / 10, 100),
            totalWorkforce: uniqueProjectPeople.size,
            lastReportDate: sortedReports[0]?.date || null,
            teamsCount: projectTeams.length,
            membersCount: projectMembers.length,
            totalDelayMinutes,
          };
        });

        setProjects(projectsWithMetrics);

        // Calcular métricas - pessoas únicas em todo o site
        const totalReports = reportsData?.length || 0;
        
        // Ef. Prog. = soma do default_planned_workforce de cada projeto (valor atual, não acumulado)
        const plannedWorkforce = projectsData.reduce((sum, p) => sum + (p.default_planned_workforce || 0), 0);
        
        // Efetivo real = pessoas únicas presentes
        const uniquePeople = new Set((attendanceData || []).map(a => a.user_id || a.user_name));
        const actualWorkforce = uniquePeople.size;
        
        // Calcular média de progresso usando os progressos calculados dos projetos
        const avgProgress = projectsWithMetrics.length > 0
          ? projectsWithMetrics.reduce((sum, p) => sum + p.progress, 0) / projectsWithMetrics.length
          : 0;

        setMetrics({
          totalProjects: projectsData.length,
          totalReports,
          plannedWorkforce,
          actualWorkforce,
          avgProgress: Math.round(avgProgress * 10) / 10,
        });

        // Gerar dados do gráfico de evolução do efetivo (últimos 14 dias)
        const last14Days: WorkforceData[] = [];
        for (let i = 13; i >= 0; i--) {
          const date = subDays(new Date(), i);
          const dateStr = format(date, 'yyyy-MM-dd');
          
          const dayReports = (reportsData || []).filter(r => r.date === dateStr);
          
          // Calcular efetivo planejado usando programação de efetivo
          // Prioridade: 1) project_daily_workforce, 2) default_planned_workforce do projeto, 3) planned_workforce do RDO
          const dayPlanned = projectIds.reduce((sum, pid) => {
            // Verificar se há programação diária para este projeto nesta data
            const dailyEntry = (dailyWorkforceData || []).find(
              d => d.project_id === pid && d.date === dateStr
            );
            
            if (dailyEntry) {
              return sum + dailyEntry.planned_count;
            }
            
            // Se não, usar default do projeto
            const proj = projectsData.find(p => p.id === pid);
            if (proj?.default_planned_workforce) {
              return sum + proj.default_planned_workforce;
            }
            
            // Fallback: usar planned_workforce dos RDOs do dia para este projeto
            const projectDayReports = dayReports.filter(r => r.project_id === pid);
            return sum + projectDayReports.reduce((s, r) => s + (r.planned_workforce || 0), 0);
          }, 0);
          
          // Pessoas únicas no dia
          const dayReportIds = dayReports.map(r => r.id);
          const dayAttendance = (attendanceData || []).filter(a => dayReportIds.includes(a.report_id));
          const uniqueInDay = new Set(dayAttendance.map(a => a.user_id || a.user_name));

          last14Days.push({
            date: format(date, 'dd/MM', { locale: ptBR }),
            planejado: dayPlanned,
            real: uniqueInDay.size,
          });
        }

        setWorkforceData(last14Days);
      } else {
        setProjects([]);
        setWorkforceData([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    
    fetchDashboardData();

    // Configurar subscription Realtime
    const channel = supabase
      .channel(`site-dashboard-${siteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
        },
        () => {
          console.log('📊 RDO atualizado - recarregando dashboard...');
          fetchDashboardData();
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
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId, fetchDashboardData]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Unidade não encontrada</p>
      </div>
    );
  }

  const workforcePercentage = metrics.plannedWorkforce > 0 
    ? Math.round((metrics.actualWorkforce / metrics.plannedWorkforce) * 100) 
    : 0;

  const chartConfig = {
    planejado: {
      label: 'Planejado',
      color: 'hsl(var(--primary))',
    },
    real: {
      label: 'Real',
      color: 'hsl(var(--chart-2))',
    },
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
                  <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">Super Admin</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {company && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link 
                      to={`/companies/${company.id}/dashboard`} 
                      className="text-muted-foreground hover:text-primary transition-colors truncate max-w-[80px] xs:max-w-[120px] inline-block"
                    >
                      {company.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium truncate max-w-[100px] xs:max-w-none">{site.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
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
              <div className="p-2 xs:p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0">
                <MapPin className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate">{site.name}</h1>
                {(site.city || site.state) && (
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                    {[site.city, site.state].filter(Boolean).join(' - ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button 
            size="sm"
            onClick={() => navigate(`/sites/${siteId}`)}
            className="rounded-xl gap-2 w-fit"
          >
            <FolderKanban className="h-4 w-4" />
            Gerenciar Atividades
          </Button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 xs:gap-3 sm:gap-4">
          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-3 xs:p-4 sm:p-5">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-1.5 xs:p-2 rounded-xl bg-muted border border-border">
                  <FolderKanban className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl sm:text-3xl font-bold text-foreground">{metrics.totalProjects}</p>
                  <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Atividades</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-3 xs:p-4 sm:p-5">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-1.5 xs:p-2 rounded-xl bg-muted border border-border">
                  <FileText className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl sm:text-3xl font-bold text-foreground">{metrics.totalReports}</p>
                  <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">RDOs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-3 xs:p-4 sm:p-5">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-1.5 xs:p-2 rounded-xl bg-muted border border-border">
                  <Users className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl sm:text-3xl font-bold text-foreground">{metrics.plannedWorkforce}</p>
                  <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Ef. Prog.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border shadow-sm">
            <CardContent className="p-3 xs:p-4 sm:p-5">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-1.5 xs:p-2 rounded-xl bg-muted border border-border">
                  <Users className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg xs:text-2xl sm:text-3xl font-bold text-foreground">{metrics.actualWorkforce}</p>
                  <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">Ef. Real</p>
                  {metrics.plannedWorkforce > 0 && (
                    <p className="text-[10px] xs:text-xs text-muted-foreground">
                      {workforcePercentage}%
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Progresso e Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progresso Geral */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Progresso Médio de Execução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Percentual médio realizado</span>
                  <span className="font-semibold">{metrics.avgProgress}%</span>
                </div>
                <Progress value={metrics.avgProgress} className="h-3" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{metrics.totalProjects}</p>
                  <p className="text-xs text-muted-foreground">Atividades em andamento</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{metrics.totalReports}</p>
                  <p className="text-xs text-muted-foreground">RDOs registrados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Evolução */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Evolução do Efetivo (14 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <AreaChart data={workforceData}>
                  <defs>
                    <linearGradient id="fillPlanejado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8}
                    fontSize={11}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8}
                    fontSize={11}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="planejado"
                    stroke="hsl(var(--primary))"
                    fill="url(#fillPlanejado)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="real"
                    stroke="hsl(var(--chart-2))"
                    fill="url(#fillReal)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
              
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Planejado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                  <span className="text-xs text-muted-foreground">Real</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grid de Atividades */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              Atividades desta Unidade
            </h2>
            <span className="text-sm text-muted-foreground">
              {projects.length} {projects.length === 1 ? 'atividade' : 'atividades'}
            </span>
          </div>

          {projects.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <FolderKanban className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma atividade cadastrada</h3>
                <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                  Cadastre a primeira atividade desta unidade para começar.
                </p>
                <Button 
                  onClick={() => navigate(`/sites/${siteId}`)}
                  className="rounded-xl gap-2"
                >
                  <FolderKanban className="h-4 w-4" />
                  Gerenciar Atividades
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => (
                <div key={project.id} className="relative">
                  {/* Dropdown ⋮ */}
                  <div className="absolute top-2 right-2 z-10">
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
                        <DropdownMenuItem onClick={(e) => handleEditProject(project, e)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); setSelectedProject(project); setDeleteProjectDialogOpen(true); }} 
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="group rounded-xl border bg-card p-3.5 hover:bg-muted/60 transition-colors cursor-pointer shadow-sm"
                  >
                    {/* Header: icon + name + delay */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-muted shrink-0">
                          <FolderKanban className="h-4 w-4 text-foreground/70" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-foreground truncate block">{project.name}</span>
                          {project.code && (
                            <span className="text-xs font-mono text-foreground/60">{project.code}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mr-6">
                        {project.totalDelayMinutes > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10">
                            <Clock className="h-3 w-3 text-destructive" />
                            <span className="text-[10px] font-medium text-destructive">
                              {formatMinutesToHours(project.totalDelayMinutes)}
                            </span>
                          </div>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2.5 mt-2">
                      <span>{project.reportsCount} RDOs</span>
                      <span>·</span>
                      <span>{project.totalWorkforce} Efetivo</span>
                      <span>·</span>
                      <span>
                        {project.lastReportDate
                          ? format(parseISO(project.lastReportDate), 'dd/MM/yyyy', { locale: ptBR })
                          : 'Sem RDOs'}
                      </span>
                    </div>

                    {/* Progress bar + status */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground rounded-full transition-all"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground w-8 text-right">{project.progress}%</span>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
                        getStatusColor(project.status || 'planning')
                      )}>
                        {getStatusLabel(project.status || 'planning')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={editProjectDialogOpen} onOpenChange={setEditProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Atividade</DialogTitle>
            <DialogDescription>Atualize os dados da atividade</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome da atividade"
              />
            </div>
            <div>
              <Label>Código</Label>
              <Input
                value={projectForm.code}
                onChange={(e) => setProjectForm(f => ({ ...f, code: e.target.value }))}
                placeholder="Código da atividade"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProjectDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProject} disabled={savingProject}>
              {savingProject && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteProjectDialogOpen}
        onOpenChange={setDeleteProjectDialogOpen}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja excluir a atividade "${selectedProject?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
