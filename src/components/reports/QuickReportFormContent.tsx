import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import { ParseReportModal } from '@/components/reports/ParseReportModal';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepProgressEditor } from './StepProgressEditor';
import { ActivityStep, calculateWeightedProgress } from '@/lib/progressCalculations';
import { 
  Sun, 
  Sunset, 
  Moon, 
  Clock, 
  MapPin, 
  Wrench, 
  Users, 
  AlertTriangle,
  Camera,
  MessageSquare,
  Check,
  X,
  ArrowLeft,
  Send,
  Save,
  CalendarIcon,
  Sparkles,
  Loader2,
  FileText,
  Radio,
  Lock,
  TrendingUp,
  ChevronsUpDown,
  UserPlus,
  Target,
  Scale,
  Sliders,
  Cloud,
  CloudDrizzle,
  CloudRain
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Slider } from '@/components/ui/slider';
import { AISummaryPreviewDialog } from './AISummaryPreviewDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDelayReasons, DelayCategory } from '@/hooks/useDelayReasons';
import { DelayControlSection } from './DelayControlSection';

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

interface QuickReportFormContentProps {
  selection: SelectionData;
  onBack: () => void;
  onSubmit: (data: ReportFormData, status: 'draft' | 'pending') => Promise<void>;
  isSubmitting: boolean;
  initialData?: ReportFormData;
  isEditMode?: boolean;
  tabId?: string;
  onFormDataChange?: (data: Partial<ReportFormData>) => void;
}

export interface ReportFormData {
  date: string;
  shift: 'morning' | 'afternoon' | 'night';
  startTime: string;
  endTime: string;
  location: string;
  dailyProgress: number;
  activities: { description: string; completed: boolean; progress: number }[];
  attendance: { userId: string | null; userName: string; present: boolean; arrivalTime?: string; departureTime?: string; functionRole?: string; isFromTeam?: boolean }[];
  plannedWorkforce?: number;
  realPercentage?: number;
  hasDeviations: boolean;
  deviations: { type: 'delay' | 'equipment' | 'safety' | 'other'; description: string; impact: 'low' | 'medium' | 'high' }[];
  photos: string[];
  comments: string;
  aiSummary: string;
  routine?: string;
  supervisorName?: string;
  technicalResponsibleName?: string;
  weather?: 'sol' | 'nublado' | 'chuva_leve' | 'chuva_intensa' | '';
  // Novos campos para parsing de WhatsApp
  radioFrequencyWees?: string;
  radioFrequencyOperation?: string;
  maintenanceOrderNumber?: string;
  maintenanceOrderTitle?: string;
  isEmergency?: boolean;
  arrivalTimeAtLiberator?: string;
  documentReleaseTime?: string;
  blockageStatus?: string;
  ambulancePoint?: string;
  meetingPoint?: string;
  blockRevalidationTime?: string;
  // Campos de horas de atraso
  operationalDeviationHours?: string;
  operationalDeviationReason?: string;
  operationalDeviationDetails?: string;
  climaticDeviationHours?: string;
  climaticDeviationReason?: string;
  climaticDeviationDetails?: string;
  amtDeviationHours?: string;
  amtDeviationReason?: string;
  amtDeviationDetails?: string;
  // Campo para indicar sem atividade
  noActivity?: boolean;
  // Campos para avanço por etapas ponderado
  useWeightedProgress?: boolean;
  activitySteps?: { 
    id: string; 
    description: string; 
    weight: number; 
    progress: number; 
    orderIndex: number;
    totalQuantity?: number | null;
    unit?: string | null;
    quantityDone?: number | null;
  }[];
  additionalDelays?: {
    _id?: string;
    _source?: 'manual' | 'rdo';
    activity_name: string;
    reason: string;
    description: string;
    hours: string;
  }[];
}

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Diurno', icon: Sun, time: '07:00 - 17:00', color: 'text-amber-500' },
  { value: 'night', label: 'Noturno', icon: Moon, time: '17:00 - 07:00', color: 'text-indigo-500' },
] as const;

const RECENT_LOCATIONS = [
  'Área de montagem',
  'Área de soldagem',
  'Área de pintura',
  'Escritório',
  'Almoxarifado',
];

