import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState, ConfirmDialog, ImageUploader } from '@/components/shared';
import { CompanyContactsDialog } from '@/components/admin/CompanyContactsDialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ValidatedInput } from '@/components/shared/ValidatedInput';
import { Separator } from '@/components/ui/separator';
import { PhoneInput } from '@/components/ui/phone-input';
import { MilestonesEditor, MilestoneItem } from '@/components/reports/MilestonesEditor';
import { WorkforcePlanningSection, DailyWorkforce } from '@/components/reports/WorkforcePlanningSection';
import { ProjectStagesEditor, ProjectStage } from '@/components/reports/ProjectStagesEditor';
import { 
  Building2, 
  MapPin, 
  HardHat, 
  Users, 
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  CalendarIcon,
  Target,
  ChevronsUpDown,
  Check,
  X,
  FolderOpen,
  FolderKanban,
  Layers,
  Search,
  Clock
} from 'lucide-react';
import { parseIntervalToMinutes, formatMinutesToHours } from '@/lib/formatters';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay,
  addMonths, 
  subMonths,
  isSameDay,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SelectionData {
  companyId: string | null;
  companyName: string | null;
  siteId: string | null;
  siteName: string | null;
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
  teamName: string | null;
}

interface ProjectSelectorProps {
  onComplete: (data: SelectionData) => void;
  initialData?: Partial<SelectionData>;
}

// Card clicável premium
interface SelectableCardProps {
  label: string;
  sublabel?: string;
  imageUrl?: string | null;
  logoUrl?: string | null;
  icon: React.ElementType;
  onClick: () => void;
  badge?: string;
  progress?: number | null;
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onContacts?: () => void;
}

