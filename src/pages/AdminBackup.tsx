import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/loose-client';
import JSZip from 'jszip';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatRdoNumber } from '@/lib/formatters';
import { generateReportPdfAsBlob, TenantColors } from '@/lib/generateReportPdf';
import { 
  Download, 
  Upload, 
  History, 
  Database, 
  Building2, 
  FolderKanban, 
  Users, 
  FileText, 
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  HardDrive,
  Package,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  FileCheck,
  CalendarIcon,
  ChevronDown,
  Clock,
  CloudUpload,
  ExternalLink,
  Play,
  Settings2,
} from 'lucide-react';

interface BackupCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  tables: string[];
  estimatedSize?: string;
  isPdfExport?: boolean;
  isSignedExport?: boolean;
}

interface CategoryStats {
  records: number;
  tables: number;
}

interface StorageStats {
  categories: Record<string, CategoryStats>;
  storage: {
    totalFiles: number;
    totalSize: number;
    totalSizeFormatted: string;
    breakdown: Record<string, {
      label: string;
      count: number;
      size: number;
      formatted: string;
    }>;
  };
}

interface PdfProgress {
  current: number;
  total: number;
  currentReportName: string;
  currentFolder: string;
}

interface DownloadedFileInfo {
  name: string;
  size: number;
  folder: string;
}

interface BackupSchedule {
  id: string;
  frequency: string;
  categories: string[];
  include_photos: boolean;
  include_pdfs: boolean;
  period_days: number | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string | null;
  company_id: string | null;
  created_at: string;
}

interface BackupHistoryEntry {
  id: string;
  schedule_id: string | null;
  status: string;
  file_path: string | null;
  file_size: number | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  drive_file_id: string | null;
  drive_file_url: string | null;
}