export function QuickReportFormContent({ selection, onBack, onSubmit, isSubmitting, initialData, isEditMode, tabId, onFormDataChange }: QuickReportFormContentProps) {
  const { user } = useAuth();
  
  // Determine default shift based on current time
  const getDefaultShift = (): 'morning' | 'night' => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) return 'morning';
    return 'night';
  };

  const [formData, setFormData] = useState<ReportFormData>(initialData || {
    date: format(new Date(), 'yyyy-MM-dd'),
    shift: getDefaultShift(),
    startTime: '07:00',
    endTime: '17:00',
    location: localStorage.getItem('lastReportLocation') || '',
    dailyProgress: 0,
    activities: [{ description: '', completed: false, progress: 0 }],
    attendance: [],
    hasDeviations: false,
    deviations: [],
    photos: [],
    comments: '',
    aiSummary: '',
    routine: '',
    weather: '',
    operationalDeviationHours: '',
    operationalDeviationReason: '',
    operationalDeviationDetails: '',
    climaticDeviationHours: '',
    climaticDeviationReason: '',
    climaticDeviationDetails: '',
    amtDeviationHours: '',
    amtDeviationReason: '',
    amtDeviationDetails: '',
    useWeightedProgress: false,
    activitySteps: [],
    additionalDelays: [],
  });

  // Notify parent about form data changes (for tabs sync)
  useEffect(() => {
    if (onFormDataChange && tabId) {
      onFormDataChange(formData);
    }
  }, [formData, onFormDataChange, tabId]);

  // Buscar meta de avanço do projeto e efetivo programado padrão
  const { data: projectMeta } = useQuery({
    queryKey: ['project-meta', selection.projectId],
    queryFn: async () => {
      if (!selection.projectId) return null;
      const { data } = await supabase
        .from('projects')
        .select('id, progress_target, end_date, default_planned_workforce, company_id')
        .eq('id', selection.projectId)
        .maybeSingle();
      return data;
    },
    enabled: !!selection.projectId,
  });

  // Buscar efetivo programado para a data específica do RDO
  const { data: dailyWorkforce } = useQuery({
    queryKey: ['daily-workforce', selection.projectId, formData.date],
    queryFn: async () => {
      if (!selection.projectId || !formData.date) return null;
      const { data } = await supabase
        .from('project_daily_workforce')
        .select('planned_count')
        .eq('project_id', selection.projectId)
        .eq('date', formData.date)
        .maybeSingle();
      return data;
    },
    enabled: !!selection.projectId && !!formData.date,
  });

  // Buscar etapas ponderadas definidas na atividade
  const { data: projectStages = [] } = useQuery({
    queryKey: ['project-stages', selection.projectId],
    queryFn: async () => {
      if (!selection.projectId) return [];
      const { data } = await supabase
        .from('project_stages')
        .select('id, name, weight, order_index, total_quantity, unit')
        .eq('project_id', selection.projectId)
        .order('order_index', { ascending: true });
      return data || [];
    },
    enabled: !!selection.projectId,
  });

  // Flag para indicar se as etapas vêm do projeto
  const hasProjectStages = projectStages.length > 0;

  // Efetivo programado: prioriza o valor diário, senão usa o padrão do projeto
  const plannedWorkforceForDate = dailyWorkforce?.planned_count ?? projectMeta?.default_planned_workforce ?? 0;

  // Buscar progresso acumulado do projeto (soma dos RDOs anteriores)
  const { data: accumulatedProgress = 0 } = useQuery({
    queryKey: ['project-accumulated-progress', selection.projectId, formData.date, initialData?.dailyProgress],
    queryFn: async () => {
      if (!selection.projectId) return 0;
      
      // Buscar soma de daily_progress de todos os RDOs anteriores à data atual
      const { data: reports } = await supabase
        .from('reports')
        .select('daily_progress, date, id')
        .eq('project_id', selection.projectId)
        .lt('date', formData.date)
        .not('daily_progress', 'is', null);
      
      const total = reports?.reduce((sum, r) => sum + (Number(r.daily_progress) || 0), 0) || 0;
      
      return Math.min(total, 100);
    },
    enabled: !!selection.projectId,
  });

  // Calcular máximo permitido e novo total
  const maxDailyProgress = Math.max(0, 100 - accumulatedProgress);
  const newTotalProgress = Math.min(accumulatedProgress + formData.dailyProgress, 100);

  // AI Summary states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  
  // Estado para efetivo programado
  const [plannedWorkforce, setPlannedWorkforce] = useState<number>(
    initialData?.plannedWorkforce || 0
  );
  
  // Atualizar efetivo programado quando os dados do projeto/data mudam
  useEffect(() => {
    if (!initialData?.plannedWorkforce && plannedWorkforceForDate > 0) {
      setPlannedWorkforce(plannedWorkforceForDate);
    }
  }, [plannedWorkforceForDate, initialData]);

  // Collaborator selector states
  const [collaboratorPopoverOpen, setCollaboratorPopoverOpen] = useState(false);
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  
  // Calcular efetivo real baseado na attendance
  const actualWorkforce = formData.attendance.filter(a => a.present).length;
  // AI Summary generation function
  const generateSummary = async (): Promise<string | null> => {
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-report-summary', {
        body: {
          activities: formData.activities,
          deviations: formData.deviations,
          attendance: formData.attendance,
          date: format(parseISO(formData.date), 'dd/MM/yyyy'),
          shift: formData.shift,
          projectName: selection.projectName,
        },
      });

      if (error) {
        console.error('[QuickReportFormContent] Error:', error);
        toast.error('Erro ao gerar resumo');
        return null;
      }

      if (result?.summary) {
        return result.summary;
      } else if (result?.error) {
        toast.error(result.error);
        return null;
      }
      
      return null;
    } catch (err) {
      console.error('[QuickReportFormContent] Error:', err);
      toast.error('Erro ao conectar com a IA');
      return null;
    }
  };

  const handleGenerateSummary = async () => {
    if (!formData.maintenanceOrderTitle?.trim()) {
      toast.error('Preencha o Título da OM antes de gerar o resumo');
      return;
    }

    const validActivities = formData.activities.filter(a => a.description.trim() !== '');
    if (validActivities.length === 0) {
      toast.warning('Adicione pelo menos uma atividade antes de gerar o resumo');
      return;
    }

    setIsGeneratingSummary(true);
    const summary = await generateSummary();
    setIsGeneratingSummary(false);
    
    if (summary) {
      setGeneratedText(summary);
      setPreviewOpen(true);
    }
  };

  const handleRegenerate = async () => {
    setIsGeneratingSummary(true);
    const summary = await generateSummary();
    setIsGeneratingSummary(false);
    
    if (summary) {
      setGeneratedText(summary);
    }
  };

  const handleAcceptSummary = (text: string) => {
    setFormData(prev => ({ ...prev, aiSummary: text }));
    toast.success('Resumo aplicado com sucesso!');
  };

  // Fetch team members (includes role from user_roles)
  const { data: teamMembers, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['team-members-with-roles', selection.teamId],
    queryFn: async () => {
      if (!selection.teamId) return [];
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', selection.teamId);
      
      const userIds = members?.map(m => m.user_id) || [];
      if (userIds.length === 0) return [];
      
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('id, name, job_title').in('id', userIds),
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      ]);
      
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      return profiles?.map(p => ({
        id: p.id,
        user_id: p.id,
        user: { id: p.id, name: p.name },
        role: roleMap.get(p.id) || 'collaborator',
        jobTitle: p.job_title || '',
      })) || [];
    },
    enabled: !!selection.teamId,
  });

  // Fetch all profiles for collaborator selector
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles-quick'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, job_title')
        .order('name');
      return (data || []).map(p => ({ id: p.id, name: p.name, jobTitle: p.job_title || '' }));
    },
  });

  // Match profile by partial name (first name, contains, exact)
  const matchProfileByPartialName = (partialName: string, profiles: typeof allProfiles) => {
    const normalized = partialName.toLowerCase().trim();
    if (normalized.length < 3) return null;
    
    // 1. Exact match
    const exact = profiles.find(p => p.name?.toLowerCase().trim() === normalized);
    if (exact) return exact;
    
    // 2. First name match
    const byFirstName = profiles.find(p => {
      const firstName = p.name?.toLowerCase().trim().split(' ')[0];
      return firstName === normalized;
    });
    if (byFirstName) return byFirstName;
    
    // 3. Partial containment
    const contains = profiles.find(p => 
      p.name?.toLowerCase().trim().includes(normalized)
    );
    return contains || null;
  };

  // Role to function mapping
  const ROLE_TO_FUNCTION: Record<string, string> = {
    'super_admin': 'Supervisor',
    'admin': 'Supervisor',
    'collaborator': 'Convencional',
  };

  // Initialize attendance when team members load (only for new reports without initial data)
  useEffect(() => {
    if (teamMembers && formData.attendance.length === 0 && !initialData) {
      setFormData(prev => {
        const shiftTimes: Record<string, { start: string; end: string }> = {
          morning: { start: '07:00', end: '17:00' },
          afternoon: { start: '14:00', end: '22:00' },
          night: { start: '17:00', end: '07:00' },
        };
        const times = shiftTimes[prev.shift] || shiftTimes.morning;
        return {
          ...prev,
          attendance: teamMembers.map(member => ({
            userId: (member.user as any)?.id || null,
            userName: (member.user as any)?.name || 'Sem nome',
            present: true,
            arrivalTime: times.start,
            departureTime: times.end,
            functionRole: (member as any).jobTitle || ROLE_TO_FUNCTION[(member as any).role] || 'Convencional',
            isFromTeam: true,
          })),
        };
      });
    }
  }, [teamMembers, initialData]);

  // Reconciliar attendance com dados atuais do cadastro
  // Só roda na montagem inicial (quando não há initialData), para não sobrescrever edições do usuário
  useEffect(() => {
    if (!allProfiles || allProfiles.length === 0 || formData.attendance.length === 0) return;
    // Não reconciliar se já existe dados iniciais (modo edição ou duplicação)
    if (initialData) return;

    const profileMap = new Map(allProfiles.map(p => [p.id, p]));

    setFormData(prev => {
      let needsUpdate = false;
      const updated = prev.attendance.map(member => {
        if (!member.userId) return member;

        const profile = profileMap.get(member.userId);
        if (!profile) return member;

        const newName = (profile as any).name || member.userName;
        const newFunction = (profile as any).jobTitle || member.functionRole || 'Convencional';

        if (newName !== member.userName || newFunction !== member.functionRole) {
          needsUpdate = true;
          return { ...member, userName: newName, functionRole: newFunction };
        }
        return member;
      });

      if (needsUpdate) {
        return { ...prev, attendance: updated };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProfiles]);

  // Pré-preencher etapas do projeto (quando há etapas definidas na atividade e não é modo edição)
  useEffect(() => {
    if (hasProjectStages && !initialData && formData.activitySteps?.length === 0) {
      const stepsFromProject = projectStages.map(stage => ({
        id: crypto.randomUUID(), // ID único para este RDO
        description: stage.name,
        weight: Number(stage.weight) || 1,
        progress: 0, // Progresso inicial 0, usuário preencherá
        orderIndex: stage.order_index,
        totalQuantity: stage.total_quantity ?? null, // Quantidade total do projeto
        unit: stage.unit ?? null, // Unidade do projeto
        quantityDone: null, // Usuário preencherá
      }));
      setFormData(prev => ({
        ...prev,
        useWeightedProgress: true, // Ativa automaticamente o modo ponderado
        activitySteps: stepsFromProject,
      }));
    }
  }, [hasProjectStages, projectStages, initialData]);

  const handleShiftChange = (shift: 'morning' | 'afternoon' | 'night') => {
    const times: Record<string, { start: string; end: string }> = {
      morning: { start: '07:00', end: '17:00' },
      afternoon: { start: '14:00', end: '22:00' },
      night: { start: '17:00', end: '07:00' },
    };
    setFormData(prev => {
      const oldTimes = {
        morning: { start: '07:00', end: '17:00' },
        afternoon: { start: '14:00', end: '22:00' },
        night: { start: '17:00', end: '07:00' },
      };
      const prevDefaults = oldTimes[prev.shift as keyof typeof oldTimes] || { start: prev.startTime, end: prev.endTime };
      return {
        ...prev,
        shift,
        startTime: times[shift].start,
        endTime: times[shift].end,
        attendance: prev.attendance.map(member => ({
          ...member,
          arrivalTime: member.arrivalTime === prevDefaults.start ? times[shift].start : member.arrivalTime,
          departureTime: member.departureTime === prevDefaults.end ? times[shift].end : member.departureTime,
        })),
      };
    });
  };

  const handleActivityChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.map((a, i) => i === index ? { ...a, description: value } : a),
    }));
  };

  const addActivity = () => {
    setFormData(prev => ({
      ...prev,
      activities: [...prev.activities, { description: '', completed: false, progress: 0 }],
    }));
  };

  const removeActivity = (index: number) => {
    setFormData(prev => {
      if (prev.activities.length <= 1) return prev;
      return {
        ...prev,
        activities: prev.activities.filter((_, i) => i !== index),
      };
    });
  };

  const toggleAttendance = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attendance: prev.attendance.map((member, i) => {
        if (i !== index) return member;
        const newPresent = !member.present;
        return {
          ...member,
          present: newPresent,
          arrivalTime: newPresent ? (member.arrivalTime || prev.startTime || '07:00') : member.arrivalTime,
          departureTime: newPresent ? (member.departureTime || prev.endTime || '17:00') : member.departureTime,
        };
      }),
    }));
  };

  const addCollaborator = (profile: { id: string; name: string | null; jobTitle?: string }) => {
    const alreadyExists = formData.attendance.some(
      a => a.userId === profile.id || a.userName.toLowerCase() === (profile.name || '').toLowerCase()
    );
    
    if (!alreadyExists && profile.name) {
      setFormData(prev => ({
        ...prev,
        attendance: [
          ...prev.attendance,
          { userId: profile.id, userName: profile.name!, present: true, arrivalTime: prev.startTime || '07:00', departureTime: prev.endTime || '17:00', functionRole: profile.jobTitle || 'Convencional' }
        ]
      }));
    }
  };

  const removeCollaborator = (index: number) => {
    setFormData(prev => {
      const member = prev.attendance[index];
      // Membros da equipe base não podem ser removidos, apenas marcados como ausentes
      if (member?.isFromTeam) {
        return {
          ...prev,
          attendance: prev.attendance.map((m, i) => 
            i === index ? { ...m, present: false } : m
          ),
        };
      }
      return {
        ...prev,
        attendance: prev.attendance.filter((_, i) => i !== index),
      };
    });
  };


  // Atualizar horário do colaborador
  const updateMemberTime = (index: number, field: 'arrivalTime' | 'departureTime', value: string) => {
    setFormData(prev => ({
      ...prev,
      attendance: prev.attendance.map((m, i) => 
        i === index ? { ...m, [field]: value } : m
      ),
    }));
  };

  // Filter available profiles (not already added)
  const availableProfiles = allProfiles.filter(
    p => !formData.attendance.some(
      a => a.userId === p.id || a.userName.toLowerCase() === (p.name || '').toLowerCase()
    )
  );

  // Filter by search term
  const filteredProfiles = availableProfiles
    .filter(p => p.name?.toLowerCase().includes(collaboratorSearch.toLowerCase()))
    .slice(0, 50);

  const handleDeviationChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      deviations: prev.deviations.map((d, i) => i === index ? { ...d, [field]: value } : d),
    }));
  };

  const addDeviation = () => {
    setFormData(prev => ({
      ...prev,
      deviations: [...prev.deviations, { type: 'other' as const, description: '', impact: 'low' as const }],
    }));
  };

  const handlePhotosChange = useCallback((photos: string[]) => {
    setFormData(prev => ({ ...prev, photos }));
  }, []);

  const handleLocationChange = (location: string) => {
    setFormData(prev => ({ ...prev, location }));
    localStorage.setItem('lastReportLocation', location);
  };

  // Handler para receber dados parseados pela IA
  const handleAIParsedData = (parsedData: Partial<any>) => {
    setFormData(prev => {
      // Determinar horários a usar
      const effectiveStartTime = parsedData.startTime || prev.startTime;
      const effectiveEndTime = parsedData.endTime || prev.endTime;
      
      // Processar attendance - marcar presença dos membros baseado no efetivo
      let updatedAttendance = [...prev.attendance];
      
      if (parsedData.attendance && parsedData.attendance.length > 0) {
        // Extrair dados completos da attendance parseada (inclui functionRole, horários)
        const parsedAttendance = parsedData.attendance.map((a: any) => ({
          originalName: (a.userName || a.name || '').trim(),
          normalizedName: (a.userName || a.name || '').toLowerCase().trim(),
          functionRole: a.functionRole || null,
          arrivalTime: a.arrivalTime || null,
          departureTime: a.departureTime || null,
          userId: a.userId || null,
        })).filter((a: any) => a.normalizedName.length > 0);
        
        if (parsedAttendance.length > 0) {
          // Se não há membros cadastrados na equipe, criar a partir dos nomes da IA
          if (prev.attendance.length === 0) {
            updatedAttendance = parsedAttendance.map((a: any) => {
              const matchedProfile = matchProfileByPartialName(a.originalName, allProfiles);
              return {
                userId: matchedProfile?.id || a.userId,
                userName: matchedProfile?.name || a.originalName,
                present: true,
                arrivalTime: a.arrivalTime || effectiveStartTime,
                departureTime: a.departureTime || effectiveEndTime,
                functionRole: matchedProfile?.jobTitle || a.functionRole || 'Convencional',
              };
            });
            console.log('[handleAIParsedData] Criando attendance dinamicamente (com match):', updatedAttendance);
          } else {
            // Há membros cadastrados, fazer match pelos nomes
            updatedAttendance = prev.attendance.map(member => {
              const memberName = member.userName.toLowerCase().trim();
              // Verificar se algum nome parseado contém ou está contido no nome do membro
              const matchedParsed = parsedAttendance.find((a: any) => 
                a.normalizedName.includes(memberName) || memberName.includes(a.normalizedName) ||
                // Também verificar primeiro nome
                a.normalizedName.split(' ')[0] === memberName.split(' ')[0]
              );
              
              if (matchedParsed) {
                return {
                  ...member,
                  present: true,
                  arrivalTime: matchedParsed.arrivalTime || effectiveStartTime,
                  departureTime: matchedParsed.departureTime || effectiveEndTime,
                  functionRole: member.functionRole || matchedParsed.functionRole || 'Convencional',
                };
              }
              return member;
            });
            
            // Se nenhum match foi encontrado, manter attendance original
            const hasAnyMatch = updatedAttendance.some(a => a.present);
            if (!hasAnyMatch) {
              updatedAttendance = prev.attendance;
            }
            
            // Adicionar nomes parseados que não matcharam com nenhum membro existente
            const unmatchedParsed = parsedAttendance.filter((a: any) => 
              !updatedAttendance.some(m => m.present && (
                m.userName.toLowerCase().includes(a.normalizedName) ||
                a.normalizedName.includes(m.userName.toLowerCase().split(' ')[0])
              ))
            );

            for (const unmatched of unmatchedParsed) {
              const profile = matchProfileByPartialName(unmatched.originalName, allProfiles);
              if (profile && !updatedAttendance.some(m => m.userId === profile.id)) {
                updatedAttendance.push({
                  userId: profile.id,
                  userName: profile.name || unmatched.originalName,
                  present: true,
                  arrivalTime: unmatched.arrivalTime || effectiveStartTime,
                  departureTime: unmatched.departureTime || effectiveEndTime,
                  functionRole: profile.jobTitle || unmatched.functionRole || 'Convencional',
                });
              }
            }
          }
        }
      }

      // Processar atividades - pode vir como string ou objeto
      let updatedActivities = prev.activities;
      if (parsedData.activities && parsedData.activities.length > 0) {
        updatedActivities = parsedData.activities.map((a: any) => ({
          description: typeof a === 'string' ? a : (a.description || ''),
          completed: typeof a === 'object' ? (a.completed || false) : false,
          progress: 0,
        }));
      }

      // Convert date to string format if it's a Date object
      // Using format() instead of toISOString() to avoid timezone issues
      const parsedDate = parsedData.date instanceof Date 
        ? format(parsedData.date, 'yyyy-MM-dd')
        : parsedData.date;

      return {
        ...prev,
        date: parsedDate || prev.date,
        shift: parsedData.shift || prev.shift,
        location: parsedData.activityLocation || prev.location,
        startTime: parsedData.startTime || prev.startTime,
        endTime: parsedData.endTime || prev.endTime,
        comments: parsedData.comments || prev.comments,
        supervisorName: parsedData.supervisorName || prev.supervisorName,
        technicalResponsibleName: parsedData.technicalResponsibleName || prev.technicalResponsibleName,
        activities: updatedActivities,
        attendance: updatedAttendance,
        hasDeviations: (parsedData.deviations?.length || 0) > 0,
        deviations: parsedData.deviations?.length > 0
          ? parsedData.deviations.map((d: any) => ({
              type: d.type || 'other',
              description: d.description || '',
              impact: d.impact || 'low',
            }))
          : prev.deviations,
        // Novos campos do WhatsApp
        radioFrequencyWees: parsedData.radioFrequencyWees || prev.radioFrequencyWees,
        radioFrequencyOperation: parsedData.radioFrequencyOperation || prev.radioFrequencyOperation,
        maintenanceOrderNumber: parsedData.maintenanceOrderNumber || prev.maintenanceOrderNumber,
        maintenanceOrderTitle: parsedData.maintenanceOrderTitle || prev.maintenanceOrderTitle,
        arrivalTimeAtLiberator: parsedData.arrivalTimeAtLiberator || prev.arrivalTimeAtLiberator,
        documentReleaseTime: parsedData.documentReleaseTime || prev.documentReleaseTime,
        blockageStatus: parsedData.blockageStatus || prev.blockageStatus,
        ambulancePoint: parsedData.ambulancePoint || prev.ambulancePoint,
        meetingPoint: parsedData.meetingPoint || prev.meetingPoint,
        blockRevalidationTime: parsedData.blockRevalidationTime || prev.blockRevalidationTime,
      };
    });
  };

  const handleSubmitForm = async (status: 'draft' | 'pending') => {
    // Validação do Título da OM (obrigatório para qualquer ação)
    if (!formData.maintenanceOrderTitle?.trim()) {
      toast.error('O Título da OM é obrigatório');
      return;
    }

    // Situação climática obrigatória ao enviar (não no rascunho)
    if (status === 'pending' && !formData.weather) {
      toast.error('Selecione a situação climática');
      return;
    }


    // Validação de quantidade feita nas etapas (obrigatório quando há total definido e não é rascunho)
    if (formData.useWeightedProgress && status !== 'draft') {
      const stepsWithTotal = (formData.activitySteps || []).filter(s => s.totalQuantity != null && s.totalQuantity > 0);
      const missingQuantity = stepsWithTotal.some(s => s.quantityDone === null || s.quantityDone === undefined);
      
      if (missingQuantity) {
        toast.error('Preencha a quantidade feita em todas as etapas antes de enviar');
        return;
      }
    }

    // Filter out empty activities and inject plannedWorkforce/realPercentage
    const presentCount = formData.attendance.filter(a => a.present).length;
    const filteredData = {
      ...formData,
      activities: formData.activities.filter(a => a.description.trim() !== ''),
      plannedWorkforce: plannedWorkforce || formData.attendance.length,
      realPercentage: plannedWorkforce > 0 ? Math.round((presentCount / plannedWorkforce) * 100) : 0,
    };
    await onSubmit(filteredData, status);
  };

  const handleNoActivity = () => {
    setFormData(prev => ({
      ...prev,
      noActivity: true,
      dailyProgress: 0,
      activities: [],
      attendance: prev.attendance.map(a => ({ ...a, present: false })),
      hasDeviations: true,
      deviations: [{
        type: 'other' as const,
        description: 'Sem atividade no período',
        impact: 'low' as const
      }],
      comments: 'Relatório registrado como sem atividade no período.',
    }));
    
    toast.info('Formulário preenchido como "Sem Atividade"');
  };

  const presentCount = formData.attendance.filter(a => a.present).length;
  const absentCount = formData.attendance.filter(a => !a.present).length;

  return (
    <div className="pb-28 lg:pb-6 relative">
      {/* Header - padronizado com resto do sistema */}
      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="h-7 px-2 sm:h-8 sm:px-3"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden xs:inline">Voltar</span>
          </Button>
        </div>
        
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge 
                variant="secondary" 
                className="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-primary/10 text-primary border-primary/20 shrink-0"
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Relatório
              </Badge>
              <Badge variant="outline" className="text-xs">
                {format(parseISO(formData.date), "dd MMM", { locale: ptBR })}
              </Badge>
            </div>
            <h1 className="text-xl xs:text-2xl font-bold truncate">
              {isEditMode ? 'Editar Relatório' : 'Novo Relatório'}
            </h1>
            <p className="text-muted-foreground text-sm truncate">
              {selection.projectName} • {selection.teamName}
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <ParseReportModal 
              onDataParsed={handleAIParsedData}
              teamMembers={teamMembers?.map(m => ({
                id: (m.user as any)?.id || '',
                name: (m.user as any)?.name || '',
              })) || []}
              allProfiles={allProfiles}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleNoActivity}
              className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Sem atividade no período</span>
              <span className="sm:hidden">Sem atividade</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Banner Sem Atividade */}
        {formData.noActivity && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">Sem Atividade no Período</p>
              <p className="text-sm text-amber-700">
                Este relatório será registrado indicando que não houve atividade.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFormData(prev => ({ ...prev, noActivity: false }))}
              className="shrink-0 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Date Selection - Grande e visível */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Data do Relatório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-12 sm:h-14 text-sm sm:text-lg overflow-hidden"
                >
                  <CalendarIcon className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span className="hidden sm:inline">
                    {format(parseISO(formData.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  <span className="sm:hidden truncate">
                    {format(parseISO(formData.date), "EEE, dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(formData.date)}
                  onSelect={(date) => date && setFormData(prev => ({ 
                    ...prev, 
                    date: format(date, 'yyyy-MM-dd') 
                  }))}
                  initialFocus
                  className="pointer-events-auto"
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* Shift Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Turno e Horário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {SHIFT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = formData.shift === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleShiftChange(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg border-2 transition-all",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", option.color)} />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.time}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Início</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endTime">Término</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Local da Atividade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Digite o local..."
              value={formData.location}
              onChange={(e) => handleLocationChange(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {RECENT_LOCATIONS.map((loc) => (
                <Badge
                  key={loc}
                  variant={formData.location === loc ? "default" : "outline"}
                  className="cursor-pointer text-xs sm:text-sm"
                  onClick={() => handleLocationChange(loc)}
                >
                  {loc}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ordem de Manutenção */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Ordem de Manutenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Emergência: SIM / NÃO */}
            <div>
              <Label className="mb-2 block">Emergência</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    'min-w-[80px] rounded-full font-semibold transition-all',
                    formData.isEmergency === true
                      ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 shadow-sm'
                      : 'bg-background text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                  )}
                  onClick={() => setFormData(prev => ({ ...prev, isEmergency: true }))}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  SIM
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    'min-w-[80px] rounded-full font-semibold transition-all',
                    formData.isEmergency !== true
                      ? 'bg-green-600 text-white border-green-600 hover:bg-green-700 shadow-sm'
                      : 'bg-background text-muted-foreground hover:bg-green-50 hover:text-green-600 hover:border-green-300'
                  )}
                  onClick={() => setFormData(prev => ({ ...prev, isEmergency: false }))}
                >
                  <Check className="h-4 w-4 mr-1" />
                  NÃO
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maintenanceOrderNumber">Nº da OM</Label>
                <Input
                  id="maintenanceOrderNumber"
                  placeholder="Ex: 900004376226"
                  value={formData.maintenanceOrderNumber || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    maintenanceOrderNumber: e.target.value 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="blockageStatus">Status do Bloqueio</Label>
                <Input
                  id="blockageStatus"
                  placeholder="Ex: NA, Ativo, Liberado"
                  value={formData.blockageStatus || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    blockageStatus: e.target.value 
                  }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="maintenanceOrderTitle" className="flex items-center gap-1">
                Título da OM <span className="text-destructive">*</span>
              </Label>
              <Input
                id="maintenanceOrderTitle"
                placeholder="Ex: Montagem de telas quebra vento 6° piso"
                value={formData.maintenanceOrderTitle || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  maintenanceOrderTitle: e.target.value 
                }))}
                className={cn(
                  !formData.maintenanceOrderTitle?.trim() && 'border-destructive/50'
                )}
              />
              <p className="text-xs text-destructive mt-1">* Campo obrigatório</p>
            </div>
          </CardContent>
        </Card>

        {/* Comunicação e Liberação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Comunicação e Liberação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="radioFrequencyWees">Faixa Rádio Wees</Label>
                <Input
                  id="radioFrequencyWees"
                  placeholder="Ex: 01/02"
                  value={formData.radioFrequencyWees || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    radioFrequencyWees: e.target.value 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="radioFrequencyOperation">Faixa Rádio Operação</Label>
                <Input
                  id="radioFrequencyOperation"
                  placeholder="Ex: 05"
                  value={formData.radioFrequencyOperation || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    radioFrequencyOperation: e.target.value 
                  }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="arrivalTimeAtLiberator">Chegada Liberador</Label>
                <Input
                  id="arrivalTimeAtLiberator"
                  type="time"
                  value={formData.arrivalTimeAtLiberator || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    arrivalTimeAtLiberator: e.target.value 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="documentReleaseTime">Liberação Docs</Label>
                <Input
                  id="documentReleaseTime"
                  type="time"
                  value={formData.documentReleaseTime || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    documentReleaseTime: e.target.value 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="blockRevalidationTime">Revalidação</Label>
                <Input
                  id="blockRevalidationTime"
                  type="time"
                  value={formData.blockRevalidationTime || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    blockRevalidationTime: e.target.value 
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Atividades Executadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.activities.map((activity, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Atividade ${index + 1}...`}
                  value={activity.description}
                  onChange={(e) => handleActivityChange(index, e.target.value)}
                  className="flex-1"
                />
                {formData.activities.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => removeActivity(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={addActivity} className="w-full">
              + Adicionar Atividade
            </Button>
          </CardContent>
        </Card>

        {/* Rotina */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Rotina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Descreva a rotina do dia..."
              value={formData.routine || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, routine: e.target.value }))}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Efetivo do Dia
              <div className="ml-auto flex gap-2">
                {plannedWorkforce > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Meta: {plannedWorkforce}
                  </Badge>
                )}
                <Badge variant="default" className="bg-green-500">
                  {presentCount} ✓
                </Badge>
                {absentCount > 0 && (
                  <Badge variant="destructive">
                    {absentCount} ✗
                  </Badge>
                )}
              </div>
            </CardTitle>
            {/* Indicador de Efetivo Programado */}
            {plannedWorkforce > 0 && (
              <div className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-muted/50 text-xs">
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Programado:</span>
                  <span className="font-semibold">{plannedWorkforce}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Real:</span>
                  <span className={cn(
                    "font-semibold",
                    actualWorkforce >= plannedWorkforce ? "text-green-600" : 
                    actualWorkforce >= plannedWorkforce * 0.8 ? "text-amber-600" : "text-red-600"
                  )}>
                    {actualWorkforce}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">%:</span>
                  <span className={cn(
                    "font-semibold",
                    actualWorkforce >= plannedWorkforce ? "text-green-600" : 
                    actualWorkforce >= plannedWorkforce * 0.8 ? "text-amber-600" : "text-red-600"
                  )}>
                    {plannedWorkforce > 0 ? Math.round((actualWorkforce / plannedWorkforce) * 100) : 0}%
                  </span>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Collaborator Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar Colaboradores
              </Label>
              <Popover open={collaboratorPopoverOpen} onOpenChange={setCollaboratorPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Buscar e adicionar colaboradores...
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[300px]" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar por nome..." 
                      value={collaboratorSearch}
                      onValueChange={setCollaboratorSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado</CommandEmpty>
                      <CommandGroup>
                        {filteredProfiles.map(profile => (
                          <CommandItem
                            key={profile.id}
                            value={profile.name || ''}
                            onSelect={() => addCollaborator(profile)}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            {profile.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {availableProfiles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {availableProfiles.length} colaboradores disponíveis
                </p>
              )}
            </div>

            {/* Attendance List */}
            {isLoadingMembers ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : formData.attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Use o seletor acima para adicionar colaboradores
              </p>
            ) : (
              <div className="space-y-2">
                {formData.attendance.map((member, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg transition-colors border",
                      member.present 
                        ? "bg-green-500/10 border-green-500/20" 
                        : "bg-destructive/10 border-destructive/20"
                    )}
                  >
                    {/* Linha principal: toggle + nome + remover */}
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => toggleAttendance(index)}
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center cursor-pointer shrink-0",
                          member.present ? "bg-green-500" : "bg-destructive"
                        )}
                      >
                        {member.present ? (
                          <Check className="h-4 w-4 text-white" />
                        ) : (
                          <X className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <span className="font-medium flex-1 truncate">{member.userName}{member.functionRole ? ` - ${member.functionRole}` : ''}</span>
                      <span className="text-sm text-muted-foreground mr-2">
                        {member.present ? 'Presente' : 'Ausente'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCollaborator(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Campos de horários quando presente */}
                    {member.present && (
                      <div className="grid grid-cols-2 gap-3 mt-3 pl-11">
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Entrada
                          </Label>
                          <Input
                            type="time"
                            value={member.arrivalTime || ''}
                            onChange={(e) => updateMemberTime(index, 'arrivalTime', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Saída
                          </Label>
                          <Input
                            type="time"
                            value={member.departureTime || ''}
                            onChange={(e) => updateMemberTime(index, 'departureTime', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deviations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Desvios ou Ocorrências
              </CardTitle>
              <Switch
                checked={formData.hasDeviations}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    hasDeviations: checked,
                    deviations: checked && prev.deviations.length === 0 
                      ? [{ type: 'other', description: '', impact: 'low' }] 
                      : prev.deviations 
                  }));
                }}
              />
            </div>
          </CardHeader>
          {formData.hasDeviations && (
            <CardContent className="space-y-4">
              {formData.deviations.map((deviation, index) => (
                <div key={index} className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex gap-2">
                    <select
                      value={deviation.type}
                      onChange={(e) => handleDeviationChange(index, 'type', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="delay">Atraso</option>
                      <option value="equipment">Equipamento</option>
                      <option value="safety">Segurança</option>
                      <option value="other">Outro</option>
                    </select>
                    <select
                      value={deviation.impact}
                      onChange={(e) => handleDeviationChange(index, 'impact', e.target.value)}
                      className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="low">Baixo</option>
                      <option value="medium">Médio</option>
                      <option value="high">Alto</option>
                    </select>
                  </div>
                  <Textarea
                    placeholder="Descreva o desvio..."
                    value={deviation.description}
                    onChange={(e) => handleDeviationChange(index, 'description', e.target.value)}
                    rows={2}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={addDeviation} className="w-full">
                + Adicionar Desvio
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Situação Climática */}
        <Card className="border-sky-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-500" />
              Situação Climática
              <span className="text-destructive">*</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Selecione a condição predominante do dia
            </p>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              type="single"
              value={formData.weather || ''}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  weather: (value || '') as ReportFormData['weather'],
                }))
              }
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full"
            >
              <ToggleGroupItem
                value="sol"
                aria-label="Sol"
                className="flex flex-col h-auto py-3 gap-1 border data-[state=on]:bg-amber-500/10 data-[state=on]:border-amber-500 data-[state=on]:text-amber-600"
              >
                <Sun className="h-5 w-5" />
                <span className="text-xs font-medium">Sol</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="nublado"
                aria-label="Nublado"
                className="flex flex-col h-auto py-3 gap-1 border data-[state=on]:bg-slate-500/10 data-[state=on]:border-slate-500 data-[state=on]:text-slate-600"
              >
                <Cloud className="h-5 w-5" />
                <span className="text-xs font-medium">Nublado</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="chuva_leve"
                aria-label="Chuva leve"
                className="flex flex-col h-auto py-3 gap-1 border data-[state=on]:bg-sky-500/10 data-[state=on]:border-sky-500 data-[state=on]:text-sky-600"
              >
                <CloudDrizzle className="h-5 w-5" />
                <span className="text-xs font-medium">Chuva leve</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="chuva_intensa"
                aria-label="Chuva intensa"
                className="flex flex-col h-auto py-3 gap-1 border data-[state=on]:bg-blue-700/10 data-[state=on]:border-blue-700 data-[state=on]:text-blue-700"
              >
                <CloudRain className="h-5 w-5" />
                <span className="text-xs font-medium">Chuva intensa</span>
              </ToggleGroupItem>
            </ToggleGroup>
            {!formData.weather && (
              <p className="text-xs text-destructive mt-2">* Campo obrigatório</p>
            )}
          </CardContent>
        </Card>

        {/* Controle de Atrasos (Horas) */}
        <DelayControlSection 
          formData={formData} 
          setFormData={setFormData}
        />

        {/* Photos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              Fotos
              {formData.photos.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {formData.photos.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoUploader
              photos={formData.photos}
              onPhotosChange={handlePhotosChange}
              maxPhotos={10}
            />
          </CardContent>
        </Card>


        {/* Comments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Observações gerais sobre o dia..."
              value={formData.comments}
              onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Avanço do Dia */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Avanço do Dia
              </CardTitle>
              <div className="flex items-center gap-2">
                {projectMeta?.progress_target && (
                  <Badge variant="outline" className="text-xs font-normal">
                    <Target className="h-3 w-3 mr-1" />
                    Meta: {projectMeta.progress_target}%
                    {projectMeta.end_date && ` até ${format(parseISO(projectMeta.end_date), 'dd/MM/yyyy')}`}
                  </Badge>
                )}
              </div>
            </div>
            {/* Toggle entre modo simples e por etapas */}
            <Tabs 
              value={formData.useWeightedProgress ? 'weighted' : 'simple'} 
              onValueChange={(val) => setFormData(prev => ({ 
                ...prev, 
                useWeightedProgress: val === 'weighted' 
              }))}
              className="mt-3"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="simple" className="gap-1.5 text-xs">
                  <Sliders className="h-3.5 w-3.5" />
                  Simples
                </TabsTrigger>
                <TabsTrigger value="weighted" className="gap-1.5 text-xs">
                  <Scale className="h-3.5 w-3.5" />
                  Por Etapas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Progresso Acumulado + Hoje + Novo Total */}
            <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
              <div className="text-center flex-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground block">Acumulado</span>
                <span className="text-lg sm:text-2xl font-bold text-primary">
                  {accumulatedProgress}%
                </span>
              </div>
              <div className="text-center">
                <span className="text-lg sm:text-xl font-medium text-muted-foreground">+</span>
              </div>
              <div className="text-center flex-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground block">Hoje</span>
                <span className="text-lg sm:text-2xl font-bold text-green-500">
                  {formData.dailyProgress}%
                </span>
              </div>
              <div className="text-center">
                <span className="text-lg sm:text-xl font-medium text-muted-foreground">=</span>
              </div>
              <div className="text-center flex-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground block">Novo Total</span>
                <span className="text-lg sm:text-2xl font-bold text-amber-500">
                  {newTotalProgress}%
                </span>
              </div>
            </div>
            
            {/* Barra de progresso visual */}
            <div className="h-3 bg-muted rounded-full overflow-hidden relative">
              <div className="h-full flex">
                {/* Progresso acumulado anterior */}
                <div 
                  className="bg-primary/60 transition-all duration-300"
                  style={{ width: `${accumulatedProgress}%` }}
                />
                {/* Avanço do dia (verde) */}
                <div 
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${formData.dailyProgress}%` }}
                />
              </div>
              {/* Linha de meta */}
              {projectMeta?.progress_target && projectMeta.progress_target < 100 && (
                <div 
                  className="absolute top-0 h-full w-0.5 bg-orange-500"
                  style={{ left: `${projectMeta.progress_target}%` }}
                  title={`Meta: ${projectMeta.progress_target}%`}
                />
              )}
            </div>
            
            {/* Conteúdo baseado no modo selecionado */}
            {formData.useWeightedProgress ? (
              /* Modo por etapas ponderado */
              <StepProgressEditor
                steps={(formData.activitySteps || []) as ActivityStep[]}
                onChange={(steps) => setFormData(prev => ({ ...prev, activitySteps: steps }))}
                onTotalProgressChange={(progress) => setFormData(prev => ({ 
                  ...prev, 
                  dailyProgress: Math.min(Math.round(progress), maxDailyProgress) 
                }))}
                readOnlyStages={hasProjectStages}
              />
            ) : (
              /* Modo simples com slider */
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Quanto avançou hoje? {maxDailyProgress < 100 && `(máx: ${maxDailyProgress}%)`}
                </Label>
                <Slider
                  value={[formData.dailyProgress]}
                  onValueChange={([value]) => setFormData(prev => ({ 
                    ...prev, 
                    dailyProgress: Math.min(value, maxDailyProgress) 
                  }))}
                    max={maxDailyProgress}
                    step={1}
                  className="py-4"
                />
              </div>
            )}
            
            {accumulatedProgress >= 100 && (
              <p className="text-xs text-amber-600 text-center">
                ⚠️ Este projeto já atingiu 100% de progresso
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Resumo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.aiSummary && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{formData.aiSummary}</p>
              </div>
            )}
            <Button
              type="button"
              variant="default"
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="w-full gap-2"
            >
              {isGeneratingSummary ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGeneratingSummary ? 'Gerando resumo...' : formData.aiSummary ? 'Regenerar Resumo' : 'Gerar Resumo'}
            </Button>
          </CardContent>
        </Card>

        {/* AI Summary Preview Dialog */}
        <AISummaryPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          generatedText={generatedText}
          onAccept={handleAcceptSummary}
          onRegenerate={handleRegenerate}
          isRegenerating={isGeneratingSummary}
        />
      </div>

      {/* Bottom Actions - fixed on mobile, relative on desktop */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-3 sm:p-4 flex justify-center gap-3 z-40 safe-bottom max-w-full lg:relative lg:border-0 lg:p-0 lg:mt-6 lg:bg-transparent lg:backdrop-blur-none">
        <Button 
          variant="outline"
          className="min-w-0"
          size="sm"
          onClick={() => handleSubmitForm('draft')}
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 shrink-0 mr-1.5" />
          <span className="truncate">Rascunho</span>
        </Button>
        <Button 
          className="flex-1 min-w-0 max-w-md"
          size="sm"
          onClick={() => handleSubmitForm('pending')}
          disabled={isSubmitting}
        >
          <Send className="h-4 w-4 shrink-0 mr-1.5" />
          <span className="truncate">Salvar Relatório</span>
        </Button>
      </div>
    </div>
  );
}