const SelectableCard: React.FC<SelectableCardProps> = ({
  label,
  sublabel,
  imageUrl,
  logoUrl,
  icon: Icon,
  onClick,
  badge,
  progress,
  showActions,
  onEdit,
  onDelete,
  onContacts,
}) => {
  const displayImage = logoUrl || imageUrl;

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          "w-full flex flex-col rounded-xl border-2 border-border bg-card p-3 text-left transition-all duration-200",
          "hover:border-muted-foreground/40 hover:shadow-lg hover:scale-[1.02]",
          "focus:outline-none focus:ring-2 focus:ring-muted-foreground/40 focus:ring-offset-2"
        )}
      >
        {/* Badge */}
        {badge && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 z-10">
            {badge}
          </Badge>
        )}

        {/* Image Area - Rectangular */}
        <div className="aspect-[2/1] w-full rounded-lg bg-muted overflow-hidden mb-3 transition-colors group-hover:bg-muted/80">
          {displayImage ? (
            <img
              src={displayImage}
              alt={label}
              className={cn(
                "h-full w-full",
                logoUrl ? "object-contain p-3" : "object-cover"
              )}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className="h-10 w-10 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate group-hover:text-foreground transition-colors">
            {label}
          </p>
          {sublabel && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {sublabel}
            </p>
          )}
          {typeof progress === "number" && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progresso</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-muted-foreground/50 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </button>

      {/* Edit Button - Always visible */}
      {showActions && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-2 right-2 h-7 w-7 bg-background/80 backdrop-blur-sm z-20 hover:bg-background"
          onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      
      {/* Contacts button for companies */}
      {showActions && onContacts && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-2 right-10 h-7 w-7 bg-background/80 backdrop-blur-sm z-20 hover:bg-background"
          onClick={(e) => { e.stopPropagation(); onContacts?.(); }}
        >
          <Users className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

// Card para criação inline
interface CreateCardProps {
  label: string;
  onClick: () => void;
}

const CreateCard: React.FC<CreateCardProps> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-center transition-all duration-200",
      "hover:border-muted-foreground/30 hover:bg-muted/50 hover:scale-[1.02]",
      "focus:outline-none focus:ring-2 focus:ring-muted-foreground/40 focus:ring-offset-2"
    )}
  >
    <div className="aspect-[2/1] w-full flex items-center justify-center">
      <div className="rounded-full bg-muted p-3 group-hover:bg-muted-foreground/20 transition-colors">
        <Plus className="h-6 w-6 text-muted-foreground" />
      </div>
    </div>
    <p className="font-medium text-sm text-muted-foreground group-hover:text-foreground mt-3 transition-colors">
      {label}
    </p>
  </button>
);

interface ReturnState {
  returnToStep?: number;
  companyId?: string;
  companyName?: string;
  siteId?: string;
  siteName?: string;
  projectId?: string;
  projectName?: string;
}

export function ProjectSelector({ onComplete, initialData }: ProjectSelectorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as ReturnState | null;
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selection, setSelection] = useState<SelectionData>({
    companyId: initialData?.companyId || null,
    companyName: initialData?.companyName || null,
    siteId: initialData?.siteId || null,
    siteName: initialData?.siteName || null,
    projectId: initialData?.projectId || null,
    projectName: initialData?.projectName || null,
    teamId: initialData?.teamId || null,
    teamName: initialData?.teamName || null,
  });
  const [isAutoSelected, setIsAutoSelected] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [endDateOpen, setEndDateOpen] = useState(false);
  
  // Estados para criação inline
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [createSiteOpen, setCreateSiteOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isSiteImageEditorOpen, setIsSiteImageEditorOpen] = useState(false);
  const [isProjectImageEditorOpen, setIsProjectImageEditorOpen] = useState(false);
  
  // Estado do formulário completo de fábrica
  const initialCompanyFormData = {
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    photo_url: '',
    contract_number: '',
    client_notes: '',
    is_client_active: true,
    responsible_name: '',
    responsible_email: '',
    responsible_phone: '',
    responsible_role: ''
  };
  const [companyFormData, setCompanyFormData] = useState(initialCompanyFormData);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [deleteCompanyOpen, setDeleteCompanyOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<any>(null);
  const [companyDeleteInfo, setCompanyDeleteInfo] = useState({ sitesCount: 0, projectsCount: 0, reportsCount: 0, loading: false });
  const [contactsDialog, setContactsDialog] = useState<{ open: boolean; companyId: string; companyName: string }>({ open: false, companyId: '', companyName: '' });
  
  // Estado do formulário completo de unidade
  const initialSiteFormData = {
    name: '',
    address: '',
    city: '',
    state: '',
    photo_url: ''
  };
  const [siteFormData, setSiteFormData] = useState(initialSiteFormData);
  const sitePhotoUrlRef = useRef('');
  const [editingSite, setEditingSite] = useState<any>(null);
  const [deleteSiteOpen, setDeleteSiteOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<any>(null);
  
  // Estado do formulário completo de atividade
  const initialProjectFormData = {
    name: '',
    code: '',
    status: '',
    description: '',
    photo_url: '',
    client_responsible_name: '',
    supervisor_names: [] as string[],
    contract_number: '',
    progress_target: 100,
    start_date: null as string | null,
    end_date: null as string | null,
    selected_members: [] as string[],
    milestones: [] as MilestoneItem[],
    // Campos de programação de efetivo
    default_planned_workforce: 0,
    workforce_mode: 'default' as 'default' | 'daily',
    daily_workforce: [] as DailyWorkforce[],
    // Etapas ponderadas para cálculo de progresso
    weighted_stages: [] as ProjectStage[],
  };
  const [projectFormData, setProjectFormData] = useState(initialProjectFormData);
  const projectPhotoUrlRef = useRef('');
  const [editingProject, setEditingProject] = useState<any>(null);
  
  // Estado para colaboradores (responsáveis/supervisores)
  const [clientContacts, setClientContacts] = useState<{id: string, name: string, role: string | null, email: string}[]>([]);
  const [eligibleSupervisors, setEligibleSupervisors] = useState<{id: string, name: string, job_title: string | null}[]>([]);
  const [clientResponsibleOpen, setClientResponsibleOpen] = useState(false);
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  
  // Estado para seleção de membros da equipe
  const [allProfiles, setAllProfiles] = useState<{id: string, name: string, job_title: string | null}[]>([]);
  const [membersPopoverOpen, setMembersPopoverOpen] = useState(false);
  
  // Estado para confirmação de exclusão inline
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Estados para pastas de atividades (Step 3)
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const isAdmin = role === 'admin' || role === 'super_admin';

  // Check if user belongs to a team - auto-select everything
  const { data: userTeamData, isLoading: isLoadingUserTeam } = useQuery({
    queryKey: ['user-team-hierarchy', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select(`
          team_id,
          team:teams(
            id, name, project_id,
            project:projects(
              id, name, site_id,
              site:sites(
                id, name, city, state, photo_url, company_id,
                company:companies(id, name, logo_url, photo_url)
              )
            )
          )
        `)
        .eq('user_id', user?.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Collaborator team data for filtering
  const collaboratorCompany = userTeamData?.team?.project?.site?.company as { id: string; name: string; logo_url?: string; photo_url?: string } | undefined;
  const collaboratorSite = userTeamData?.team?.project?.site as { id: string; name: string; city?: string; state?: string; photo_url?: string } | undefined;
  const collaboratorProject = userTeamData?.team?.project as { id: string; name: string; code?: string; progress?: number } | undefined;

  // Fetch companies (admin: only authorized ones via portal_admin_access)
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies-selector', isAdmin, role, collaboratorCompany?.id, user?.id],
    queryFn: async () => {
      if (!isAdmin && collaboratorCompany) {
        return [{ 
          id: collaboratorCompany.id, 
          name: collaboratorCompany.name, 
          logo_url: collaboratorCompany.logo_url || null, 
          photo_url: collaboratorCompany.photo_url || null 
        }];
      }
      // Admin (not super_admin): filter to authorized companies only
      if (role === 'admin' && user?.id) {
        const { data: accessData } = await supabase
          .from('portal_admin_access')
          .select('site_id, sites(company_id)')
          .eq('user_id', user.id);
        const companyIds = [...new Set((accessData || []).map((d: any) => d.sites?.company_id).filter(Boolean))];
        if (companyIds.length === 0) return [];
        const { data } = await supabase
          .from('companies')
          .select('id, name, logo_url, photo_url')
          .in('id', companyIds)
          .order('name');
        return data || [];
      }
      const { data } = await supabase
        .from('companies')
        .select('id, name, logo_url, photo_url')
        .order('name');
      return data || [];
    },
    enabled: isAdmin || !!collaboratorCompany,
  });

  // Fetch sites based on selected company
  const { data: sites = [], isLoading: isLoadingSites } = useQuery({
    queryKey: ['sites-selector', selection.companyId, isAdmin, collaboratorSite?.id],
    queryFn: async () => {
      if (!isAdmin && collaboratorSite) {
        return [{ 
          id: collaboratorSite.id, 
          name: collaboratorSite.name, 
          city: collaboratorSite.city || null, 
          state: collaboratorSite.state || null,
          photo_url: collaboratorSite.photo_url || null,
          company: collaboratorCompany ? { 
            photo_url: collaboratorCompany.photo_url || null, 
            logo_url: collaboratorCompany.logo_url || null 
          } : null
        }];
      }
      const { data } = await supabase
        .from('sites')
        .select('id, name, city, state, photo_url, company:companies(photo_url, logo_url)')
        .eq('company_id', selection.companyId!)
        .order('name');
      return data || [];
    },
    enabled: !!selection.companyId,
  });

  // Fetch projects based on selected site with calculated progress from reports
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects-selector', selection.siteId, isAdmin, collaboratorProject?.id],
    queryFn: async () => {
      if (!isAdmin && collaboratorProject) {
        // Calculate progress for collaborator project
        const { data: reports } = await supabase
          .from('reports')
          .select('daily_progress')
          .eq('project_id', collaboratorProject.id)
          .not('daily_progress', 'is', null);
        
        const calculatedProgress = Math.min(
          (reports || []).reduce((sum, r) => sum + (Number(r.daily_progress) || 0), 0),
          100
        );
        
        return [{ 
          id: collaboratorProject.id, 
          name: collaboratorProject.name, 
          code: collaboratorProject.code || null, 
          status: 'in_progress' as const, 
          progress: calculatedProgress,
          photo_url: null,
          reportsCount: (reports || []).length,
          totalWorkforce: 0,
          lastReportDate: null as string | null,
          totalDelayMinutes: 0,
        }];
      }
      
      // Fetch all projects for the site
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, code, status, progress, photo_url, created_at')
        .eq('site_id', selection.siteId!)
        .order('name');
      
      if (!projectsData || projectsData.length === 0) return [];
      
      // Fetch all reports for these projects to calculate real progress + metrics
      const projectIds = projectsData.map(p => p.id);
      const { data: reportsData } = await supabase
        .from('reports')
        .select('id, project_id, daily_progress, actual_workforce, date, operational_deviation_hours, climatic_deviation_hours, amt_deviation_hours')
        .in('project_id', projectIds);

      // Fetch attendance for unique workforce count
      const reportIds = (reportsData || []).filter(r => r.id).map(r => r.id);
      const { data: attendanceData } = reportIds.length > 0
        ? await supabase
            .from('report_attendance')
            .select('user_id, user_name, present, report_id')
            .in('report_id', reportIds)
            .eq('present', true)
        : { data: [] };
      
      // Calculate metrics for each project
      return projectsData.map(p => {
        const projectReports = (reportsData || []).filter(r => r.project_id === p.id);
        const calculatedProgress = Math.min(
          projectReports.reduce((sum, r) => sum + (Number(r.daily_progress) || 0), 0),
          100
        );
        const sortedReports = [...projectReports].sort((a, b) => 
          (b.date || '').localeCompare(a.date || '')
        );
        const projectReportIds = projectReports.map(r => r.id);
        const projectAttendance = (attendanceData || []).filter(a => projectReportIds.includes(a.report_id));
        const uniquePeople = new Set(projectAttendance.map(a => a.user_id || a.user_name));
        const totalDelayMinutes = projectReports.reduce((sum, r) => {
          return sum + 
            parseIntervalToMinutes(r.operational_deviation_hours as unknown as string | null) +
            parseIntervalToMinutes(r.climatic_deviation_hours as unknown as string | null) +
            parseIntervalToMinutes(r.amt_deviation_hours as unknown as string | null);
        }, 0);
        return {
          ...p,
          progress: Math.round(calculatedProgress * 10) / 10,
          reportsCount: projectReports.length,
          totalWorkforce: uniquePeople.size,
          lastReportDate: sortedReports[0]?.date || null,
          totalDelayMinutes,
        };
      });
    },
    enabled: !!selection.siteId,
  });

  // Fetch reports grouped by month for folder view (Step 3)
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { data: reportsForFolders = [], isLoading: isLoadingFolders } = useQuery({
    queryKey: ['reports-for-folders', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('id, project_id, date, daily_progress, actual_workforce')
          .in('project_id', projectIds);
        if (error) {
          console.error('Error fetching reports for folders:', error);
          return [];
        }
        return data || [];
      } catch (e) {
        console.error('Failed to fetch reports for folders:', e);
        return [];
      }
    },
    enabled: projectIds.length > 0,
  });

  // Build monthly folders
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Projects created in the current month (used to surface newly created activities)
  const projectIdsCreatedThisMonth = useMemo(() => {
    return new Set(
      projects
        .filter((p: any) => typeof p.created_at === 'string' && p.created_at.substring(0, 7) === currentMonthKey)
        .map(p => p.id)
    );
  }, [projects, currentMonthKey]);

  const monthlyFolders = useMemo(() => {
    const monthMap = new Map<string, { projectIds: Set<string>; reportCount: number }>();
    reportsForFolders.forEach(r => {
      const monthKey = r.date.substring(0, 7); // "YYYY-MM"
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { projectIds: new Set(), reportCount: 0 });
      const entry = monthMap.get(monthKey)!;
      entry.projectIds.add(r.project_id);
      entry.reportCount++;
    });

    // Garante que o mês atual sempre exista como pasta, incluindo atividades criadas neste mês
    if (!monthMap.has(currentMonthKey)) {
      monthMap.set(currentMonthKey, { projectIds: new Set(), reportCount: 0 });
    }
    const currentEntry = monthMap.get(currentMonthKey)!;
    projectIdsCreatedThisMonth.forEach(id => currentEntry.projectIds.add(id));
    
    const monthNames: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
    };
    
    return Array.from(monthMap.entries())
      .map(([key, { projectIds, reportCount }]) => {
        const [year, month] = key.split('-');
        const folderProjectIds = Array.from(projectIds);
        const folderProjects = projects.filter(p => folderProjectIds.includes(p.id));
        const avgProgress = folderProjects.length > 0
          ? Math.round(folderProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / folderProjects.length)
          : 0;
        return {
          key,
          label: monthNames[month] || month,
          year,
          shortLabel: monthNames[month]?.substring(0, 3) || month,
          projectIds: folderProjectIds,
          count: projectIds.size,
          reportCount,
          avgProgress,
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [reportsForFolders, projects, currentMonthKey, projectIdsCreatedThisMonth]);
  
  const projectsWithoutReports = useMemo(() => {
    const projectIdsWithReports = new Set(reportsForFolders.map(r => r.project_id));
    // Exclui projetos criados no mês atual (já aparecem na pasta do mês)
    return projects.filter(p => !projectIdsWithReports.has(p.id) && !projectIdsCreatedThisMonth.has(p.id));
  }, [projects, reportsForFolders, projectIdsCreatedThisMonth]);

  // Filter projects for search or folder
  const filteredProjects = useMemo(() => {
    const searchTerm = activitySearch.toLowerCase().trim();
    
    // When searching, filter directly
    if (searchTerm) {
      return projects.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        (p.code && p.code.toLowerCase().includes(searchTerm))
      );
    }
    
    // When inside a folder
    if (selectedFolder === 'all') return projects;
    if (selectedFolder) {
      const folder = monthlyFolders.find(f => f.key === selectedFolder);
      if (folder) return projects.filter(p => folder.projectIds.includes(p.id));
    }
    
    return projects;
  }, [projects, activitySearch, selectedFolder, monthlyFolders]);

  // When inside a monthly folder, recalculate metrics using only that month's reports
  const monthScopedProjects = useMemo(() => {
    if (!selectedFolder || selectedFolder === 'all') return filteredProjects;
    
    const monthReports = reportsForFolders.filter(r => r.date.substring(0, 7) === selectedFolder);
    
    return filteredProjects.map(p => {
      const projReports = monthReports.filter(r => r.project_id === p.id);
      const rdoCount = projReports.length;
      const totalWorkforce = projReports.reduce((sum, r) => sum + (Number(r.actual_workforce) || 0), 0);
      const lastReport = projReports.sort((a, b) => b.date.localeCompare(a.date))[0];
      const monthProgress = Math.min(
        Math.round(projReports.reduce((sum, r) => sum + (Number(r.daily_progress) || 0), 0) * 10) / 10,
        100
      );
      return {
        ...p,
        reportsCount: rdoCount,
        totalWorkforce,
        lastReportDate: lastReport?.date || null,
        progress: monthProgress,
      };
    });
  }, [selectedFolder, filteredProjects, reportsForFolders]);

  const { data: projectReports = [] } = useQuery({
    queryKey: ['project-reports-calendar', selection.projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('reports')
        .select('id, date, shift, status')
        .eq('project_id', selection.projectId!)
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: !!selection.projectId,
  });

  // Fetch team for the selected project
  const { data: projectTeam } = useQuery({
    queryKey: ['project-team', selection.projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .eq('project_id', selection.projectId!)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selection.projectId,
  });

  // Auto-select from user's team data (for collaborators)
  useEffect(() => {
    if (userTeamData?.team && !isAutoSelected) {
      const team = userTeamData.team as any;
      const project = team.project;
      const site = project?.site;
      const company = site?.company;

      if (company && site && project && team) {
        setSelection({
          companyId: company.id,
          companyName: company.name,
          siteId: site.id,
          siteName: site.name,
          projectId: project.id,
          projectName: project.name,
          teamId: team.id,
          teamName: team.name,
        });
        setCurrentStep(4); // Go directly to calendar
        setIsAutoSelected(true);
      }
    }
  }, [userTeamData, isAutoSelected]);

  // Restore state when returning from report form
  useEffect(() => {
    if (returnState?.returnToStep && returnState.projectId) {
      setSelection({
        companyId: returnState.companyId || null,
        companyName: returnState.companyName || null,
        siteId: returnState.siteId || null,
        siteName: returnState.siteName || null,
        projectId: returnState.projectId || null,
        projectName: returnState.projectName || null,
        teamId: null,
        teamName: null,
      });
      setCurrentStep(returnState.returnToStep);
      setIsAutoSelected(true);
      // Clear navigation state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [returnState]);

  // Determine initial step based on initialData
  useEffect(() => {
    if (initialData?.projectId && initialData?.siteId && initialData?.companyId) {
      setCurrentStep(4);
    } else if (initialData?.siteId && initialData?.companyId) {
      setCurrentStep(3);
    } else if (initialData?.companyId) {
      setCurrentStep(2);
    }
  }, [initialData]);

  // Update team when project changes
  useEffect(() => {
    if (projectTeam && selection.projectId) {
      setSelection(prev => ({
        ...prev,
        teamId: projectTeam.id,
        teamName: projectTeam.name,
      }));
    }
  }, [projectTeam, selection.projectId]);

  // Load client contacts and supervisors when project dialog opens
  useEffect(() => {
    if (createProjectOpen && selection.companyId) {
      setIsLoadingContacts(true);
      
      // Load client contacts for the selected company
      const loadClientContacts = async () => {
        const { data, error } = await supabase
          .from('company_contacts')
          .select('id, name, role, email')
          .eq('company_id', selection.companyId!)
          .eq('is_active', true)
          .order('name');
        
        if (error) {
          console.error('Error loading client contacts:', error);
          toast({ title: 'Erro ao carregar contatos', description: error.message, variant: 'destructive' });
        }
        return data || [];
      };

      // Load eligible supervisors using SECURITY DEFINER function (bypasses RLS)
      const loadEligibleSupervisors = async () => {
        const { data, error } = await supabase.rpc('get_eligible_supervisors');
        
        if (error) {
          console.error('Error loading supervisors:', error);
          toast({ title: 'Erro ao carregar supervisores', description: error.message, variant: 'destructive' });
          return [];
        }
        
        return (data || []).map((s: { id: string; name: string }) => ({ 
          id: s.id, 
          name: s.name, 
          job_title: null 
        }));
      };

      // Load all profiles for team member selection
      const loadAllProfiles = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, job_title')
          .order('name')
          .limit(500);
        
        if (error) {
          console.error('Error loading profiles:', error);
          return [];
        }
        return data || [];
      };

      Promise.all([loadClientContacts(), loadEligibleSupervisors(), loadAllProfiles()])
        .then(([contacts, supervisors, profiles]) => {
          setClientContacts(contacts);
          setEligibleSupervisors(supervisors);
          setAllProfiles(profiles);
        })
        .finally(() => setIsLoadingContacts(false));
    }
  }, [createProjectOpen, selection.companyId, toast]);

  // Handlers
  const handleCompanySelect = (company: typeof companies[0]) => {
    setSelection({
      companyId: company.id,
      companyName: company.name,
      siteId: null,
      siteName: null,
      projectId: null,
      projectName: null,
      teamId: null,
      teamName: null,
    });
    setCurrentStep(2);
    setIsAutoSelected(false);
  };

  const handleSiteSelect = (site: typeof sites[0]) => {
    setSelection(prev => ({
      ...prev,
      siteId: site.id,
      siteName: site.name,
      projectId: null,
      projectName: null,
      teamId: null,
      teamName: null,
    }));
    setCurrentStep(3);
  };

  const handleProjectSelect = (project: typeof projects[0]) => {
    setSelection(prev => ({
      ...prev,
      projectId: project.id,
      projectName: project.name,
      teamId: null,
      teamName: null,
    }));
    setCurrentStep(4);
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setSelection({
        companyId: null,
        companyName: null,
        siteId: null,
        siteName: null,
        projectId: null,
        projectName: null,
        teamId: null,
        teamName: null,
      });
      setCurrentStep(1);
    } else if (currentStep === 3) {
      // If inside a folder, go back to folder list first
      if (selectedFolder !== null) {
        setSelectedFolder(null);
        return;
      }
      setActivitySearch('');
      setSelectedFolder(null);
      setSelection(prev => ({
        ...prev,
        siteId: null,
        siteName: null,
        projectId: null,
        projectName: null,
        teamId: null,
        teamName: null,
      }));
      setCurrentStep(2);
    } else if (currentStep === 4) {
      setSelection(prev => ({
        ...prev,
        projectId: null,
        projectName: null,
        teamId: null,
        teamName: null,
      }));
      setActivitySearch('');
      setSelectedFolder(null);
      setCurrentStep(3);
    }
  };

  // Funções de criação/edição de Fábricas
  const handleOpenEditCompany = (company: any) => {
    setEditingCompany(company);
    setCompanyFormData({
      name: company.name || '',
      cnpj: company.cnpj || '',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip_code: company.zip_code || '',
      photo_url: company.photo_url || '',
      contract_number: company.contract_number || '',
      client_notes: company.client_notes || '',
      is_client_active: company.is_client_active ?? true,
      responsible_name: company.responsible_name || '',
      responsible_email: company.responsible_email || '',
      responsible_phone: company.responsible_phone || '',
      responsible_role: company.responsible_role || ''
    });
    setCreateCompanyOpen(true);
  };

  const handleOpenDeleteCompany = async (company: any) => {
    setCompanyToDelete(company);
    setCompanyDeleteInfo({ sitesCount: 0, projectsCount: 0, reportsCount: 0, loading: true });
    setDeleteCompanyOpen(true);

    try {
      const [sitesResult, projectsResult] = await Promise.all([
        supabase.from('sites').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('projects').select('id').eq('company_id', company.id)
      ]);

      let reportsCount = 0;
      if (projectsResult.data?.length) {
        const { count } = await supabase.from('reports')
          .select('*', { count: 'exact', head: true })
          .in('project_id', projectsResult.data.map(p => p.id));
        reportsCount = count || 0;
      }

      setCompanyDeleteInfo({
        sitesCount: sitesResult.count || 0,
        projectsCount: projectsResult.data?.length || 0,
        reportsCount,
        loading: false
      });
    } catch (error) {
      setCompanyDeleteInfo(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSaveCompany = async () => {
    if (!companyFormData.name.trim()) return;
    setIsCreating(true);
    try {
      const companyData = {
        name: companyFormData.name.trim(),
        cnpj: companyFormData.cnpj || null,
        phone: companyFormData.phone || null,
        email: companyFormData.email || null,
        address: companyFormData.address || null,
        city: companyFormData.city || null,
        state: companyFormData.state || null,
        zip_code: companyFormData.zip_code || null,
        photo_url: companyFormData.photo_url || null,
        contract_number: companyFormData.contract_number || null,
        client_notes: companyFormData.client_notes || null,
        is_client_active: companyFormData.is_client_active,
        responsible_name: companyFormData.responsible_name || null,
        responsible_email: companyFormData.responsible_email || null,
        responsible_phone: companyFormData.responsible_phone || null,
        responsible_role: companyFormData.responsible_role || null,
      };

      if (editingCompany) {
        // Modo edição
        const { error } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', editingCompany.id);
        if (error) throw error;
        toast({ title: 'Fábrica atualizada com sucesso!' });
      } else {
        // Modo criação
        const { data, error } = await supabase
          .from('companies')
          .insert(companyData)
          .select()
          .single();
        if (error) throw error;
        handleCompanySelect({ ...data, logo_url: null, photo_url: data.photo_url });
        toast({ title: 'Fábrica criada com sucesso!' });
      }

      await queryClient.invalidateQueries({ queryKey: ['companies-selector'] });
      setCreateCompanyOpen(false);
      setCompanyFormData(initialCompanyFormData);
      setEditingCompany(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    if (companyDeleteInfo.sitesCount > 0 || companyDeleteInfo.projectsCount > 0) {
      toast({ title: 'Não é possível excluir', description: 'Exclua primeiro as unidades e atividades associadas.', variant: 'destructive' });
      setDeleteCompanyOpen(false);
      return;
    }
    setIsCreating(true);
    try {
      const { error } = await supabase.from('companies').delete().eq('id', companyToDelete.id);
      if (error) throw error;
      toast({ title: 'Fábrica removida com sucesso!' });
      await queryClient.invalidateQueries({ queryKey: ['companies-selector'] });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
      setDeleteCompanyOpen(false);
      setCompanyToDelete(null);
    }
  };

  const handleSaveSite = async () => {
    if (isSiteImageEditorOpen) {
      toast({ title: 'Finalize a imagem', description: 'Clique em "Aplicar" no editor de imagem antes de salvar.', variant: 'destructive' });
      return;
    }
    if (!siteFormData.name.trim() || !selection.companyId) return;
    const photoUrl = siteFormData.photo_url || sitePhotoUrlRef.current || null;
    console.log('[ProjectSelector] handleSaveSite photo_url:', photoUrl, 'formData:', siteFormData.photo_url, 'ref:', sitePhotoUrlRef.current);
    setIsCreating(true);
    try {
      if (editingSite) {
        // Modo edição
        const { error } = await supabase
          .from('sites')
          .update({
            name: siteFormData.name.trim(),
            address: siteFormData.address || null,
            city: siteFormData.city || null,
            state: siteFormData.state || null,
            photo_url: photoUrl,
          })
          .eq('id', editingSite.id);
        if (error) throw error;
        toast({ title: 'Unidade atualizada com sucesso!' });
      } else {
        // Modo criação
        const { data, error } = await supabase
          .from('sites')
          .insert({ 
            name: siteFormData.name.trim(), 
            company_id: selection.companyId,
            address: siteFormData.address || null,
            city: siteFormData.city || null,
            state: siteFormData.state || null,
            photo_url: photoUrl,
          })
          .select()
          .single();
        if (error) throw error;
        handleSiteSelect({ ...data, company: null });
        toast({ title: 'Unidade criada com sucesso!' });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['sites-selector'] });
      setCreateSiteOpen(false);
      setSiteFormData(initialSiteFormData);
      sitePhotoUrlRef.current = '';
      setEditingSite(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!siteToDelete) return;
    setIsCreating(true);
    try {
      const { error } = await supabase.from('sites').delete().eq('id', siteToDelete.id);
      if (error) throw error;
      toast({ title: 'Unidade removida com sucesso!' });
      await queryClient.invalidateQueries({ queryKey: ['sites-selector'] });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
      setDeleteSiteOpen(false);
      setSiteToDelete(null);
    }
  };

  const handleSaveProject = async () => {
    if (isProjectImageEditorOpen) {
      toast({ title: 'Finalize a imagem', description: 'Clique em "Aplicar" no editor de imagem antes de salvar.', variant: 'destructive' });
      return;
    }
    if (!projectFormData.name.trim() || !selection.siteId || !selection.companyId) return;

    // Duplicate check: verify if activity with same name already exists in this site
    if (!editingProject) {
      const normalizedName = projectFormData.name.trim().toLowerCase();
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('site_id', selection.siteId)
        .ilike('name', normalizedName);

      if (existingProjects && existingProjects.length > 0) {
        const existing = existingProjects[0];
        toast({
          title: 'Atividade já existe',
          description: `"${existing.name}" já está cadastrada nesta unidade. Selecione-a na lista.`,
          variant: 'destructive',
        });
        // Auto-select the existing one and advance
        setSelectedFolder('all');
        setActivitySearch(existing.name);
        return;
      }
    }

    const photoUrl = projectFormData.photo_url || projectPhotoUrlRef.current || null;
    console.log('[ProjectSelector] handleSaveProject photo_url:', photoUrl, 'formData:', projectFormData.photo_url, 'ref:', projectPhotoUrlRef.current);
    setIsCreating(true);
    try {
      const projectData = {
        name: projectFormData.name.trim(),
        code: projectFormData.code || null,
        status: projectFormData.status,
        description: projectFormData.description || null,
        photo_url: photoUrl,
        client_responsible_name: projectFormData.client_responsible_name || null,
        supervisor_name: projectFormData.supervisor_names.length > 0 
          ? projectFormData.supervisor_names.join(', ') 
          : null,
        contract_number: projectFormData.contract_number || null,
        progress_target: projectFormData.progress_target || null,
        start_date: projectFormData.start_date || null,
        end_date: projectFormData.end_date || null,
        default_planned_workforce: projectFormData.default_planned_workforce || 0,
      };

      let projectId: string;

      if (editingProject) {
        // Modo edição
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editingProject.id);
        if (error) throw error;
        projectId = editingProject.id;
        toast({ title: 'Atividade atualizada com sucesso!' });
      } else {
        // Modo criação
        const { data, error } = await supabase
          .from('projects')
          .insert({ 
            ...projectData,
            site_id: selection.siteId,
            company_id: selection.companyId,
          })
          .select()
          .single();
        if (error) throw error;
        projectId = data.id;
        // Auto-select the newly created activity and advance to step 4
        handleProjectSelect({ ...data, progress: 0, reportsCount: 0, totalWorkforce: 0, lastReportDate: null, totalDelayMinutes: 0 });
        toast({ title: 'Atividade criada com sucesso!' });
      }
      
      // Gerenciar membros da equipe (project_members)
      await supabase.from('project_members').delete().eq('project_id', projectId);
      if (projectFormData.selected_members.length > 0) {
        const membersToInsert = projectFormData.selected_members.map(profileId => ({
          project_id: projectId,
          profile_id: profileId,
        }));
        await supabase.from('project_members').insert(membersToInsert);
      }
      
      // Gerenciar marcos de avanço (project_milestones)
      await supabase.from('project_milestones').delete().eq('project_id', projectId);
      if (projectFormData.milestones.length > 0) {
        const milestonesToInsert = projectFormData.milestones.map(m => ({
          project_id: projectId,
          target_date: m.target_date,
          target_percentage: m.target_percentage,
          description: m.description || null,
          is_start_date: m.is_start_date || false,
        }));
        await supabase.from('project_milestones').insert(milestonesToInsert);
      }
      
      // Gerenciar programação de efetivo diário (project_daily_workforce)
      await supabase.from('project_daily_workforce').delete().eq('project_id', projectId);
      if (projectFormData.workforce_mode === 'daily' && projectFormData.daily_workforce.length > 0) {
        const workforceToInsert = projectFormData.daily_workforce
          .filter(dw => dw.planned_count > 0)
          .map(dw => ({
            project_id: projectId,
            date: dw.date,
            planned_count: dw.planned_count,
          }));
        if (workforceToInsert.length > 0) {
          await supabase.from('project_daily_workforce').insert(workforceToInsert);
        }
      }
      
      // Gerenciar etapas ponderadas (project_stages com weight)
      await supabase.from('project_stages').delete().eq('project_id', projectId);
      if (projectFormData.weighted_stages.length > 0) {
        const stagesToInsert = projectFormData.weighted_stages.map((s, idx) => ({
          project_id: projectId,
          name: s.name,
          weight: s.weight,
          order_index: idx,
          status: 'planned' as const,
          total_quantity: s.total_quantity || null,
          unit: s.unit || null,
        }));
        await supabase.from('project_stages').insert(stagesToInsert);
      }
      
      await queryClient.invalidateQueries({ queryKey: ['projects-selector'] });
      await queryClient.invalidateQueries({ queryKey: ['reports-for-folders'] });
      await queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project-daily-workforce', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['document-cabinet-projects'] });
      await queryClient.invalidateQueries({ queryKey: ['reports-cabinet-all-v2'] });
      setCreateProjectOpen(false);
      setProjectFormData(initialProjectFormData);
      projectPhotoUrlRef.current = '';
      setEditingProject(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOffset = useMemo(() => {
    return getDay(startOfMonth(currentMonth));
  }, [currentMonth]);

  const getReportsForDate = (date: Date) => {
    return projectReports.filter(r => isSameDay(parseISO(r.date), date));
  };

  const getDateStatusColor = (date: Date) => {
    const reports = getReportsForDate(date);
    if (reports.length === 0) return null;
    
    const hasCompleted = reports.some(r => r.status === 'completed');
    const hasDraft = reports.some(r => r.status === 'draft');
    
    if (hasCompleted) return 'bg-green-500';
    if (hasDraft) return 'bg-amber-500';
    return 'bg-primary';
  };

  const handleDateClick = (date: Date) => {
    if (!selection.projectId) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingReport = projectReports.find(r => r.date === dateStr);
    
    if (existingReport) {
      navigate(`/reports/${existingReport.id}`);
    } else {
      const params = new URLSearchParams();
      params.set('date', dateStr);
      if (selection.teamId) params.set('teamId', selection.teamId);
      navigate(`/reports/create/${selection.projectId}?${params.toString()}`, { replace: true });
    }
  };

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (selection.companyName) parts.push(selection.companyName);
    if (selection.siteName) parts.push(selection.siteName);
    if (selection.projectName) parts.push(selection.projectName);
    return parts.join(' › ');
  }, [selection]);

  const stepTitles: Record<number, string> = {
    1: "Selecione a Fábrica",
    2: "Selecione a Unidade",
    3: "Selecione a Atividade",
    4: "Selecione a Data",
  };

  if (isLoadingUserTeam) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // If user is not admin and has no team assigned
  if (!isAdmin && !userTeamData?.team) {
    return (
      <EmptyState
        icon={Users}
        title="Você não está em nenhuma equipe"
        description="Para criar relatórios, um administrador precisa adicionar você a uma equipe de trabalho associada a uma atividade."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header */}
      <div className="space-y-3">
        {/* Back Button */}
        <div className="flex items-center gap-2">
          {currentStep === 1 ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/reports')}
              className="h-8 px-2 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Relatórios
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              className="h-8 px-2 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
        </div>

        {/* Title and Step Badge */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl xs:text-2xl font-bold">{stepTitles[currentStep]}</h1>
            <Badge variant="outline" className="text-xs shrink-0">
              Passo {currentStep} de 4
            </Badge>
          </div>

          {/* Ações rápidas do Passo 3 */}
          {currentStep === 3 && isAdmin && projects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateProjectOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Atividade
              </Button>
            </div>
          )}
        </div>



        {/* Breadcrumb */}
        {breadcrumb && currentStep > 1 && (
          <p className="text-sm text-muted-foreground truncate">{breadcrumb}</p>
        )}
      </div>

      {/* Step 1: Companies Grid */}
      {currentStep === 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in pb-24 lg:pb-8">
          {isLoadingCompanies ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))
          ) : companies.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={Building2}
                title="Nenhuma fábrica encontrada"
                description="Cadastre uma fábrica para começar."
              />
            </div>
          ) : (
            <>
              {companies.map((company) => (
                <SelectableCard
                  key={company.id}
                  label={company.name}
                  logoUrl={company.logo_url}
                  imageUrl={company.photo_url}
                  icon={Building2}
                  onClick={() => handleCompanySelect(company)}
                  badge="Fábrica"
                  showActions={isAdmin}
                  onEdit={() => handleOpenEditCompany(company)}
                  onDelete={() => handleOpenDeleteCompany(company)}
                  onContacts={() => setContactsDialog({ open: true, companyId: company.id, companyName: company.name })}
                />
              ))}
              {isAdmin && (
                <CreateCard
                  label="Nova Fábrica"
                  onClick={() => {
                    setEditingCompany(null);
                    setCompanyFormData(initialCompanyFormData);
                    setCreateCompanyOpen(true);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Sites Grid */}
      {currentStep === 2 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in pb-24 lg:pb-8">
          {isLoadingSites ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))
          ) : sites.length === 0 ? (
            <div className="col-span-full">
              {isAdmin && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma unidade encontrada</p>
                  <p className="text-sm mt-1">Crie uma unidade para esta fábrica</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setCreateSiteOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Unidade
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {sites.map((site) => (
                <SelectableCard
                  key={site.id}
                  label={site.name}
                  sublabel={[site.city, site.state].filter(Boolean).join(' - ') || undefined}
                  imageUrl={site.photo_url || (site.company as any)?.logo_url}
                  icon={MapPin}
                  onClick={() => handleSiteSelect(site)}
                  badge="Unidade"
                  showActions={isAdmin}
                  onEdit={() => {
                    setEditingSite(site);
                    setSiteFormData({
                      name: site.name,
                      address: (site as any).address || '',
                      city: site.city || '',
                      state: site.state || '',
                      photo_url: site.photo_url || ''
                    });
                    setCreateSiteOpen(true);
                  }}
                  onDelete={() => {
                    setSiteToDelete(site);
                    setDeleteSiteOpen(true);
                  }}
                />
              ))}
              {isAdmin && (
                <CreateCard
                  label="Nova Unidade"
                  onClick={() => {
                    setEditingSite(null);
                    setSiteFormData(initialSiteFormData);
                    sitePhotoUrlRef.current = '';
                    setCreateSiteOpen(true);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Activities with Folder Navigation */}
      {currentStep === 3 && (
        <div className="animate-fade-in space-y-4 pb-24 lg:pb-8">
          {isLoadingProjects ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HardHat className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma atividade encontrada</p>
              <p className="text-sm mt-1">Crie uma atividade para esta unidade</p>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setCreateProjectOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Atividade
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou OM..."
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    if (e.target.value.trim()) setSelectedFolder(null);
                  }}
                  className="pl-10"
                />
              </div>

              {/* Folder view: when no search active and no folder selected */}
              {!activitySearch.trim() && selectedFolder === null && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {/* "Todas as Atividades" folder */}
                  <button
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-5 text-center cursor-pointer hover:bg-muted/50 hover:border-muted-foreground/40 hover:scale-[1.02] transition-all"
                    onClick={() => setSelectedFolder('all')}
                  >
                    <div className="p-3 rounded-full bg-foreground/10">
                      <Layers className="h-10 w-10 text-foreground/50" />
                    </div>
                    <span className="text-base font-bold text-foreground mt-3">Todas as Atividades</span>
                    <span className="text-xs text-muted-foreground mt-1">{filteredProjects.length} atividades</span>
                  </button>

                  {/* "Criar Atividade" card */}
                  {isAdmin && (
                    <button
                      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center cursor-pointer hover:bg-primary/10 hover:border-primary/50 hover:scale-[1.02] transition-all"
                      onClick={() => setCreateProjectOpen(true)}
                    >
                      <div className="p-3 rounded-full bg-primary/15">
                        <Plus className="h-10 w-10 text-primary" />
                      </div>
                      <span className="text-base font-bold text-foreground mt-3">Criar Atividade</span>
                      <span className="text-xs text-muted-foreground mt-1">Nova atividade</span>
                    </button>
                  )}

                  {/* Monthly folders grouped by year */}
                  {(() => {
                    const foldersByYear = monthlyFolders.reduce((acc, f) => {
                      if (!acc[f.year]) acc[f.year] = [];
                      acc[f.year].push(f);
                      return acc;
                    }, {} as Record<string, typeof monthlyFolders>);
                    const sortedYears = Object.keys(foldersByYear).sort((a, b) => b.localeCompare(a));
                    return sortedYears.map(year => (
                      <React.Fragment key={year}>
                        <div className="col-span-full flex items-center gap-2 mt-2">
                          <span className="text-sm font-semibold text-muted-foreground">{year}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        {foldersByYear[year].map((folder) => (
                          <button
                            key={folder.key}
                            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-5 text-center cursor-pointer hover:bg-muted/50 hover:border-muted-foreground/40 hover:scale-[1.02] transition-all"
                            onClick={() => setSelectedFolder(folder.key)}
                          >
                            <div className="p-3 rounded-full bg-foreground/10">
                              <FolderKanban className="h-10 w-10 text-foreground/50" />
                            </div>
                            <span className="text-base font-bold text-foreground mt-3">{folder.label}</span>
                            <span className="text-xs text-muted-foreground mt-1">{folder.reportCount} relatórios</span>
                          </button>
                        ))}
                      </React.Fragment>
                    ));
                  })()}

                  {/* Projects without any reports */}
                  {projectsWithoutReports.length > 0 && (
                    <>
                      <div className="col-span-full flex items-center gap-2 mt-2">
                        <span className="text-sm font-semibold text-muted-foreground">Atividades sem RDO</span>
                        <div className="flex-1 h-px bg-border" />
                        <Badge variant="outline" className="text-[10px]">{projectsWithoutReports.length}</Badge>
                      </div>
                      {projectsWithoutReports.map((project) => (
                        <button
                          key={project.id}
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 p-5 text-center cursor-pointer hover:bg-amber-500/10 hover:border-amber-500/50 hover:scale-[1.02] transition-all"
                          onClick={() => handleProjectSelect(project)}
                        >
                          <div className="p-3 rounded-full bg-amber-500/10">
                            <HardHat className="h-8 w-8 text-amber-600/70" />
                          </div>
                          <span className="text-sm font-bold text-foreground mt-3 truncate max-w-full">{project.name}</span>
                          {project.code && (
                            <span className="text-xs font-mono text-muted-foreground mt-0.5">{project.code}</span>
                          )}
                          <span className="text-[10px] text-amber-600 mt-1">Nenhum RDO criado</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Inside a folder or searching: show activity cards */}
              {(activitySearch.trim() || selectedFolder !== null) && (
                <>
                  {selectedFolder !== null && !activitySearch.trim() && (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFolder(null)}
                        className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Voltar
                      </Button>
                      <span className="text-sm font-medium text-muted-foreground">
                        {selectedFolder === 'all'
                          ? 'Todas as Atividades'
                          : (() => { const f = monthlyFolders.find(f => f.key === selectedFolder); return f ? `${f.label} ${f.year}` : ''; })()}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {monthScopedProjects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhuma atividade encontrada</p>
                      </div>
                    ) : (
                      <>
                        {monthScopedProjects.map((project) => {
                          const proj = project as any;
                          const statusColors: Record<string, string> = {
                            planning: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                            in_progress: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                            completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                            suspended: 'bg-red-500/10 text-red-600 border-red-500/20',
                          };
                          const statusLabels: Record<string, string> = {
                            planning: 'Planejamento',
                            in_progress: 'Em Execução',
                            completed: 'Concluída',
                            suspended: 'Suspensa',
                          };
                          const status = proj.status || 'planning';
                          return (
                          <div
                            key={project.id}
                            className="group rounded-xl border bg-card p-3.5 hover:bg-muted/60 transition-colors cursor-pointer shadow-sm"
                            onClick={() => handleProjectSelect(project)}
                          >
                            {/* Header: icon + name + code + delay + admin edit + chevron */}
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
                              <div className="flex items-center gap-1.5 shrink-0">
                                {(proj.totalDelayMinutes || 0) > 0 && (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10">
                                    <Clock className="h-3 w-3 text-destructive" />
                                    <span className="text-[10px] font-medium text-destructive">
                                      {formatMinutesToHours(proj.totalDelayMinutes)}
                                    </span>
                                  </div>
                                )}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setEditingProject(project);
                                      const existingSupervisors = proj.supervisor_name 
                                        ? proj.supervisor_name.split(', ').map((s: string) => s.trim()).filter(Boolean)
                                        : [];
                                      const { data: existingMembers } = await supabase
                                        .from('project_members').select('profile_id').eq('project_id', project.id);
                                      const { data: existingMilestones } = await supabase
                                        .from('project_milestones').select('*').eq('project_id', project.id).order('target_date', { ascending: true });
                                      const { data: dailyWorkforceData } = await supabase
                                        .from('project_daily_workforce').select('date, planned_count').eq('project_id', project.id).order('date', { ascending: true });
                                      const { data: existingStages } = await supabase
                                        .from('project_stages').select('id, name, weight, order_index, total_quantity, unit').eq('project_id', project.id).order('order_index', { ascending: true });
                                      const hasDailyWorkforce = (dailyWorkforceData?.length ?? 0) > 0;
                                      setProjectFormData({
                                        name: project.name, code: project.code || '', status: project.status || 'planning',
                                        description: proj.description || '', photo_url: proj.photo_url || '',
                                        client_responsible_name: proj.client_responsible_name || '',
                                        supervisor_names: existingSupervisors, contract_number: proj.contract_number || '',
                                        progress_target: proj.progress_target || 100,
                                        start_date: proj.start_date || null, end_date: proj.end_date || null,
                                        selected_members: existingMembers?.map(m => m.profile_id) || [],
                                        milestones: (existingMilestones || []).map(m => ({
                                          id: m.id, target_date: m.target_date, target_percentage: Number(m.target_percentage),
                                          description: m.description || '', is_start_date: m.is_start_date || false,
                                        })),
                                        default_planned_workforce: proj.default_planned_workforce || 0,
                                        workforce_mode: hasDailyWorkforce ? 'daily' : 'default',
                                        daily_workforce: (dailyWorkforceData || []).map(d => ({ date: d.date, planned_count: d.planned_count })),
                                        weighted_stages: (existingStages || []).map(s => ({
                                          id: s.id, name: s.name, weight: Number(s.weight) || 1, order_index: s.order_index,
                                          total_quantity: s.total_quantity, unit: s.unit,
                                        })),
                                      });
                                      setCreateProjectOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>

                            {/* Metrics row */}
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2.5 mt-2">
                              <span>{proj.reportsCount || 0} RDOs</span>
                              <span>·</span>
                              <span>{proj.totalWorkforce || 0} Efetivo</span>
                              <span>·</span>
                              <span>
                                {proj.lastReportDate
                                  ? format(parseISO(proj.lastReportDate), 'dd/MM/yyyy', { locale: ptBR })
                                  : 'Sem RDOs'}
                              </span>
                            </div>

                            {/* Progress bar + status badge */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 flex items-center gap-2">
                                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-foreground rounded-full transition-all"
                                    style={{ width: `${project.progress || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-foreground w-8 text-right">{project.progress || 0}%</span>
                              </div>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
                                statusColors[status] || 'bg-muted text-muted-foreground'
                              )}>
                                {statusLabels[status] || status}
                              </span>
                            </div>
                          </div>
                          );
                        })}
                        {isAdmin && (
                          <button
                            className="w-full flex items-center gap-3 rounded-lg border border-dashed bg-card px-3 py-2.5 text-left cursor-pointer hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingProject(null);
                              setProjectFormData(initialProjectFormData);
                              projectPhotoUrlRef.current = '';
                              setCreateProjectOpen(true);
                            }}
                          >
                            <div className="p-1.5 rounded-md bg-foreground/10 shrink-0">
                              <Plus className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium">Nova Atividade</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4: Calendar */}
      {currentStep === 4 && (
        <div className="animate-fade-in space-y-4 pb-24 lg:pb-8">
          {/* Resumo da Seleção */}
          <Card className="p-3 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-12 bg-muted rounded flex items-center justify-center p-1 shrink-0">
                {(() => {
                  const company = companies?.find(c => c.id === selection.companyId);
                  const imageUrl = company?.logo_url || company?.photo_url;
                  return imageUrl ? (
                    <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  {selection.companyName} → {selection.siteName}
                </p>
                <p className="font-semibold truncate">{selection.projectName}</p>
              </div>
              {selection.teamName && (
                <div className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded shrink-0 max-w-[35%]">
                  <Users className="h-3 w-3 shrink-0" />
                  <span className="truncate">{selection.teamName}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Calendário */}
          <Card className="p-4 border-2">
            {/* Header do Calendário */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Grid do Calendário */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, i) => (
                <div 
                  key={i} 
                  className="text-center text-sm font-semibold text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Days */}
              {daysInMonth.map((date) => {
                const statusColor = getDateStatusColor(date);
                const reportsCount = getReportsForDate(date).length;
                const today = isToday(date);

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      "aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all",
                      "hover:bg-primary/10 hover:scale-105 active:scale-95",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                      today && "ring-2 ring-primary ring-offset-1"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium",
                      today && "text-primary font-bold"
                    )}>
                      {format(date, 'd')}
                    </span>
                    {statusColor && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full", statusColor)} />
                        {reportsCount > 1 && (
                          <span className="text-[10px] text-muted-foreground">+{reportsCount - 1}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t flex-wrap">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Concluído</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">Rascunho</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full border-2 border-dashed border-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Criar RDO</span>
              </div>
            </div>

            {/* Resumo */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {projectReports.length} RDO(s) nesta atividade
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Dialog Criar/Editar Fábrica - Formulário Completo */}
      <Dialog open={createCompanyOpen} onOpenChange={(open) => {
        setCreateCompanyOpen(open);
        if (!open) {
          setCompanyFormData(initialCompanyFormData);
          setEditingCompany(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{editingCompany ? 'Editar' : 'Nova'} Fábrica</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-140px)]">
            <div className="space-y-6 p-6 pt-4">
              {/* Foto da Fábrica */}
              <div className="space-y-2">
                <Label>Foto da Fábrica</Label>
                <ImageUploader
                  image={companyFormData.photo_url}
                  onImageChange={(img) => setCompanyFormData(prev => ({ ...prev, photo_url: img || '' }))}
                  label=""
                  bucketName="company-photos"
                  folder="companies"
                  previewSize="lg"
                />
              </div>

              <Separator />

              {/* Dados da Fábrica */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados da Fábrica</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-name">Nome *</Label>
                    <Input
                      id="company-name"
                      placeholder="Nome da fábrica"
                      value={companyFormData.name}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, name: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <ValidatedInput
                      id="company-cnpj"
                      label="CNPJ"
                      type="cnpj"
                      value={companyFormData.cnpj}
                      onChange={(value) => setCompanyFormData(prev => ({ ...prev, cnpj: value }))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-contract">Nº Contrato</Label>
                    <Input
                      id="company-contract"
                      placeholder="Número do contrato"
                      value={companyFormData.contract_number}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, contract_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone">Telefone</Label>
                    <PhoneInput
                      id="company-phone"
                      placeholder="(00) 00000-0000"
                      value={companyFormData.phone}
                      onChange={(value) => setCompanyFormData(prev => ({ ...prev, phone: value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-email">Email</Label>
                    <Input
                      id="company-email"
                      type="email"
                      placeholder="email@empresa.com"
                      value={companyFormData.email}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Endereço</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-address">Endereço</Label>
                    <Input
                      id="company-address"
                      placeholder="Rua, número, bairro"
                      value={companyFormData.address}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-city">Cidade</Label>
                    <Input
                      id="company-city"
                      placeholder="Cidade"
                      value={companyFormData.city}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-state">Estado</Label>
                      <Input
                        id="company-state"
                        placeholder="UF"
                        maxLength={2}
                        value={companyFormData.state}
                        onChange={(e) => setCompanyFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-zip">CEP</Label>
                      <Input
                        id="company-zip"
                        placeholder="00000-000"
                        value={companyFormData.zip_code}
                        onChange={(e) => setCompanyFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cliente Ativo */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div>
                  <Label htmlFor="company-active" className="font-medium">Cliente Ativo</Label>
                  <p className="text-sm text-muted-foreground">Habilitar acesso ao portal do cliente</p>
                </div>
                <Switch
                  id="company-active"
                  checked={companyFormData.is_client_active}
                  onCheckedChange={(checked) => setCompanyFormData(prev => ({ ...prev, is_client_active: checked }))}
                />
              </div>

              <Separator />

              {/* Responsável Principal */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Responsável Principal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="resp-name">Nome</Label>
                    <Input
                      id="resp-name"
                      placeholder="Nome do responsável"
                      value={companyFormData.responsible_name}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, responsible_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resp-role">Cargo</Label>
                    <Input
                      id="resp-role"
                      placeholder="Cargo"
                      value={companyFormData.responsible_role}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, responsible_role: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resp-email">Email</Label>
                    <Input
                      id="resp-email"
                      type="email"
                      placeholder="email@empresa.com"
                      value={companyFormData.responsible_email}
                      onChange={(e) => setCompanyFormData(prev => ({ ...prev, responsible_email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resp-phone">Telefone</Label>
                    <PhoneInput
                      id="resp-phone"
                      placeholder="(00) 00000-0000"
                      value={companyFormData.responsible_phone}
                      onChange={(value) => setCompanyFormData(prev => ({ ...prev, responsible_phone: value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="company-notes">Observações</Label>
                <Textarea
                  id="company-notes"
                  placeholder="Observações sobre o cliente..."
                  value={companyFormData.client_notes}
                  onChange={(e) => setCompanyFormData(prev => ({ ...prev, client_notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 pt-0 border-t mt-0">
            <Button variant="outline" onClick={() => setCreateCompanyOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCompany} disabled={isCreating || !companyFormData.name.trim()}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCompany ? 'Salvar' : 'Criar Fábrica'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Criar/Editar Unidade */}
      <Dialog open={createSiteOpen} onOpenChange={(open) => {
        setCreateSiteOpen(open);
        if (!open) {
          setEditingSite(null);
          setSiteFormData(initialSiteFormData);
          sitePhotoUrlRef.current = '';
          setIsSiteImageEditorOpen(false);
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{editingSite ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6">
              {/* Foto da Unidade */}
              <div className="flex justify-center">
                <ImageUploader
                  image={siteFormData.photo_url}
                  onImageChange={(url) => { sitePhotoUrlRef.current = url; setSiteFormData(prev => ({ ...prev, photo_url: url })); }}
                  bucketName="company-photos"
                  folder="sites"
                  label="Foto da Unidade"
                  previewSize="lg"
                  onUploadStart={() => setIsImageUploading(true)}
                  onUploadEnd={() => setIsImageUploading(false)}
                  onEditorOpen={() => setIsSiteImageEditorOpen(true)}
                  onEditorClose={() => setIsSiteImageEditorOpen(false)}
                />
              </div>

              <Separator />

              {/* Dados da Unidade */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="site-name">Nome *</Label>
                  <Input
                    id="site-name"
                    placeholder="Nome da unidade"
                    value={siteFormData.name}
                    onChange={(e) => setSiteFormData(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-address">Endereço</Label>
                  <Input
                    id="site-address"
                    placeholder="Rua, número, bairro"
                    value={siteFormData.address}
                    onChange={(e) => setSiteFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-city">Cidade</Label>
                    <Input
                      id="site-city"
                      placeholder="Cidade"
                      value={siteFormData.city}
                      onChange={(e) => setSiteFormData(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-state">Estado (UF)</Label>
                    <Input
                      id="site-state"
                      placeholder="UF"
                      maxLength={2}
                      value={siteFormData.state}
                      onChange={(e) => setSiteFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 pt-0 border-t mt-0">
            <Button variant="outline" onClick={() => setCreateSiteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSite} disabled={isCreating || isImageUploading || isSiteImageEditorOpen || !siteFormData.name.trim()}>
              {(isCreating || isImageUploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSiteImageEditorOpen ? 'Finalize a imagem...' : isImageUploading ? 'Enviando imagem...' : editingSite ? 'Salvar' : 'Criar Unidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog para Excluir Unidade */}
      <ConfirmDialog
        open={deleteSiteOpen}
        onOpenChange={setDeleteSiteOpen}
        title="Excluir Unidade"
        description={`Tem certeza que deseja excluir "${siteToDelete?.name}"? Esta ação não pode ser desfeita e removerá todas as atividades e relatórios associados.`}
        confirmText="Excluir"
        onConfirm={handleDeleteSite}
        variant="destructive"
        isLoading={isCreating}
      />

      {/* Dialog Criar/Editar Atividade */}
      <Dialog open={createProjectOpen} onOpenChange={(open) => {
        setCreateProjectOpen(open);
        if (!open) {
          setEditingProject(null);
          setProjectFormData(initialProjectFormData);
          projectPhotoUrlRef.current = '';
          setClientResponsibleOpen(false);
          setSupervisorOpen(false);
          setDeleteConfirmText('');
          setIsProjectImageEditorOpen(false);
        }
      }}>
        <DialogContent className="max-w-lg h-[90vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full min-h-0">
            <DialogHeader className="p-6 pb-4 flex-shrink-0 border-b">
              <DialogTitle>{editingProject ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 pr-4 space-y-6">
              {/* Foto da Atividade */}
              <div className="flex justify-center">
                <ImageUploader
                  image={projectFormData.photo_url}
                  onImageChange={(url) => { projectPhotoUrlRef.current = url; setProjectFormData(prev => ({ ...prev, photo_url: url })); }}
                  bucketName="project-photos"
                  label="Foto da Atividade"
                  previewSize="lg"
                  onUploadStart={() => setIsImageUploading(true)}
                  onUploadEnd={() => setIsImageUploading(false)}
                  onEditorOpen={() => setIsProjectImageEditorOpen(true)}
                  onEditorClose={() => setIsProjectImageEditorOpen(false)}
                />
              </div>

              <Separator />

              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="project-name">Descrição *</Label>
                <Input
                  id="project-name"
                  placeholder="Nome da atividade"
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, name: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Responsável Cliente e Supervisor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    <Users className="inline h-4 w-4 mr-1" />
                    Responsável Cliente
                  </Label>
                  <Input
                    placeholder="Nome do responsável cliente"
                    value={projectFormData.client_responsible_name}
                    onChange={(e) => setProjectFormData(prev => ({ 
                      ...prev, 
                      client_responsible_name: e.target.value 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    <Users className="inline h-4 w-4 mr-1" />
                    Supervisores
                  </Label>
                  <Popover open={supervisorOpen} onOpenChange={setSupervisorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={supervisorOpen}
                        className="w-full justify-between font-normal min-h-[40px] h-auto"
                        disabled={isLoadingContacts}
                      >
                        {isLoadingContacts ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando...
                          </span>
                        ) : projectFormData.supervisor_names.length === 0 ? (
                          "Selecionar..."
                        ) : (
                          <div className="flex flex-wrap gap-1 py-0.5">
                            {projectFormData.supervisor_names.map(name => (
                              <Badge 
                                key={name} 
                                variant="secondary" 
                                className="text-xs px-2 py-0 h-5 flex items-center gap-1"
                              >
                                {name}
                                <X 
                                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectFormData(prev => ({
                                      ...prev,
                                      supervisor_names: prev.supervisor_names.filter(n => n !== name)
                                    }));
                                  }}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 z-[100]" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar supervisor..." />
                        <CommandList>
                          <CommandEmpty>
                            {eligibleSupervisors.length === 0 
                              ? "Nenhum supervisor disponível" 
                              : "Nenhum encontrado"}
                          </CommandEmpty>
                          <CommandGroup>
                            {eligibleSupervisors.map(profile => {
                              const isSelected = projectFormData.supervisor_names.includes(profile.name);
                              return (
                                <CommandItem
                                  key={profile.id}
                                  value={profile.name}
                                  onSelect={() => {
                                    setProjectFormData(prev => ({
                                      ...prev,
                                      supervisor_names: isSelected
                                        ? prev.supervisor_names.filter(n => n !== profile.name)
                                        : [...prev.supervisor_names, profile.name]
                                    }));
                                  }}
                                >
                                  <Checkbox 
                                    checked={isSelected}
                                    className="mr-2"
                                  />
                                  <div className="flex flex-col">
                                    <span>{profile.name}</span>
                                    {profile.job_title && <span className="text-xs text-muted-foreground">{profile.job_title}</span>}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Número do Contrato */}
              <div className="space-y-2">
                <Label htmlFor="project-contract">Número do Contrato</Label>
                <Input
                  id="project-contract"
                  placeholder="Ex: CONT-2024-001"
                  value={projectFormData.contract_number}
                  onChange={(e) => setProjectFormData(prev => ({ ...prev, contract_number: e.target.value }))}
                />
              </div>

              <Separator />

              {/* Linha Base de Avanço (Marcos) */}
              <MilestonesEditor
                value={projectFormData.milestones}
                onChange={(milestones) => setProjectFormData(prev => ({ ...prev, milestones }))}
                disabled={isCreating}
              />

              <Separator />

              {/* Código e Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-code">Código</Label>
                  <Input
                    id="project-code"
                    placeholder="Ex: PROJ-001"
                    value={projectFormData.code}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-status">Status</Label>
                  <Input
                    id="project-status"
                    placeholder="Ex: Em andamento, Aguardando liberação..."
                    value={projectFormData.status}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, status: e.target.value }))}
                  />
                </div>
              </div>

              {/* Efetivo Programado (Seleção de Colaboradores) */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Efetivo Programado
                </Label>
                
                {/* Badges dos membros selecionados */}
                {projectFormData.selected_members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-muted/30">
                    {projectFormData.selected_members.map(memberId => {
                      const profile = allProfiles.find(p => p.id === memberId);
                      return (
                        <Badge key={memberId} variant="secondary" className="gap-1 pr-1">
                          {profile?.name || 'Desconhecido'}
                          <button 
                            type="button"
                            onClick={() => setProjectFormData(prev => ({
                              ...prev,
                              selected_members: prev.selected_members.filter(id => id !== memberId)
                            }))}
                            className="ml-1 rounded-full hover:bg-muted p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                
                {/* Seletor de membros */}
                <Popover open={membersPopoverOpen} onOpenChange={setMembersPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {projectFormData.selected_members.length === 0 
                        ? "Adicionar colaborador" 
                        : `${projectFormData.selected_members.length} colaborador(es) selecionado(s)`}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar colaborador..." />
                      <div className="flex gap-2 p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs h-7"
                          onClick={() => setProjectFormData(prev => ({
                            ...prev,
                            selected_members: allProfiles.map(p => p.id)
                          }))}
                        >
                          Selecionar todos
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs h-7"
                          onClick={() => setProjectFormData(prev => ({
                            ...prev,
                            selected_members: []
                          }))}
                        >
                          Limpar
                        </Button>
                      </div>
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {allProfiles.map(profile => {
                            const isSelected = projectFormData.selected_members.includes(profile.id);
                            return (
                              <CommandItem
                                key={profile.id}
                                value={profile.name}
                                onSelect={() => {
                                  setProjectFormData(prev => ({
                                    ...prev,
                                    selected_members: isSelected
                                      ? prev.selected_members.filter(id => id !== profile.id)
                                      : [...prev.selected_members, profile.id]
                                  }));
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{profile.name}</span>
                                  {profile.job_title && (
                                    <span className="text-xs text-muted-foreground">{profile.job_title}</span>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Separator />

              {/* Etapas Ponderadas para Cálculo de Progresso */}
              <ProjectStagesEditor
                stages={projectFormData.weighted_stages}
                onChange={(stages) => setProjectFormData(prev => ({ ...prev, weighted_stages: stages }))}
                disabled={isCreating}
              />

              <Separator />

              {/* Programação de Efetivo por Dia */}
              <WorkforcePlanningSection
                mode={projectFormData.workforce_mode}
                defaultCount={projectFormData.default_planned_workforce}
                dailyWorkforce={projectFormData.daily_workforce}
                startDate={projectFormData.start_date}
                endDate={projectFormData.end_date}
                onModeChange={(mode) => setProjectFormData(prev => ({ ...prev, workforce_mode: mode }))}
                onDefaultCountChange={(count) => setProjectFormData(prev => ({ ...prev, default_planned_workforce: count }))}
                onDailyWorkforceChange={(workforce) => setProjectFormData(prev => ({ ...prev, daily_workforce: workforce }))}
                disabled={isCreating}
              />

              {/* Zona de Perigo - Só mostra em modo edição */}
              {editingProject && (
                <>
                  <Separator className="my-6" />
                  <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-destructive font-semibold">
                      <Trash2 className="h-4 w-4" />
                      Zona de Perigo
                    </div>
                    <p className="text-sm text-muted-foreground">
                      A exclusão é permanente e removerá todos os RDOs associados a esta atividade.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Para confirmar, digite o código: <span className="font-mono font-bold">{editingProject.code || editingProject.name}</span>
                      </Label>
                      <Input
                        placeholder="Digite para confirmar..."
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="border-destructive/30 focus:border-destructive"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={deleteConfirmText !== (editingProject.code || editingProject.name) || isCreating}
                      onClick={async () => {
                        setIsCreating(true);
                        try {
                          const { error } = await supabase.from('projects').delete().eq('id', editingProject.id);
                          if (error) throw error;
                          toast({ title: 'Atividade removida com sucesso!' });
                          await queryClient.invalidateQueries({ queryKey: ['projects-selector'] });
                          setCreateProjectOpen(false);
                          setEditingProject(null);
                          setDeleteConfirmText('');
                        } catch (error: any) {
                          toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
                        } finally {
                          setIsCreating(false);
                        }
                      }}
                    >
                      {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Excluir Atividade
                    </Button>
                  </div>
                </>
              )}
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4 border-t flex-shrink-0">
              <Button variant="outline" onClick={() => setCreateProjectOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProject} disabled={isCreating || isImageUploading || isProjectImageEditorOpen || !projectFormData.name.trim()}>
                {(isCreating || isImageUploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isProjectImageEditorOpen ? 'Finalize a imagem...' : isImageUploading ? 'Enviando imagem...' : editingProject ? 'Salvar' : 'Criar Atividade'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>


      {/* Confirm Dialog para Excluir Fábrica */}
      <ConfirmDialog
        open={deleteCompanyOpen}
        onOpenChange={setDeleteCompanyOpen}
        title="Excluir Fábrica"
        description={
          companyDeleteInfo.loading
            ? "Verificando dados relacionados..."
            : (companyDeleteInfo.sitesCount > 0 || companyDeleteInfo.projectsCount > 0)
              ? `Esta fábrica possui ${companyDeleteInfo.sitesCount} unidade(s), ${companyDeleteInfo.projectsCount} atividade(s) e ${companyDeleteInfo.reportsCount} relatório(s). Exclua-os primeiro.`
              : `Tem certeza que deseja excluir "${companyToDelete?.name}"? Esta ação não pode ser desfeita.`
        }
        confirmText="Excluir"
        onConfirm={handleDeleteCompany}
        variant="destructive"
        isLoading={isCreating || companyDeleteInfo.loading}
      />

      {/* Dialog de Contatos da Fábrica */}
      <CompanyContactsDialog
        open={contactsDialog.open}
        onOpenChange={(open) => setContactsDialog(prev => ({ ...prev, open }))}
        companyId={contactsDialog.companyId}
        companyName={contactsDialog.companyName}
      />
    </div>
  );
}