// Format file size to human readable
function formatFileSizeLocal(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Generate backup report text with real data
function generateBackupReportText(
  manifest: Record<string, any>,
  downloadedFiles: DownloadedFileInfo[],
  pdfStats: { count: number; totalSize: number },
  signedPdfStats: { count: number; totalSize: number }
): string {
  const lines: string[] = [];
  const separator = '='.repeat(80);
  const thinSeparator = '-'.repeat(80);
  
  lines.push(separator);
  lines.push('                            RELATÓRIO DE BACKUP');
  lines.push(separator);
  lines.push('');
  
  lines.push('INFORMAÇÕES GERAIS');
  lines.push(thinSeparator);
  lines.push(`Data/Hora.........: ${new Date().toLocaleString('pt-BR')}`);
  lines.push(`Gerado por........: ${manifest.createdBy || 'N/A'}`);
  lines.push(`Empresa...........: ${manifest.companyId === 'all' ? 'Todas (Super Admin)' : manifest.companyId}`);
  lines.push(`Versão............: ${manifest.version || '1.0'}`);
  lines.push('');
  
  const totalRecords = Object.values(manifest.recordCounts || {}).reduce((a: number, b: any) => a + (b || 0), 0);
  lines.push('RESUMO DOS DADOS');
  lines.push(thinSeparator);
  lines.push(`Total de Tabelas..: ${manifest.tables?.length || 0}`);
  lines.push(`Total de Registros: ${totalRecords}`);
  lines.push('');
  
  if (manifest.tables && manifest.tables.length > 0) {
    lines.push('DADOS EXPORTADOS (pasta /data)');
    lines.push(thinSeparator);
    lines.push('| Tabela                  | Registros | Arquivo                      |');
    lines.push('|-------------------------|-----------|------------------------------|');
    
    for (const tableName of manifest.tables) {
      const count = manifest.recordCounts?.[tableName] || 0;
      const tableNamePadded = (tableName as string).padEnd(23);
      const countPadded = count.toString().padStart(9);
      const fileName = `data/${tableName}.json`.padEnd(28);
      lines.push(`| ${tableNamePadded} | ${countPadded} | ${fileName} |`);
    }
    lines.push('');
  }
  
  if (downloadedFiles.length > 0) {
    const totalFilesSize = downloadedFiles.reduce((sum, f) => sum + f.size, 0);
    const filesByFolder: Record<string, DownloadedFileInfo[]> = {};
    for (const file of downloadedFiles) {
      if (!filesByFolder[file.folder]) filesByFolder[file.folder] = [];
      filesByFolder[file.folder].push(file);
    }
    
    lines.push('ARQUIVOS DE MÍDIA (pasta /files)');
    lines.push(thinSeparator);
    lines.push('| Pasta               | Qtd   | Tamanho     |');
    lines.push('|---------------------|-------|-------------|');
    
    for (const [folder, files] of Object.entries(filesByFolder)) {
      const folderSize = files.reduce((sum, f) => sum + f.size, 0);
      const folderPadded = folder.padEnd(19);
      const countPadded = files.length.toString().padStart(5);
      const sizePadded = formatFileSizeLocal(folderSize).padStart(11);
      lines.push(`| ${folderPadded} | ${countPadded} | ${sizePadded} |`);
    }
    lines.push('|---------------------|-------|-------------|');
    const totalLabel = 'TOTAL'.padEnd(19);
    const totalCountPadded = downloadedFiles.length.toString().padStart(5);
    const totalSizePadded = formatFileSizeLocal(totalFilesSize).padStart(11);
    lines.push(`| ${totalLabel} | ${totalCountPadded} | ${totalSizePadded} |`);
    lines.push('');
  }
  
  if (pdfStats.count > 0) {
    lines.push('RDOs EM PDF (pasta /RDOs)');
    lines.push(thinSeparator);
    lines.push(`Total de PDFs.....: ${pdfStats.count}`);
    lines.push(`Tamanho Total.....: ${formatFileSizeLocal(pdfStats.totalSize)}`);
    lines.push('');
  }
  
  if (signedPdfStats.count > 0) {
    lines.push('RDOs ASSINADOS (pasta /RDOs_Assinados)');
    lines.push(thinSeparator);
    lines.push(`Total de PDFs.....: ${signedPdfStats.count}`);
    lines.push(`Tamanho Total.....: ${formatFileSizeLocal(signedPdfStats.totalSize)}`);
    lines.push('');
  }
  
  const grandTotal = 
    downloadedFiles.reduce((sum, f) => sum + f.size, 0) +
    pdfStats.totalSize +
    signedPdfStats.totalSize;
  
  lines.push(separator);
  lines.push('RESUMO FINAL');
  lines.push(thinSeparator);
  lines.push(`Arquivos de Mídia.: ${downloadedFiles.length} arquivos (${formatFileSizeLocal(downloadedFiles.reduce((sum, f) => sum + f.size, 0))})`);
  lines.push(`PDFs Gerados......: ${pdfStats.count} relatórios (${formatFileSizeLocal(pdfStats.totalSize)})`);
  lines.push(`PDFs Assinados....: ${signedPdfStats.count} documentos (${formatFileSizeLocal(signedPdfStats.totalSize)})`);
  lines.push(`TAMANHO TOTAL.....: ${formatFileSizeLocal(grandTotal)}`);
  lines.push(separator);
  
  return lines.join('\n');
}

const BACKUP_CATEGORIES: BackupCategory[] = [
  {
    id: 'settings',
    label: 'Configurações do Sistema',
    description: 'Cores, logo, nome do sistema',
    icon: Database,
    tables: ['tenant_settings', 'system_settings'],
  },
  {
    id: 'companies',
    label: 'Fábricas e Unidades',
    description: 'Empresas, sites, contatos',
    icon: Building2,
    tables: ['companies', 'company_contacts', 'sites', 'site_responsibles'],
  },
  {
    id: 'projects',
    label: 'Atividades/Projetos',
    description: 'Projetos, etapas, tarefas, equipamentos',
    icon: FolderKanban,
    tables: ['projects', 'project_stages', 'project_tasks', 'project_equipment', 'project_members'],
  },
  {
    id: 'teams',
    label: 'Equipes e Colaboradores',
    description: 'Perfis de usuários, equipes',
    icon: Users,
    tables: ['profiles', 'user_roles', 'teams', 'team_members'],
  },
  {
    id: 'reports',
    label: 'Relatórios (RDOs)',
    description: 'Todos os relatórios diários de obra',
    icon: FileText,
    tables: ['reports', 'report_activities', 'report_attendance', 'report_deviations', 'report_equipment', 'report_signatures'],
  },
  {
    id: 'photos',
    label: 'Fotos e Arquivos',
    description: 'Imagens dos RDOs (pode ser grande)',
    icon: ImageIcon,
    tables: ['report_photos'],
  },
  {
    id: 'reports_pdf',
    label: 'RDOs em PDF',
    description: 'Todos os relatórios como PDFs organizados por pastas',
    icon: FolderOpen,
    tables: [],
    isPdfExport: true,
  },
  {
    id: 'signed_pdfs',
    label: 'RDOs Assinados',
    description: 'PDFs com assinaturas digitais válidas do Autentique',
    icon: FileCheck,
    tables: [],
    isSignedExport: true,
  },
  {
    id: 'client_portal',
    label: 'Portal do Cliente',
    description: 'Empresas, perfis, carteira e recompensas',
    icon: ExternalLink,
    tables: ['client_profiles', 'client_companies', 'client_sites', 'client_user_roles', 'client_wallet', 'client_wallet_transactions', 'rewards_catalog', 'reward_redemptions'],
  },
  {
    id: 'service_reports',
    label: 'Relatórios de Serviço (RS)',
    description: 'Relatórios RS, seções e fotos',
    icon: FileText,
    tables: ['service_reports', 'service_report_sections', 'service_report_photos'],
  },
  {
    id: 'others',
    label: 'Outros Dados',
    description: 'Notificações, sugestões, motivos de atraso',
    icon: Settings2,
    tables: ['notifications', 'feature_suggestions', 'suggestion_votes', 'delay_reasons', 'report_history', 'autentique_documents', 'autentique_signatures', 'clicksign_documents'],
  },
];

const MONTH_NAMES = [
  '01 - Janeiro', '02 - Fevereiro', '03 - Março', '04 - Abril',
  '05 - Maio', '06 - Junho', '07 - Julho', '08 - Agosto',
  '09 - Setembro', '10 - Outubro', '11 - Novembro', '12 - Dezembro'
];

function sanitizeName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

async function fetchReportForPdf(reportId: string) {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      project:projects(
        *,
        site:sites(*),
        company:companies(*)
      ),
      activities:report_activities(*),
      deviations:report_deviations(*),
      attendance:report_attendance(*),
      photos:report_photos(*),
      signatures:report_signatures(*)
    `)
    .eq('id', reportId)
    .single();

  if (error || !data) {
    console.error('Erro ao buscar relatório:', reportId, error);
    return null;
  }

  const projectData = data.project as any;
  if (!projectData?.site || !projectData?.company) {
    console.error('Relatório sem projeto/site/empresa:', reportId);
    return null;
  }

  const report = {
    id: data.id,
    date: parseISO(data.date),
    shift: data.shift,
    status: data.status,
    location: data.location,
    startTime: data.start_time,
    endTime: data.end_time,
    weather: data.weather,
    temperature: data.temperature,
    plannedWorkforce: data.planned_workforce,
    actualWorkforce: data.actual_workforce,
    dailyProgress: data.daily_progress,
    supervisorName: data.supervisor_name,
    comments: data.comments,
    aiSummary: data.ai_summary,
    routine: data.routine,
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
    createdBy: data.created_by ?? '',
    projectId: data.project_id,
    teamId: data.team_id,
    rdo_number: data.rdo_number,
    rdoNumber: data.rdo_number,
    contractNumber: data.contract_number,
    activities: (data.activities || []).map((a: any) => ({
      id: a.id,
      description: a.description,
      completed: a.completed ?? false,
      notes: a.notes,
      progress: a.progress,
    })),
    deviations: (data.deviations || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      description: d.description,
      impact: d.impact,
      actionTaken: d.action_taken,
    })),
    attendance: (data.attendance || []).map((att: any) => ({
      id: att.id,
      userId: att.user_id,
      userName: att.user_name,
      present: att.present ?? false,
      arrivalTime: att.arrival_time,
      departureTime: att.departure_time,
      notes: att.notes,
    })),
    photos: (data.photos || []).map((p: any) => ({
      id: p.id,
      url: p.url,
      description: p.description,
    })),
  };

  const company = {
    id: projectData.company.id,
    name: projectData.company.name,
    cnpj: projectData.company.cnpj,
    email: projectData.company.email,
    phone: projectData.company.phone,
    address: projectData.company.address,
    city: projectData.company.city,
    state: projectData.company.state,
    logoUrl: projectData.company.logo_url,
    logo_url: projectData.company.logo_url,
    responsibleName: projectData.company.responsible_name,
    responsibleEmail: projectData.company.responsible_email,
    responsiblePhone: projectData.company.responsible_phone,
    responsibleRole: projectData.company.responsible_role,
  };

  const site = {
    id: projectData.site.id,
    name: projectData.site.name,
    companyId: projectData.site.company_id,
    address: projectData.site.address,
    city: projectData.site.city,
    state: projectData.site.state,
    latitude: projectData.site.latitude,
    longitude: projectData.site.longitude,
  };

  const project = {
    id: projectData.id,
    name: projectData.name,
    code: projectData.code,
    description: projectData.description,
    status: projectData.status,
    startDate: projectData.start_date ? new Date(projectData.start_date) : undefined,
    endDate: projectData.end_date ? new Date(projectData.end_date) : undefined,
    progress: projectData.progress,
    siteId: projectData.site_id,
    companyId: projectData.company_id,
    supervisorName: projectData.supervisor_name,
    clientResponsibleName: projectData.client_responsible_name,
    contractNumber: projectData.contract_number,
  };

  const signatures = (data.signatures || []).map((sig: any) => ({
    id: sig.id,
    signerName: sig.signer_name,
    signerRole: sig.signer_role,
    signatureData: sig.signature_data,
    signedAt: sig.signed_at,
    ipAddress: sig.ip_address,
  }));

  return { report, company, site, project, signatures };
}

async function fetchTenantColors(): Promise<TenantColors | undefined> {
  const { data } = await supabase
    .from('system_settings')
    .select('primary_color, accent_color, logo_url, pdf_logo_url')
    .limit(1)
    .single();

  if (!data) return undefined;

  return {
    primary_color: data.primary_color,
    accent_color: data.accent_color,
    logo_url: data.logo_url,
    pdf_logo_url: data.pdf_logo_url,
  };
}

// Period presets
const PERIOD_PRESETS = [
  { label: 'Este Mês', getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  { label: 'Último Mês', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 3 Meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: new Date() }) },
  { label: 'Últimos 6 Meses', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 5)), end: new Date() }) },
  { label: 'Todo o Período', getValue: () => ({ start: undefined as Date | undefined, end: undefined as Date | undefined }) },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  running: { label: 'Executando', variant: 'secondary' },
  completed: { label: 'Concluído', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

export default function AdminBackup() {
  const { role, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['settings', 'companies', 'projects', 'teams', 'reports']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<File[] | null>(null);
  const [selectedLooseFiles, setSelectedLooseFiles] = useState<File[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);

  // Period filter state
  const [periodOpen, setPeriodOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Schedule tab state
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isRunningManual, setIsRunningManual] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduleCategories, setScheduleCategories] = useState<string[]>(['settings', 'companies', 'projects', 'teams', 'reports']);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [schedulePeriodDays, setSchedulePeriodDays] = useState('30');
  const [scheduleStartDate, setScheduleStartDate] = useState<Date | undefined>(undefined);
  const [scheduleEndDate, setScheduleEndDate] = useState<Date | undefined>(undefined);
  const [hasDriveCredentials, setHasDriveCredentials] = useState(false);

  const shouldRedirect = !authLoading && role !== 'admin' && role !== 'super_admin';

  const fetchStorageStats = async () => {
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const { data, error } = await supabase.functions.invoke('get-storage-stats');
      if (error) throw error;
      setStorageStats(data);
    } catch (error: any) {
      console.error('Error fetching storage stats:', error);
      setStatsError('Não foi possível carregar as estatísticas');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchScheduleData = async () => {
    setIsLoadingSchedule(true);
    try {
      // Fetch schedule
      const { data: schedules } = await (supabase as any)
        .from('backup_schedules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (schedules && schedules.length > 0) {
        const s = schedules[0] as any;
        setSchedule(s);
        setScheduleFrequency(s.frequency || 'weekly');
        setScheduleCategories(s.categories || []);
        setScheduleActive(s.is_active || false);
        setScheduleTime(s.preferred_time || '02:00');
        if (s.period_start_date && s.period_end_date) {
          setSchedulePeriodDays('custom');
          setScheduleStartDate(parseISO(s.period_start_date));
          setScheduleEndDate(parseISO(s.period_end_date));
        } else {
          setSchedulePeriodDays(String(s.period_days || 30));
        }
      }

      // Fetch history
      const { data: historyData } = await (supabase as any)
        .from('backup_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (historyData) {
        setHistory(historyData as any[]);
      }

      // Check Google Drive credentials
      try {
        const { data: driveCheck } = await supabase.functions.invoke('scheduled-backup', {
          body: { action: 'check_drive' }
        });
        setHasDriveCredentials(driveCheck?.hasDriveCredentials ?? false);
      } catch {
        setHasDriveCredentials(false);
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  useEffect(() => {
    fetchStorageStats();
    fetchScheduleData();
  }, []);

  const getCategoryStats = (categoryId: string): string | null => {
    if (!storageStats) return null;
    
    if (categoryId === 'photos') {
      const storage = storageStats.storage;
      if (storage.totalFiles === 0) return null;
      return `${storage.totalFiles} arq • ${storage.totalSizeFormatted}`;
    }

    if (categoryId === 'reports_pdf') {
      const stats = storageStats.categories?.['reports_pdf'];
      if (!stats || stats.records === 0) return null;
      return `${stats.records} relatórios`;
    }

    if (categoryId === 'signed_pdfs') {
      const stats = storageStats.categories?.['signed_pdfs'];
      if (!stats || stats.records === 0) return null;
      return `${stats.records} documento${stats.records > 1 ? 's' : ''}`;
    }
    
    const stats = storageStats.categories?.[categoryId];
    if (!stats || stats.records === 0) return null;
    return `${stats.records} registros`;
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleScheduleCategory = (categoryId: string) => {
    setScheduleCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const applyPreset = (preset: typeof PERIOD_PRESETS[0]) => {
    const { start, end } = preset.getValue();
    setStartDate(start);
    setEndDate(end);
  };

  const handleGenerateFullBackup = async () => {
    setSelectedCategories(BACKUP_CATEGORIES.map(c => c.id));
    setStartDate(undefined);
    setEndDate(undefined);
    // Use a timeout to ensure state updates before running
    setTimeout(() => {
      handleGenerateBackup(true);
    }, 100);
  };

  const handleGenerateBackup = async (isFull: boolean = false) => {
    const categoriesToUse = isFull ? BACKUP_CATEGORIES.map(c => c.id) : selectedCategories;
    
    if (categoriesToUse.length === 0) {
      toast({
        title: 'Selecione ao menos uma categoria',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressMessage('Iniciando backup...');
    setPdfProgress(null);

    const downloadedMediaFiles: DownloadedFileInfo[] = [];
    let pdfStats = { count: 0, totalSize: 0 };
    let signedPdfStats = { count: 0, totalSize: 0 };
    let backupManifest: Record<string, any> = {};

    try {
      const includesPdfExport = selectedCategories.includes('reports_pdf');
      const regularCategories = selectedCategories.filter(cat => cat !== 'reports_pdf');
      
      let baseZipBlob: Blob | null = null;
      let baseFileName = '';

      if (regularCategories.length > 0) {
        const tablesToExport = BACKUP_CATEGORIES
          .filter(cat => regularCategories.includes(cat.id))
          .flatMap(cat => cat.tables);

        setProgress(10);
        const includePhotos = regularCategories.includes('photos');
        setProgressMessage(includePhotos ? 'Coletando dados...' : 'Coletando dados...');

        const { data, error } = await supabase.functions.invoke('generate-backup', {
          body: { 
            tables: tablesToExport,
            categories: regularCategories,
            includePhotos,
            startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
            endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
          },
        });

        if (error) throw error;

        backupManifest = data.manifest || {};

        const byteCharacters = atob(data.fileContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        baseZipBlob = new Blob([byteArray], { type: 'application/zip' });
        baseFileName = data.fileName || `backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`;

        if (includePhotos && data.fileMetadata) {
          setProgressMessage('Baixando arquivos de mídia...');
          
          const zip = await JSZip.loadAsync(baseZipBlob);
          const filesFolder = zip.folder('files');
          
          const allFiles: Array<{id: string, url: string, folder: string}> = [];
          for (const [folder, files] of Object.entries(data.fileMetadata as Record<string, Array<{id: string, url: string}>>)) {
            for (const file of files) {
              allFiles.push({ ...file, folder });
            }
          }
          
          const totalFiles = allFiles.length;
          let downloadedCount = 0;
          let failedCount = 0;
          
          const batchSize = 5;
          for (let i = 0; i < allFiles.length; i += batchSize) {
            const batch = allFiles.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (file) => {
              try {
                const response = await fetch(file.url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const blob = await response.blob();
                const fileName = file.url.split('/').pop()?.split('?')[0] || 'file';
                const fullName = `${file.id}_${fileName}`;
                
                downloadedMediaFiles.push({
                  name: fullName,
                  size: blob.size,
                  folder: file.folder,
                });
                
                filesFolder?.folder(file.folder)?.file(fullName, blob);
                downloadedCount++;
              } catch (err) {
                console.warn(`Failed to download ${file.url}:`, err);
                failedCount++;
              }
            }));
            
            setProgress(15 + Math.round((downloadedCount / totalFiles) * 15));
            setProgressMessage(`Baixando arquivos: ${downloadedCount}/${totalFiles}...`);
          }
          
          if (failedCount > 0) {
            console.warn(`${failedCount} files failed to download`);
          }
          
          baseZipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          });
        }
      }

      if (includesPdfExport) {
        setProgress(30);
        setProgressMessage('Buscando relatórios para gerar PDFs...');

        let reportsQuery = supabase
          .from('reports')
          .select(`
            id,
            date,
            rdo_number,
            status,
            project:projects(
              id,
              name,
              site:sites(
                id,
                name,
                company:companies(
                  id,
                  name
                )
              )
            )
          `)
          .order('date', { ascending: false });

        // Apply date filter for PDFs too
        if (startDate) reportsQuery = reportsQuery.gte('date', format(startDate, 'yyyy-MM-dd'));
        if (endDate) reportsQuery = reportsQuery.lte('date', format(endDate, 'yyyy-MM-dd'));

        const { data: reports, error: reportsError } = await reportsQuery;

        if (reportsError) throw reportsError;

        if (!reports || reports.length === 0) {
          toast({
            title: 'Nenhum relatório encontrado',
            description: 'Não há RDOs para exportar como PDF',
            variant: 'destructive',
          });
          if (!baseZipBlob) {
            setIsGenerating(false);
            return;
          }
        } else {
          const tenantColors = await fetchTenantColors();

          const zip = baseZipBlob 
            ? await JSZip.loadAsync(baseZipBlob)
            : new JSZip();

          const total = reports.length;
          let current = 0;

          for (const report of reports) {
            current++;
            const projectData = report.project as any;
            
            if (!projectData?.site?.company) {
              console.warn('Relatório sem hierarquia completa:', report.id);
              continue;
            }

            const companyName = sanitizeName(projectData.site.company.name || 'Empresa');
            const siteName = sanitizeName(projectData.site.name || 'Unidade');
            const projectName = sanitizeName(projectData.name || 'Projeto');
            const reportDate = parseISO(report.date);
            const year = format(reportDate, 'yyyy');
            const monthIndex = reportDate.getMonth();
            const monthName = MONTH_NAMES[monthIndex];
            const rdoNumber = formatRdoNumber(report.rdo_number ?? 1);
            const dateFormatted = format(reportDate, 'dd-MM-yyyy');

            const folderPath = `RDOs/${companyName}/${siteName}/${year}/${monthName}/${projectName}`;
            const fileName = `RDO-${rdoNumber}_${dateFormatted}.pdf`;

            setPdfProgress({
              current,
              total,
              currentReportName: `RDO-${rdoNumber}`,
              currentFolder: `${companyName} / ${siteName} / ${projectName}`,
            });
            setProgress(30 + Math.round((current / total) * 60));
            setProgressMessage(`Gerando PDF ${current} de ${total}...`);

            const reportData = await fetchReportForPdf(report.id);
            if (!reportData) continue;

            try {
              const pdfBlob = await generateReportPdfAsBlob(
                reportData.report as any,
                reportData.company as any,
                reportData.site as any,
                reportData.project as any,
                reportData.signatures,
                tenantColors
              );

              pdfStats.count++;
              pdfStats.totalSize += pdfBlob.size;

              zip.file(`${folderPath}/${fileName}`, pdfBlob);
            } catch (pdfError) {
              console.error('Erro ao gerar PDF:', report.id, pdfError);
            }
          }

          setProgress(95);
          setProgressMessage('Finalizando arquivo ZIP...');
          
          baseZipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          });
          baseFileName = `backup_completo_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`;
        }
      }

      // Download signed PDFs
      const includesSignedExport = selectedCategories.includes('signed_pdfs');
      if (includesSignedExport) {
        setProgressMessage('Buscando RDOs assinados...');

        const { data: signedReports, error: signedError } = await supabase
          .from('reports')
          .select(`
            id, rdo_number, date, signed_pdf_url,
            project:projects(
              name,
              site:sites(
                name,
                company:companies(name)
              )
            )
          `)
          .eq('status', 'signed')
          .not('signed_pdf_url', 'is', null);

        if (signedError) {
          console.error('Erro ao buscar relatórios assinados:', signedError);
        } else if (signedReports && signedReports.length > 0) {
          const zip = baseZipBlob
            ? await JSZip.loadAsync(baseZipBlob)
            : new JSZip();

          const rdosAssinadosFolder = zip.folder('RDOs_Assinados');
          const total = signedReports.length;
          let current = 0;
          let downloadedCount = 0;

          for (const r of signedReports as any[]) {
            current++;
            const companyName = sanitizeName(r?.project?.site?.company?.name || 'Empresa');
            const siteName = sanitizeName(r?.project?.site?.name || 'Unidade');
            const projectName = sanitizeName(r?.project?.name || 'Projeto');

            const reportDate = r?.date ? parseISO(r.date) : new Date();
            const year = format(reportDate, 'yyyy');
            const monthIndex = reportDate.getMonth();
            const monthName = MONTH_NAMES[monthIndex];
            const fileName = `RDO_${(r.rdo_number ?? 0).toString().padStart(3, '0')}_${format(reportDate, 'yyyy-MM-dd')}.pdf`;

            setProgressMessage(`Baixando PDF assinado ${current}/${total}...`);
            setPdfProgress({
              current,
              total,
              currentReportName: fileName,
              currentFolder: `${companyName} / ${siteName} / ${projectName}`,
            });

            try {
              const res = await fetch(r.signed_pdf_url);
              if (!res.ok) {
                console.warn(`Falha ao baixar PDF assinado ${r.id}`);
                continue;
              }
              const buf = await res.arrayBuffer();
              const byteArray = new Uint8Array(buf);

              rdosAssinadosFolder
                ?.folder(companyName)
                ?.folder(siteName)
                ?.folder(year)
                ?.folder(monthName)
                ?.folder(projectName)
                ?.file(fileName, byteArray);

              signedPdfStats.count++;
              signedPdfStats.totalSize += byteArray.length;
              downloadedCount++;
            } catch (err) {
              console.error(`Erro ao baixar PDF assinado ${r.id}:`, err);
            }
          }

          if (downloadedCount > 0) {
            setProgress(95);
            setProgressMessage('Finalizando arquivo ZIP com RDOs assinados...');

            baseZipBlob = await zip.generateAsync({
              type: 'blob',
              compression: 'DEFLATE',
              compressionOptions: { level: 6 }
            });
            baseFileName = `backup_completo_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`;
          }
        }
      }

      if (!baseZipBlob) {
        throw new Error('Nenhum dado para exportar');
      }

      // Generate backup report
      setProgressMessage('Gerando relatório do backup...');
      const zip = await JSZip.loadAsync(baseZipBlob);
      const reportContent = generateBackupReportText(
        backupManifest,
        downloadedMediaFiles,
        pdfStats,
        signedPdfStats
      );
      zip.file('relatorio-backup.txt', reportContent);
      
      baseZipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Download
      const url = window.URL.createObjectURL(baseZipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = baseFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress(100);
      setProgressMessage('Backup concluído!');
      setPdfProgress(null);

      toast({
        title: 'Backup gerado com sucesso!',
        description: `Arquivo: ${baseFileName}`,
      });

    } catch (error: any) {
      console.error('Backup error:', error);
      toast({
        title: 'Erro ao gerar backup',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        setProgressMessage('');
        setPdfProgress(null);
      }, 2000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast({
          title: 'Arquivo inválido',
          description: 'Por favor, selecione um arquivo .zip de backup',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      toast({ title: 'Selecione um arquivo', variant: 'destructive' });
      return;
    }

    setIsRestoring(true);
    setProgress(0);
    setProgressMessage('Lendo arquivo...');

    try {
      const zip = await JSZip.loadAsync(selectedFile);
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) throw new Error('Arquivo de backup inválido: manifest.json não encontrado');
      
      const manifest = JSON.parse(await manifestFile.async('string'));

      // Ordem dos parents -> children
      const TABLE_ORDER = [
        'system_settings','tenant_settings','client_portal_settings',
        'companies','company_contacts','contact_sites','sites','site_responsibles',
        'portal_admin_access','profiles','user_roles',
        'client_profiles','client_companies','client_sites','client_user_roles',
        'client_wallet','client_wallet_transactions',
        'rewards_catalog','reward_redemptions',
        'teams','team_members',
        'projects','project_stages','project_tasks','project_equipment','project_milestones','project_members',
        'reports','report_activities','report_activity_steps','report_attendance','report_deviations',
        'report_equipment','report_photos','report_signatures','report_history',
        'report_company_approvers','report_client_approvers',
        'autentique_documents','autentique_signatures','clicksign_documents',
        'service_reports','service_report_sections','service_report_photos',
        'notifications','feature_suggestions','suggestion_votes','delay_reasons',
        'backup_schedules','backup_history'
      ];

      const BATCH_SIZE = 200;
      let totalRecords = 0;
      const errors: string[] = [];

      // ============ FASE 1: DADOS (lotes pequenos via edge function) ============
      setProgress(5);
      setProgressMessage('Restaurando dados...');

      for (let t = 0; t < TABLE_ORDER.length; t++) {
        const tableName = TABLE_ORDER[t];
        const dataFile = zip.file(`data/${tableName}.json`);
        if (!dataFile) continue;

        let records: any[] = [];
        try {
          const txt = await dataFile.async('string');
          records = JSON.parse(txt);
        } catch (e) {
          errors.push(`Falha ao ler ${tableName}.json`);
          continue;
        }
        if (!Array.isArray(records) || records.length === 0) continue;

        const totalBatches = Math.ceil(records.length / BATCH_SIZE);
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
          setProgressMessage(`Dados: ${tableName} (${currentBatch}/${totalBatches})`);

          const { data: res, error: err } = await supabase.functions.invoke('restore-backup', {
            body: { action: 'batch', table: tableName, records: batch },
          });

          if (err || (res as any)?.error) {
            const msg = (res as any)?.error || err?.message || 'erro';
            errors.push(`${tableName}: ${msg}`);
            console.error(`Erro ${tableName}:`, msg);
          } else {
            totalRecords += (res as any)?.recordsImported || batch.length;
          }
        }

        setProgress(5 + Math.round(((t + 1) / TABLE_ORDER.length) * 40));
      }

      // ============ FASE 2: ARQUIVOS DE MÍDIA ============
      setProgress(45);
      setProgressMessage('Restaurando arquivos de mídia...');

      let filesRestored = 0;
      let filesFailed = 0;

      const filesFolder = zip.folder('files');
      if (filesFolder) {
        // Descobre buckets presentes no ZIP
        const bucketsInZip = new Set<string>();
        filesFolder.forEach((rel, fileObj) => {
          if (fileObj.dir) return;
          const parts = rel.split('/');
          if (parts.length >= 2) bucketsInZip.add(parts[0]);
        });

        const allFileEntries: { bucket: string; path: string; file: JSZip.JSZipObject }[] = [];
        filesFolder.forEach((rel, fileObj) => {
          if (fileObj.dir) return;
          const parts = rel.split('/');
          if (parts.length < 2) return;
          const bucket = parts[0];
          const path = parts.slice(1).join('/');
          allFileEntries.push({ bucket, path, file: fileObj });
        });

        const totalFiles = allFileEntries.length;
        for (let i = 0; i < allFileEntries.length; i++) {
          const { bucket, path, file } = allFileEntries[i];
          try {
            const blob = await file.async('blob');
            const { error: upErr } = await supabase.storage
              .from(bucket)
              .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
            if (upErr) {
              filesFailed++;
              console.warn(`Falha ${bucket}/${path}:`, upErr.message);
            } else {
              filesRestored++;
            }
          } catch (e: any) {
            filesFailed++;
            console.warn(`Erro ${bucket}/${path}:`, e.message);
          }

          if (i % 10 === 0 || i === totalFiles - 1) {
            setProgress(45 + Math.round(((i + 1) / Math.max(totalFiles, 1)) * 35));
            setProgressMessage(`Mídia: ${i + 1}/${totalFiles} (${filesRestored} ok, ${filesFailed} falhas)`);
          }
        }
      }

      // ============ FASE 3: PDFs (RDOs e RDOs_Assinados) ============
      setProgress(80);
      setProgressMessage('Restaurando PDFs...');

      let pdfsRestored = 0;
      const pdfTargets: { folder: string; bucket: string }[] = [
        { folder: 'RDOs', bucket: 'report-pdfs' },
        { folder: 'RDOs_Assinados', bucket: 'report-pdfs' },
      ];

      for (const { folder, bucket } of pdfTargets) {
        const root = zip.folder(folder);
        if (!root) continue;
        const entries: { path: string; file: JSZip.JSZipObject }[] = [];
        root.forEach((rel, fileObj) => {
          if (fileObj.dir) return;
          entries.push({ path: `${folder}/${rel}`, file: fileObj });
        });

        const total = entries.length;
        for (let i = 0; i < total; i++) {
          try {
            const blob = await entries[i].file.async('blob');
            const { error: upErr } = await supabase.storage
              .from(bucket)
              .upload(entries[i].path, blob, { upsert: true, contentType: 'application/pdf' });
            if (!upErr) pdfsRestored++;
            else console.warn(`PDF ${entries[i].path}:`, upErr.message);
          } catch (e: any) {
            console.warn(`PDF erro ${entries[i].path}:`, e.message);
          }

          if (i % 5 === 0 || i === total - 1) {
            setProgressMessage(`PDFs ${folder}: ${i + 1}/${total}`);
          }
        }
      }

      setProgress(100);
      setProgressMessage('Restauração concluída!');

      const errSummary = errors.length > 0
        ? ` (${errors.length} erro(s) em tabelas — veja o console)`
        : '';

      toast({
        title: 'Backup restaurado!',
        description: `${totalRecords} registros, ${filesRestored} mídias, ${pdfsRestored} PDFs.${errSummary}`,
      });

      if (errors.length > 0) console.error('Erros de importação:', errors);

      setSelectedFile(null);
    } catch (error: any) {
      console.error('Restore error:', error);
      toast({
        title: 'Erro ao restaurar backup',
        description: error.message || 'Verifique se o arquivo é válido',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setIsRestoring(false);
        setProgress(0);
        setProgressMessage('');
      }, 3000);
    }
  };

  // ============ Importar a partir de uma PASTA descompactada ============
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    // Confere se tem manifest.json em algum lugar (normalmente na raiz)
    const hasManifest = files.some(f => {
      const rel = (f as any).webkitRelativePath || f.name;
      return rel.endsWith('manifest.json');
    });
    if (!hasManifest) {
      toast({
        title: 'Pasta inválida',
        description: 'A pasta selecionada não contém manifest.json. Selecione a pasta raiz do backup.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedFolderFiles(files);
  };

  const handleRestoreFolder = async () => {
    if (!selectedFolderFiles || selectedFolderFiles.length === 0) {
      toast({ title: 'Selecione uma pasta', variant: 'destructive' });
      return;
    }

    setIsRestoring(true);
    setProgress(0);
    setProgressMessage('Lendo pasta...');

    try {
      // Indexar arquivos pelo caminho relativo dentro da pasta raiz
      // webkitRelativePath = "raiz/data/foo.json", "raiz/files/bucket/x.jpg", etc.
      const entries = selectedFolderFiles.map(f => {
        const rel = ((f as any).webkitRelativePath as string) || f.name;
        const parts = rel.split('/');
        // remove a primeira pasta (raiz escolhida pelo usuário)
        const innerPath = parts.slice(1).join('/');
        return { file: f, innerPath };
      });

      const TABLE_ORDER = [
        'system_settings','tenant_settings','client_portal_settings',
        'companies','company_contacts','contact_sites','sites','site_responsibles',
        'portal_admin_access','profiles','user_roles',
        'client_profiles','client_companies','client_sites','client_user_roles',
        'client_wallet','client_wallet_transactions',
        'rewards_catalog','reward_redemptions',
        'teams','team_members',
        'projects','project_stages','project_tasks','project_equipment','project_milestones','project_members',
        'reports','report_activities','report_activity_steps','report_attendance','report_deviations',
        'report_equipment','report_photos','report_signatures','report_history',
        'report_company_approvers','report_client_approvers',
        'autentique_documents','autentique_signatures','clicksign_documents',
        'service_reports','service_report_sections','service_report_photos',
        'notifications','feature_suggestions','suggestion_votes','delay_reasons',
        'backup_schedules','backup_history'
      ];

      const BATCH_SIZE = 200;
      let totalRecords = 0;
      const errors: string[] = [];

      // ============ FASE 1: DADOS ============
      setProgress(5);
      setProgressMessage('Restaurando dados...');

      for (let t = 0; t < TABLE_ORDER.length; t++) {
        const tableName = TABLE_ORDER[t];
        const entry = entries.find(e => e.innerPath === `data/${tableName}.json`);
        if (!entry) continue;

        let records: any[] = [];
        try {
          const txt = await entry.file.text();
          records = JSON.parse(txt);
        } catch (e) {
          errors.push(`Falha ao ler ${tableName}.json`);
          continue;
        }
        if (!Array.isArray(records) || records.length === 0) continue;

        const totalBatches = Math.ceil(records.length / BATCH_SIZE);
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
          setProgressMessage(`Dados: ${tableName} (${currentBatch}/${totalBatches})`);

          const { data: res, error: err } = await supabase.functions.invoke('restore-backup', {
            body: { action: 'batch', table: tableName, records: batch },
          });

          if (err || (res as any)?.error) {
            const msg = (res as any)?.error || err?.message || 'erro';
            errors.push(`${tableName}: ${msg}`);
            console.error(`Erro ${tableName}:`, msg);
          } else {
            totalRecords += (res as any)?.recordsImported || batch.length;
          }
        }

        setProgress(5 + Math.round(((t + 1) / TABLE_ORDER.length) * 40));
      }

      // ============ FASE 2: MÍDIA (files/<bucket>/...) ============
      setProgress(45);
      setProgressMessage('Restaurando arquivos de mídia...');

      let filesRestored = 0;
      let filesFailed = 0;

      const mediaEntries = entries.filter(e => e.innerPath.startsWith('files/'));
      for (let i = 0; i < mediaEntries.length; i++) {
        const { file, innerPath } = mediaEntries[i];
        const rest = innerPath.substring('files/'.length); // "bucket/path/file.jpg"
        const slash = rest.indexOf('/');
        if (slash < 0) continue;
        const bucket = rest.substring(0, slash);
        const objectPath = rest.substring(slash + 1);

        try {
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(objectPath, file, {
              upsert: true,
              contentType: file.type || undefined,
            });
          if (upErr) {
            filesFailed++;
            console.warn(`Falha ${bucket}/${objectPath}:`, upErr.message);
          } else {
            filesRestored++;
          }
        } catch (e: any) {
          filesFailed++;
          console.warn(`Erro ${bucket}/${objectPath}:`, e.message);
        }

        if (i % 10 === 0 || i === mediaEntries.length - 1) {
          setProgress(45 + Math.round(((i + 1) / Math.max(mediaEntries.length, 1)) * 35));
          setProgressMessage(`Mídia: ${i + 1}/${mediaEntries.length} (${filesRestored} ok, ${filesFailed} falhas)`);
        }
      }

      // ============ FASE 3: PDFs (RDOs e RDOs_Assinados → report-pdfs) ============
      setProgress(80);
      setProgressMessage('Restaurando PDFs...');

      let pdfsRestored = 0;
      const pdfFolders = ['RDOs', 'RDOs_Assinados'];
      for (const root of pdfFolders) {
        const pdfEntries = entries.filter(e => e.innerPath.startsWith(`${root}/`));
        for (let i = 0; i < pdfEntries.length; i++) {
          const { file, innerPath } = pdfEntries[i];
          try {
            const { error: upErr } = await supabase.storage
              .from('report-pdfs')
              .upload(innerPath, file, { upsert: true, contentType: 'application/pdf' });
            if (!upErr) pdfsRestored++;
            else console.warn(`PDF ${innerPath}:`, upErr.message);
          } catch (e: any) {
            console.warn(`PDF erro ${innerPath}:`, e.message);
          }
          if (i % 5 === 0 || i === pdfEntries.length - 1) {
            setProgressMessage(`PDFs ${root}: ${i + 1}/${pdfEntries.length}`);
          }
        }
      }

      setProgress(100);
      setProgressMessage('Restauração concluída!');

      const errSummary = errors.length > 0
        ? ` (${errors.length} erro(s) em tabelas — veja o console)`
        : '';

      toast({
        title: 'Backup restaurado!',
        description: `${totalRecords} registros, ${filesRestored} mídias, ${pdfsRestored} PDFs.${errSummary}`,
      });

      if (errors.length > 0) console.error('Erros de importação:', errors);

      setSelectedFolderFiles(null);
    } catch (error: any) {
      console.error('Restore folder error:', error);
      toast({
        title: 'Erro ao restaurar pasta',
        description: error.message || 'Verifique se a pasta é válida',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setIsRestoring(false);
        setProgress(0);
        setProgressMessage('');
      }, 3000);
    }
  };

  const handleSaveSchedule = async () => {
    // placeholder anchor - replaced below
    void 0;
    return await _handleSaveScheduleImpl();
  };

  const _handleSaveScheduleImpl = async () => {
    setIsSavingSchedule(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id || '')
        .single();

      const isCustomPeriod = schedulePeriodDays === 'custom';
      const scheduleData: Record<string, any> = {
        frequency: scheduleFrequency as 'daily' | 'weekly' | 'monthly',
        categories: scheduleCategories as any,
        include_photos: scheduleCategories.includes('photos'),
        include_pdfs: scheduleCategories.includes('reports_pdf'),
        preferred_time: scheduleTime,
        period_days: isCustomPeriod ? null : (parseInt(schedulePeriodDays) || 30),
        period_start_date: isCustomPeriod && scheduleStartDate ? format(scheduleStartDate, 'yyyy-MM-dd') : null,
        period_end_date: isCustomPeriod && scheduleEndDate ? format(scheduleEndDate, 'yyyy-MM-dd') : null,
        is_active: scheduleActive,
        created_by: user?.id,
        company_id: profile?.company_id,
        next_run_at: scheduleActive ? calculateNextRunDate(scheduleFrequency, scheduleTime) : null,
      };

      if (schedule?.id) {
        const { error } = await (supabase as any)
          .from('backup_schedules')
          .update(scheduleData)
          .eq('id', schedule.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('backup_schedules')
          .insert(scheduleData);
        if (error) throw error;
      }

      toast({ title: 'Agendamento salvo com sucesso!' });
      fetchScheduleData();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const calculateNextRunDate = (freq: string, time: string = '02:00'): string => {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    let next: Date;
    switch (freq) {
      case 'daily': next = new Date(now.getTime() + 86400000); break;
      case 'weekly': next = new Date(now.getTime() + 7 * 86400000); break;
      case 'monthly': {
        next = new Date(now);
        next.setMonth(next.getMonth() + 1);
        break;
      }
      default: next = new Date(now.getTime() + 7 * 86400000);
    }
    next.setHours(hours, minutes, 0, 0);
    return next.toISOString();
  };

  const handleRunNow = async () => {
    if (!schedule?.id) {
      toast({ title: 'Salve o agendamento primeiro', variant: 'destructive' });
      return;
    }

    setIsRunningManual(true);
    try {
      const includesPdf = scheduleCategories.includes('reports_pdf');
      const includesSignedPdfs = scheduleCategories.includes('signed_pdfs');

      // Run the server-side backup (data categories)
      setProgress(5);
      setProgressMessage('Executando backup de dados...');
      const { data, error } = await supabase.functions.invoke('scheduled-backup', {
        body: { action: 'run_now', scheduleId: schedule.id },
      });

      if (error) throw error;

      // If we need PDFs or signed PDFs, build a unified ZIP
      if (includesPdf || includesSignedPdfs) {
        setProgress(10);
        setProgressMessage('Preparando ZIP unificado...');
        setPdfProgress(null);

        // Try to download the server-generated backup to merge into it
        let zip: JSZip;
        let hasServerData = false;

        if (data?.filePath) {
          try {
            const { data: dlData } = await supabase.functions.invoke('scheduled-backup', {
              body: { action: 'download', filePath: data.filePath },
            });
            if (dlData?.url) {
              const resp = await fetch(dlData.url);
              if (resp.ok) {
                const serverBlob = await resp.blob();
                zip = await JSZip.loadAsync(serverBlob);
                hasServerData = true;
              } else {
                zip = new JSZip();
              }
            } else {
              zip = new JSZip();
            }
          } catch {
            zip = new JSZip();
          }
        } else {
          zip = new JSZip();
        }

        const periodDays = schedule.period_days || 30;
        const pdfEndDate = new Date();
        const pdfStartDate = subDays(pdfEndDate, periodDays);

        const pdfStats = { count: 0, totalSize: 0 };
        const signedPdfStats = { count: 0, totalSize: 0 };

        // Generate RDO PDFs
        if (includesPdf) {
          const { data: reports, error: reportsError } = await supabase
            .from('reports')
            .select(`
              id, date, rdo_number, status,
              project:projects(
                id, name,
                site:sites(
                  id, name,
                  company:companies(id, name)
                )
              )
            `)
            .gte('date', format(pdfStartDate, 'yyyy-MM-dd'))
            .lte('date', format(pdfEndDate, 'yyyy-MM-dd'))
            .order('date', { ascending: false });

          if (reportsError) throw reportsError;

          if (reports && reports.length > 0) {
            const tenantColors = await fetchTenantColors();
            const total = reports.length;
            let current = 0;

            for (const report of reports) {
              current++;
              const projectData = report.project as any;
              if (!projectData?.site?.company) continue;

              const companyName = sanitizeName(projectData.site.company.name || 'Empresa');
              const siteName = sanitizeName(projectData.site.name || 'Unidade');
              const projectName = sanitizeName(projectData.name || 'Projeto');
              const reportDate = parseISO(report.date);
              const year = format(reportDate, 'yyyy');
              const monthIndex = reportDate.getMonth();
              const monthName = MONTH_NAMES[monthIndex];
              const rdoNumber = formatRdoNumber(report.rdo_number ?? 1);
              const dateFormatted = format(reportDate, 'dd-MM-yyyy');

              const folderPath = `RDOs/${companyName}/${siteName}/${year}/${monthName}/${projectName}`;
              const fileName = `RDO-${rdoNumber}_${dateFormatted}.pdf`;

              setPdfProgress({
                current,
                total,
                currentReportName: `RDO-${rdoNumber}`,
                currentFolder: `${companyName} / ${siteName} / ${projectName}`,
              });
              setProgress(10 + Math.round((current / total) * 50));
              setProgressMessage(`Gerando PDF ${current} de ${total}...`);

              const reportFullData = await fetchReportForPdf(report.id);
              if (!reportFullData) continue;

              try {
                const pdfBlob = await generateReportPdfAsBlob(
                  reportFullData.report as any,
                  reportFullData.company as any,
                  reportFullData.site as any,
                  reportFullData.project as any,
                  reportFullData.signatures,
                  tenantColors
                );
                zip.file(`${folderPath}/${fileName}`, pdfBlob);
                pdfStats.count++;
                pdfStats.totalSize += (pdfBlob as Blob).size || 0;
              } catch (pdfError) {
                console.error('Erro ao gerar PDF:', report.id, pdfError);
              }
            }
          }
        }

        // Download signed PDFs
        if (includesSignedPdfs) {
          setProgressMessage('Buscando documentos assinados...');
          setProgress(65);

          const { data: signedReports, error: signedError } = await supabase
            .from('reports')
            .select(`
              id, rdo_number, date, signed_pdf_url,
              project:projects(
                name,
                site:sites(
                  name,
                  company:companies(name)
                )
              )
            `)
            .eq('status', 'signed')
            .not('signed_pdf_url', 'is', null);

          if (signedError) {
            console.error('Erro ao buscar relatórios assinados:', signedError);
          } else if (signedReports && signedReports.length > 0) {
            const total = signedReports.length;
            let current = 0;

            for (const r of signedReports as any[]) {
              current++;
              const companyName = sanitizeName(r?.project?.site?.company?.name || 'Empresa');
              const siteName = sanitizeName(r?.project?.site?.name || 'Unidade');
              const projectName = sanitizeName(r?.project?.name || 'Projeto');
              const reportDate = r?.date ? parseISO(r.date) : new Date();
              const year = format(reportDate, 'yyyy');
              const monthIndex = reportDate.getMonth();
              const monthName = MONTH_NAMES[monthIndex];
              const fileName = `RDO_${(r.rdo_number ?? 0).toString().padStart(3, '0')}_${format(reportDate, 'yyyy-MM-dd')}.pdf`;

              setProgressMessage(`Baixando PDF assinado ${current}/${total}...`);
              setPdfProgress({
                current,
                total,
                currentReportName: fileName,
                currentFolder: `${companyName} / ${siteName} / ${projectName}`,
              });
              setProgress(65 + Math.round((current / total) * 25));

              try {
                const res = await fetch(r.signed_pdf_url);
                if (!res.ok) {
                  console.warn(`Falha ao baixar PDF assinado ${r.id}`);
                  continue;
                }
                const buf = await res.arrayBuffer();
                const byteArray = new Uint8Array(buf);

                zip
                  .folder('RDOs_Assinados')
                  ?.folder(companyName)
                  ?.folder(siteName)
                  ?.folder(year)
                  ?.folder(monthName)
                  ?.folder(projectName)
                  ?.file(fileName, byteArray);

                signedPdfStats.count++;
                signedPdfStats.totalSize += byteArray.length;
              } catch (err) {
                console.error(`Erro ao baixar PDF assinado ${r.id}:`, err);
              }
            }
          }
        }

        // Generate unified ZIP
        setProgress(95);
        setProgressMessage('Finalizando ZIP unificado...');

        const finalBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        });

        const finalFileName = `backup_completo_${format(new Date(), 'yyyyMMdd_HHmmss')}.zip`;

        // Upload to storage
        await supabase.storage
          .from('admin-exports')
          .upload(`backups/${finalFileName}`, finalBlob, {
            contentType: 'application/zip',
            upsert: true,
          });

        // Download for the user
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFileName;
        a.click();
        URL.revokeObjectURL(url);

        setProgress(100);
        setProgressMessage('');
        setPdfProgress(null);
      }

      toast({
        title: 'Backup executado!',
        description: (includesPdf || includesSignedPdfs)
          ? 'Dados exportados e PDFs gerados em ZIP único'
          : data.driveFileUrl ? 'Enviado para o Google Drive' : 'Salvo no storage interno',
      });
      fetchScheduleData();
    } catch (error: any) {
      toast({ title: 'Erro ao executar', description: error.message, variant: 'destructive' });
    } finally {
      setIsRunningManual(false);
      setProgress(0);
      setProgressMessage('');
      setPdfProgress(null);
    }
  };

  const handleDownloadHistory = async (filePath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-backup', {
        body: { action: 'download', filePath },
      });

      if (error) throw error;

      window.open(data.url, '_blank');
    } catch (error: any) {
      toast({ title: 'Erro ao baixar', description: error.message, variant: 'destructive' });
    }
  };

  if (shouldRedirect) {
    return <Navigate to="/home" replace />;
  }

  if (authLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <HardDrive className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Backup do Sistema</h1>
          <p className="text-muted-foreground">
            Exporte, importe ou agende backups automáticos
          </p>
        </div>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="export" className="gap-2">
            <Upload className="h-4 w-4" />
            Exportar
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Clock className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Download className="h-4 w-4" />
            Importar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4 mt-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Backup Completo do Sistema</CardTitle>
              </div>
              <CardDescription>
                Gera um arquivo único com todos os dados, fotos, configurações e RDOs assinados de todas as instâncias. Ideal para migração ou recuperação total.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleGenerateFullBackup} 
                disabled={isGenerating}
                className="w-full sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando Backup Completo...
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-4 w-4 mr-2" />
                    Gerar Backup Completo (Tudo)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gerar Backup</CardTitle>
              <CardDescription>
                Selecione as categorias de dados que deseja incluir no backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Period Filter */}
              <Collapsible open={periodOpen} onOpenChange={setPeriodOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>
                        {startDate || endDate
                          ? `${startDate ? format(startDate, 'dd/MM/yyyy') : '...'} — ${endDate ? format(endDate, 'dd/MM/yyyy') : '...'}`
                          : 'Filtrar por Período (opcional)'}
                      </span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${periodOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PERIOD_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className="text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Data Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, 'dd/MM/yyyy') : 'Selecionar'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, 'dd/MM/yyyy') : 'Selecionar'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {(startDate || endDate) && (
                    <Button variant="ghost" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
                      Limpar filtro
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {statsError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{statsError}</span>
                    <Button variant="outline" size="sm" onClick={fetchStorageStats} disabled={isLoadingStats}>
                      {isLoadingStats ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      <span className="ml-1">Tentar novamente</span>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid gap-3">
                {BACKUP_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const isSelected = selectedCategories.includes(category.id);
                  const statsText = getCategoryStats(category.id);
                  
                  return (
                    <div
                      key={category.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleCategory(category.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <p className="font-medium">{category.label}</p>
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                        {category.id === 'reports_pdf' && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            Empresa → Unidade → Ano → Mês → Projeto
                          </p>
                        )}
                      </div>
                      {isLoadingStats ? (
                        <Skeleton className="h-5 w-20" />
                      ) : statsText ? (
                        <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                          {statsText}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {selectedCategories.includes('photos') && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="font-medium text-primary">Detalhes dos Arquivos</p>
                          {isLoadingStats ? (
                            <div className="flex items-center gap-2 mt-2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Calculando...</span>
                            </div>
                          ) : storageStats?.storage ? (
                            <>
                              <p className="text-2xl font-bold mt-1">
                                {storageStats.storage.totalFiles} arquivos • {storageStats.storage.totalSizeFormatted}
                              </p>
                              <div className="grid gap-1.5 mt-3">
                                {Object.entries(storageStats.storage.breakdown).map(([key, value]) => (
                                  <div key={key} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{value.label}</span>
                                    <span className="font-medium">{value.count} ({value.formatted})</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">Nenhum arquivo encontrado</p>
                          )}
                        </div>
                        <Alert className="bg-background/50">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            O download pode demorar alguns minutos dependendo do tamanho.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedCategories.includes('reports_pdf') && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <FolderOpen className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="font-medium text-amber-600">Geração de PDFs</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Cada RDO será convertido em PDF e organizado em pastas seguindo a hierarquia do sistema.
                          </p>
                        </div>
                        <Alert className="bg-background/50 border-amber-500/30">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-xs">
                            Este processo pode levar vários minutos dependendo da quantidade de relatórios.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isGenerating && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progressMessage}
                  </div>
                  <Progress value={progress} />
                  
                  {pdfProgress && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progresso dos PDFs:</span>
                        <span className="font-medium">{pdfProgress.current} de {pdfProgress.total}</span>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium">{pdfProgress.currentReportName}</p>
                        <p className="text-xs text-muted-foreground truncate">{pdfProgress.currentFolder}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button 
                onClick={() => handleGenerateBackup()} 
                disabled={isGenerating || selectedCategories.length === 0}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Gerar Backup
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCHEDULE TAB */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Backup Automático
              </CardTitle>
              <CardDescription>
                Configure backups periódicos com envio para Google Drive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle + Frequency */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Backup Automático</p>
                    <p className="text-sm text-muted-foreground">Executar backup periodicamente</p>
                  </div>
                </div>
                <Switch
                  checked={scheduleActive}
                  onCheckedChange={setScheduleActive}
                />
              </div>

              {scheduleActive && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Frequência</Label>
                      <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Horário preferido
                      </Label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Período dos Dados</Label>
                      <Select value={schedulePeriodDays} onValueChange={(v) => { setSchedulePeriodDays(v); if (v !== 'custom') { setScheduleStartDate(undefined); setScheduleEndDate(undefined); } }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Últimos 7 dias</SelectItem>
                          <SelectItem value="30">Últimos 30 dias</SelectItem>
                          <SelectItem value="90">Últimos 90 dias</SelectItem>
                          <SelectItem value="365">Último ano</SelectItem>
                          <SelectItem value="0">Todo o período</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                      {schedulePeriodDays === 'custom' && (
                        <div className="flex gap-2 mt-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduleStartDate ? format(scheduleStartDate, 'dd/MM/yyyy') : 'Data início'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={scheduleStartDate} onSelect={setScheduleStartDate} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                            </PopoverContent>
                          </Popover>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduleEndDate ? format(scheduleEndDate, 'dd/MM/yyyy') : 'Data fim'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={scheduleEndDate} onSelect={setScheduleEndDate} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="space-y-2">
                    <Label>Categorias a Incluir</Label>
                    <div className="grid gap-2">
                      {BACKUP_CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const isSelected = scheduleCategories.includes(category.id);
                        return (
                          <div
                            key={category.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                            }`}
                            onClick={() => toggleScheduleCategory(category.id)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleScheduleCategory(category.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <Icon className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div className="flex-1">
                              <span className="text-sm font-medium">{category.label}</span>
                              {(category.id === 'reports_pdf' || category.id === 'signed_pdfs') && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <FolderOpen className="h-3 w-3" />
                                  Empresa → Unidade → Ano → Mês → Projeto
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {(scheduleCategories.includes('reports_pdf') || scheduleCategories.includes('signed_pdfs')) && (
                        <Alert className="border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-xs text-amber-800">
                            PDFs são gerados ao clicar <strong>"Executar Agora"</strong>. No backup automático, apenas dados JSON são incluídos.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Google Drive Section */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <CloudUpload className="h-4 w-4" />
                  Google Drive
                </Label>
                <Card className="border-border">
                  <CardContent className="p-4">
                    {hasDriveCredentials ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium text-green-700">Conectado</p>
                          <p className="text-sm text-muted-foreground">Backups serão enviados automaticamente</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">Não configurado</p>
                            <p className="text-sm text-muted-foreground">
                              Para enviar backups ao Google Drive, configure uma Service Account do Google Cloud e adicione as credenciais como secret <code className="text-xs bg-muted px-1 rounded">GOOGLE_DRIVE_CREDENTIALS</code>.
                            </p>
                          </div>
                        </div>
                        <Alert>
                          <AlertDescription className="text-xs space-y-1">
                            <p><strong>Como configurar:</strong></p>
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>Crie uma Service Account no Google Cloud Console</li>
                              <li>Ative a Google Drive API</li>
                              <li>Baixe o JSON de credenciais</li>
                              <li>Compartilhe a pasta do Drive com o e-mail da Service Account</li>
                              <li>Adicione o JSON como secret GOOGLE_DRIVE_CREDENTIALS</li>
                            </ol>
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Save + Run buttons */}
              <div className="flex gap-3">
                <Button 
                  onClick={handleSaveSchedule} 
                  disabled={isSavingSchedule}
                  className="flex-1"
                >
                  {isSavingSchedule ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Salvar Agendamento
                </Button>
                {schedule?.id && (
                  <Button 
                    onClick={handleRunNow} 
                    disabled={isRunningManual}
                    variant="outline"
                  >
                    {isRunningManual ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Executar Agora
                  </Button>
                )}
              </div>

              {/* Schedule Info */}
              {schedule && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                      {schedule.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  {schedule.last_run_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Última execução:</span>
                      <span>{format(new Date(schedule.last_run_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                    </div>
                  )}
                  {schedule.next_run_at && schedule.is_active && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Próxima execução:</span>
                      <span>{format(new Date(schedule.next_run_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Backups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSchedule ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum backup automático executado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => {
                    const statusInfo = STATUS_LABELS[entry.status] || STATUS_LABELS.pending;
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          <div>
                            <p className="text-sm font-medium">
                              {format(new Date(entry.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                            {entry.file_size && (
                              <p className="text-xs text-muted-foreground">
                                {formatFileSizeLocal(entry.file_size)}
                              </p>
                            )}
                            {entry.error && (
                              <p className="text-xs text-destructive">{entry.error}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.drive_file_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={entry.drive_file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {entry.file_path && entry.status === 'completed' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDownloadHistory(entry.file_path!)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Backup Completo (.zip)</CardTitle>
              <CardDescription>
                Restaura o pacote ZIP gerado na aba Exportar com <strong>todos os conteúdos e dados</strong>:
                tabelas (<code>data/*.json</code>), fotos e arquivos de mídia (<code>files/&lt;bucket&gt;/</code>),
                RDOs em PDF (<code>RDOs/</code>), RDOs assinados (<code>RDOs_Assinados/</code>) e o <code>manifest.json</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> A restauração pode sobrescrever dados existentes. 
                  Recomendamos fazer um backup antes de prosseguir.
                </AlertDescription>
              </Alert>

              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFile ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="backup-file"
                />
                <label htmlFor="backup-file" className="cursor-pointer">
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-10 w-10 text-primary" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <p className="text-xs text-muted-foreground">Clique novamente para trocar de arquivo</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <CloudUpload className="h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Clique para selecionar o arquivo .zip</p>
                      <p className="text-sm text-muted-foreground">
                        Backup completo com tabelas, fotos e PDFs (gerado na aba Exportar)
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <div className="space-y-3">
                <Label>Modo de importação:</Label>
                <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as 'merge' | 'replace')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="merge" id="merge" />
                    <Label htmlFor="merge" className="cursor-pointer">
                      <span className="font-medium">Mesclar</span>
                      <span className="text-muted-foreground"> - Adiciona dados sem apagar existentes</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="replace" id="replace" />
                    <Label htmlFor="replace" className="cursor-pointer">
                      <span className="font-medium">Substituir</span>
                      <span className="text-muted-foreground"> - Apaga dados e importa novos (irreversível)</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {isRestoring && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progressMessage}
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button 
                onClick={handleRestore} 
                disabled={isRestoring || !selectedFile}
                className="w-full"
                size="lg"
                variant={importMode === 'replace' ? 'destructive' : 'default'}
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Restaurando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Iniciar Restauração
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importar Backup por Pasta</CardTitle>
              <CardDescription>
                Alternativa ao ZIP: selecione a <strong>pasta raiz do backup já descompactada</strong>
                contendo <code>manifest.json</code>, <code>data/</code>, <code>files/</code> e <code>RDOs/</code>.
                Recomendado para backups grandes (centenas de MB ou GB).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFolderFiles ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <input
                  type="file"
                  // @ts-ignore - atributos não tipados padrão do React
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                  id="backup-folder"
                />
                <label htmlFor="backup-folder" className="cursor-pointer">
                  {selectedFolderFiles ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-10 w-10 text-primary" />
                      <p className="font-medium">
                        {selectedFolderFiles.length} arquivos selecionados
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFolderFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB no total
                      </p>
                      <p className="text-xs text-muted-foreground">Clique novamente para trocar de pasta</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <CloudUpload className="h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Clique para selecionar a pasta do backup</p>
                      <p className="text-sm text-muted-foreground">
                        Selecione a pasta que contém o <code>manifest.json</code>
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {isRestoring && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progressMessage}
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button
                onClick={handleRestoreFolder}
                disabled={isRestoring || !selectedFolderFiles}
                className="w-full"
                size="lg"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Restaurando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Iniciar Restauração da Pasta
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
