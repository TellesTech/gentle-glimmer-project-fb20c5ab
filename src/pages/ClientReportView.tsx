import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
 import {
    Loader2, Sun, Sunset, Moon, Users, CheckCircle2, Circle,
    AlertTriangle, AlertCircle, Camera, Building2, PenLine, Check,
    MessageSquare, ClipboardList, FileText, XCircle, X,
    MapPin, Clock, Globe, Timer, CalendarDays, Sparkles, RefreshCw
  } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/loose-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { ClientHeader } from '@/components/client/ClientHeader';
import { ClientProfileForm } from '@/components/client/ClientProfileForm';
import { QuickApprovalCard } from '@/components/client/QuickApprovalCard';
import { OneClickSignatureCard } from '@/components/signatures/OneClickSignatureCard';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { PhotoGallery } from '@/components/reports/PhotoGallery';
import { SignatureTimeline } from '@/components/client/SignatureTimeline';
import type { Shift, DeviationType, ImpactLevel } from '@/types';

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

interface ClientProfile {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  signature_data?: string | null;
}

export default function ClientReportView() {
  const { accessToken, reportId } = useParams<{ accessToken?: string; reportId?: string }>();
  const navigate = useNavigate();
  const { clientProfile: authProfile } = useClientAuth();
  const { user: weesUser, profile: weesProfile, role: weesRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState<ClientProfile | null>(null);
  const [isReverifying, setIsReverifying] = useState(false);

  const handleReverifyAttendance = async () => {
    const report: any = (data as any)?.report || data;
    if (!report?.attendance) return;
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
        return d <= 1 || d / maxLen <= 0.2;
      };
      const findMatch = (name: string) => {
        const needle = norm(name);
        if (!needle) return null;
        let match = (profiles || []).find((p: any) => p.name && norm(p.name) === needle);
        if (match) return match;
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
        queryClient.invalidateQueries({ queryKey: ['client-report', queryId] });
      } else {
        toast.warning('Nenhum cadastro correspondente encontrado.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao reverificar cadastros');
    } finally {
      setIsReverifying(false);
    }
  };

  const queryId = accessToken || reportId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['client-report', queryId],
    queryFn: async () => {
      const body = accessToken ? { accessToken } : { reportId };
      const response = await supabase.functions.invoke('get-client-report', {
        body,
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);
      
      return response.data;
    },
    enabled: !!queryId,
    retry: false,
  });

  // WEES internal user is logged in (admin/super_admin/collaborator) and not a client
  const isWeesUser = !!weesUser && !!weesRole && !authProfile;

  // Fetch WEES profile extras (job_title, signature_data) for the signature card
  const { data: weesExtras } = useQuery({
    queryKey: ['wees-signer-extras', weesUser?.id],
    queryFn: async () => {
      if (!weesUser?.id) return null;
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('job_title, signature_data')
        .eq('id', weesUser.id)
        .maybeSingle();
      return prof || null;
    },
    enabled: !!isWeesUser && !!weesUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch WEES company/system name from public branding
  const { data: weesBranding } = useQuery({
    queryKey: ['public-branding-name'],
    queryFn: async () => {
      const { data: brand } = await (supabase as any).rpc('get_public_branding');
      const row = Array.isArray(brand) ? brand[0] : brand;
      return row?.system_name || 'WEES';
    },
    enabled: !!isWeesUser,
    staleTime: 10 * 60 * 1000,
  });

  // Update local profile when data changes
  useEffect(() => {
    if (data?.clientProfile) {
      setLocalProfile(data.clientProfile);
    }
  }, [data?.clientProfile]);

  const saveProfileMutation = useMutation({
    mutationFn: async (profile: { email: string; name: string; company?: string; role?: string; signature_data?: string | null }) => {
      const response = await supabase.functions.invoke('save-client-profile', {
        body: profile,
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Perfil salvo com sucesso!');
      setLocalProfile(data.profile);
      setShowProfileForm(false);
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ['client-report', queryId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar perfil');
    },
  });

  const submitSignatureMutation = useMutation({
    mutationFn: async (params: { signatureData: string; signerName: string; signerRole?: string; signerEmail?: string | null }) => {
      const signerEmail =
        params.signerEmail ??
        (isWeesUser ? weesProfile?.email : null) ??
        authProfile?.email ??
        localProfile?.email ??
        data?.accessInfo?.clientEmail ??
        null;
      const response = await supabase.functions.invoke('submit-signature', {
        body: {
          accessToken: accessToken || undefined,
          reportId: !accessToken ? (reportId || data?.report?.id) : undefined,
          signatureData: params.signatureData,
          signerName: params.signerName,
          signerRole: params.signerRole || null,
          signerEmail,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      const gold = ['#FFD700', '#FFC400', '#F5A623', '#FFEB99', '#E8B923'];
      const defaults = { startVelocity: 35, spread: 360, ticks: 70, zIndex: 9999, colors: gold };
      confetti({ ...defaults, particleCount: 140, scalar: 1.1, origin: { x: 0.5, y: 0.4 } });
      setTimeout(() => confetti({ ...defaults, particleCount: 60, angle: 60, origin: { x: 0, y: 0.65 } }), 150);
      setTimeout(() => confetti({ ...defaults, particleCount: 60, angle: 120, origin: { x: 1, y: 0.65 } }), 250);
      toast.success('✨ Relatório assinado com sucesso!');
      setIsSigned(true);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao assinar relatório');
    },
  });

  const handleQuickApprove = async () => {
    if (!localProfile?.signature_data) {
      toast.error('Por favor, cadastre sua assinatura primeiro');
      return;
    }
    
    await submitSignatureMutation.mutateAsync({
      signatureData: localProfile.signature_data,
      signerName: localProfile.name,
      signerRole: localProfile.role,
    });
  };

  const handleReject = async (reason: string) => {
    // For now, rejection just creates a signature with a note
    // Could be expanded to send notification to report owner
    toast.info('Funcionalidade de rejeição será implementada em breve');
    console.log('Reject reason:', reason);
  };

  const handleManualSign = () => {
    if (!signatureData) {
      toast.error('Por favor, desenhe sua assinatura');
      return;
    }

    // Prefer the WEES internal user identity when present
    const signerName =
      (isWeesUser ? weesProfile?.name : null) ||
      localProfile?.name ||
      authProfile?.name ||
      data?.accessInfo?.clientName ||
      '';
    const signerRole =
      (isWeesUser ? (weesExtras?.job_title || (weesRole === 'super_admin' ? 'Super Administrador' : weesRole === 'admin' ? 'Administrador' : 'Colaborador')) : null) ||
      localProfile?.role ||
      '';
    const signerEmail =
      (isWeesUser ? weesProfile?.email : null) ||
      localProfile?.email ||
      authProfile?.email ||
      data?.accessInfo?.clientEmail ||
      null;

    if (!signerName) {
      toast.error('Por favor, cadastre seu perfil primeiro');
      setShowProfileForm(true);
      return;
    }

    submitSignatureMutation.mutate({
      signatureData,
      signerName,
      signerRole,
      signerEmail,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <div>
              <h2 className="text-xl font-bold text-destructive">Acesso Inválido</h2>
              <p className="text-muted-foreground mt-2">
                {(error as Error).message || 'O link de acesso é inválido ou expirou.'}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              Ir para a página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { report, accessInfo, signatures } = data;
  const project = report.project;
  const site = project?.site;
  const company = site?.company;
  const shift = report.shift as Shift;
  const ShiftIcon = SHIFT_CONFIG[shift]?.icon || Sun;

  const completedActivities = report.activities?.filter((a: any) => a.completed).length || 0;
  const totalActivities = report.activities?.length || 0;
  const presentAttendance = report.attendance?.filter((a: any) => a.present).length || 0;
  const totalAttendance = report.attendance?.length || 0;
  const rdoNumber = (report.rdo_number ?? 1).toString().padStart(3, '0');
  const rdoDateFormatted = format(parseISO(report.date), 'dd/MM/yyyy');

  // Check if current access has already signed (link flow) OR if authenticated user already signed (logged-in flow)
  const currentAccessSigned = accessInfo ? signatures?.some((s: any) => s.access_id === accessInfo.id) : false;
  const userEmail = (
    (isWeesUser ? weesProfile?.email : '') ||
    authProfile?.email ||
    localProfile?.email ||
    ''
  ).toLowerCase().trim();
  const userAlreadySigned =
    (!!userEmail && signatures?.some((s: any) => (s.signer_email || '').toLowerCase().trim() === userEmail)) ||
    (!!weesUser?.id && signatures?.some((s: any) => s.signer_user_id === weesUser.id));
  const canSign = !currentAccessSigned && !userAlreadySigned && !isSigned;

  // Build signer identity (WEES internal user wins, then client portal, then access link)
  const signerIdentity = {
    name:
      (isWeesUser ? weesProfile?.name : null) ||
      authProfile?.name ||
      localProfile?.name ||
      accessInfo?.clientName ||
      'Visitante',
    role: isWeesUser
      ? (weesExtras?.job_title ||
          (weesRole === 'super_admin'
            ? 'Super Administrador'
            : weesRole === 'admin'
            ? 'Administrador'
            : 'Colaborador'))
      : (authProfile?.role || localProfile?.role || 'Cliente'),
    company: isWeesUser
      ? (weesBranding || 'WEES')
      : (authProfile?.company || localProfile?.company || accessInfo?.clientCompany || ''),
    isWees: isWeesUser,
  };

  // Determine if we should show quick approval or registration form
  const hasProfile = !!localProfile;
  // WEES internal users always go through the manual signature card (they don't manage a client profile here)
  const hasEmail = !isWeesUser && (!!accessInfo?.clientEmail || !!authProfile?.email);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <ClientHeader 
        clientName={accessInfo?.clientName || authProfile?.name || localProfile?.name || 'Cliente'} 
        clientCompany={accessInfo?.clientCompany || authProfile?.company || localProfile?.company}
        onBack={authProfile ? () => navigate('/client/dashboard') : () => window.history.back()}
      />

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">
        {/* Report Header */}
        <Card className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground shadow-xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight">{company?.name || 'Relatório Diário'}</h1>
                  <p className="text-primary-foreground/80 text-sm font-mono mt-1">RDO Nº {rdoNumber} - {rdoDateFormatted}</p>
                </div>
              </div>
              
              <div className="text-right">
                <Badge className="bg-white/20 text-white border-white/30">
                  {report.status === 'completed' ? 'Concluído' : 'Rascunho'}
                </Badge>
                <p className="text-sm text-primary-foreground/80 mt-2">
                  {format(parseISO(report.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General Info Card */}
        <Card>
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Informações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fábrica</p>
                <p className="font-medium text-sm">{company?.name || 'N/A'}</p>
              </div>

              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Unidade</p>
                <p className="font-medium text-sm">{site?.name || 'N/A'}</p>
              </div>

              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Atividade</p>
                <p className="font-medium text-sm">{project?.name || 'N/A'}</p>
              </div>

              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Local</p>
                <p className="font-medium text-sm">{report.location || 'Não informado'}</p>
              </div>

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

              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Data / Turno</p>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <CalendarDays className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  <p className="font-medium text-sm">{format(parseISO(report.date), 'dd/MM/yyyy')}</p>
                  <Badge className={cn('text-xs', SHIFT_CONFIG[shift]?.color)}>
                    <ShiftIcon className="w-3 h-3 mr-1" />
                    {SHIFT_CONFIG[shift]?.label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Horário de Trabalho</p>
                <div className="flex items-center gap-2 min-w-0">
                  <Timer className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  <p className="font-medium text-sm">
                    {report.start_time || '--:--'} às {report.end_time || '--:--'}
                  </p>
                </div>
              </div>

              {report.radio_frequency_wees && (
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Faixa de Rádio Wees</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-4 h-4 text-warning shrink-0" />
                    <p className="font-medium text-sm">{report.radio_frequency_wees}</p>
                  </div>
                </div>
              )}

              {report.radio_frequency_operation && (
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Faixa de Rádio Operação</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-4 h-4 text-success shrink-0" />
                    <p className="font-medium text-sm">{report.radio_frequency_operation}</p>
                  </div>
                </div>
              )}

              {report.meeting_point && (
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ponto de Encontro</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <p className="font-medium text-sm">{report.meeting_point}</p>
                  </div>
                </div>
              )}

              {report.ambulance_point && (
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ponto de Ambulância</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-destructive shrink-0" />
                    <p className="font-medium text-sm">{report.ambulance_point}</p>
                  </div>
                </div>
              )}

              {report.arrival_time_at_liberator && (
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Chegada no Liberador</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <p className="font-medium text-sm">{report.arrival_time_at_liberator}</p>
                  </div>
                </div>
              )}

              {report.document_release_time && (
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Liberação da Documentação</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-success shrink-0" />
                    <p className="font-medium text-sm">{report.document_release_time}</p>
                  </div>
                </div>
              )}

              {report.blockage_revalidation_time && (
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Revalidação de Bloqueio</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-warning shrink-0" />
                    <p className="font-medium text-sm">{report.blockage_revalidation_time}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Criado Por</p>
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={(report.creator as any)?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials((report.creator as any)?.name || 'NN')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {(report.creator as any)?.name || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.created_at ? format(parseISO(report.created_at), "dd/MM/yyyy 'às' HH:mm") : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activities Card */}
        {report.activities && report.activities.length > 0 && (
          <Card className="border-l-4 border-l-success">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-success" />
                Atividades Executadas
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
                    <div className="flex-1 min-w-0">
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
          <Card className="border-l-4 border-l-info">
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

        {/* Deviations Card */}
        {report.deviations && report.deviations.length > 0 && (
          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Desvios / Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.deviations.map((deviation: any) => (
                <div
                  key={deviation.id}
                  className={cn(
                    'p-4 rounded-xl border-2',
                    IMPACT_CONFIG[deviation.impact as ImpactLevel]?.color || 'border-muted'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className={IMPACT_CONFIG[deviation.impact as ImpactLevel]?.badge || 'bg-muted'}>
                      Impacto {IMPACT_CONFIG[deviation.impact as ImpactLevel]?.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {DEVIATION_TYPE_LABELS[deviation.type as DeviationType] || deviation.type}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mb-2">{deviation.description}</p>
                  {deviation.action_taken && (
                    <div className="text-sm bg-background/50 p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground uppercase mb-1 font-medium">Ação Corretiva</p>
                      <p>{deviation.action_taken}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Attendance Card */}
        {report.attendance && report.attendance.length > 0 && (
          <Card className="border-l-4 border-l-info">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-info" />
                Efetivo
              </CardTitle>
              <div className="flex items-center gap-2">
                {report.attendance.some((a: any) => !a.user_id) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReverifyAttendance}
                    disabled={isReverifying}
                    className="h-7 text-xs gap-1"
                  >
                    {isReverifying ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Atualizar
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
                         'p-3 rounded-xl flex items-center gap-3 border transition-all',
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
                           <p className={cn('text-xs', person.present ? 'text-success' : 'text-destructive')}>
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

        {/* Photos Card */}
        {report.photos && report.photos.length > 0 && (
          <Card className="border-l-4 border-l-primary">
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
        {(report.comments || report.ai_summary) && (
          <Card className="border-l-4 border-l-muted-foreground/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.comments && (
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <p className="text-sm whitespace-pre-wrap">{report.comments}</p>
                </div>
              )}
              {report.ai_summary && (
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <p className="text-sm font-semibold text-primary flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-4 h-4" />
                    Resumo:
                  </p>
                  <p className="text-sm text-foreground/80 italic whitespace-pre-wrap">{report.ai_summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Signatures (real-time): expected signers (WEES + Client) with photos and status */}
        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="w-5 h-5 text-success" />
              Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SignatureTimeline reportId={report.id} />
          </CardContent>
        </Card>

        {/* Registered signatures (image + signer info) — same layout as ReportDetail */}
        {(() => {
          const manualSignatures = (signatures || []).filter(
            (sig: any) => sig.signature_data && !String(sig.signature_data).startsWith('autentique:')
          );
          if (manualSignatures.length === 0) return null;
          return (
            <Card className="border-l-4 border-l-success shadow-sm">
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-success" />
                  Assinaturas registradas
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
                    {String(sig.signature_data).startsWith('data:image') && (
                      <div className="bg-white rounded-lg p-3 mb-4 border border-border/50">
                        <img
                          src={sig.signature_data}
                          alt={`Assinatura de ${sig.signer_name}`}
                          className="max-h-24 mx-auto object-contain"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{sig.signer_name}</span>
                      </div>
                      {sig.signer_role && (
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-muted-foreground" />
                          <span>{sig.signer_role}</span>
                        </div>
                      )}
                      {sig.signed_at && (
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-muted-foreground" />
                          <span>{format(new Date(sig.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                      )}
                      {sig.ip_address && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono text-xs">
                            {String(sig.ip_address).replace(/\.\d+\.\d+$/, '.xxx.xxx')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* Signature Section */}
        {canSign ? (
          <>
            {/* Show Quick Approval if profile exists and has email */}
            {hasEmail && hasProfile && !showProfileForm && !isEditingProfile ? (
              <QuickApprovalCard
                profile={localProfile!}
                onApprove={handleQuickApprove}
                onReject={handleReject}
                onEditProfile={() => setIsEditingProfile(true)}
                isSubmitting={submitSignatureMutation.isPending}
              />
            ) : hasEmail && (showProfileForm || isEditingProfile || !hasProfile) ? (
              <ClientProfileForm
                email={accessInfo?.clientEmail || authProfile?.email || ''}
                initialData={localProfile || { name: accessInfo?.clientName || authProfile?.name || '', company: accessInfo?.clientCompany || authProfile?.company || '' }}
                onSubmit={async (profile) => {
                  await saveProfileMutation.mutateAsync(profile);
                }}
                isSubmitting={saveProfileMutation.isPending}
                mode={hasProfile ? 'edit' : 'register'}
              />
            ) : (
              /* Unified one-click signature card.
                 - WEES users: uses profiles.signature_data (when present)
                 - Anonymous link / no profile: falls back to Digitar/Upload
              */
              <OneClickSignatureCard
                identity={{
                  name: signerIdentity.name,
                  role: signerIdentity.role,
                  company: signerIdentity.company,
                  isWees: signerIdentity.isWees,
                  savedSignature:
                    (isWeesUser ? weesExtras?.signature_data : null) ||
                    localProfile?.signature_data ||
                    null,
                }}
                onSign={async (sig) => {
                  setSignatureData(sig);
                  // Submit immediately using resolved identity
                  const signerName =
                    (isWeesUser ? weesProfile?.name : null) ||
                    localProfile?.name ||
                    authProfile?.name ||
                    data?.accessInfo?.clientName ||
                    '';
                  const signerRole =
                    (isWeesUser
                      ? (weesExtras?.job_title ||
                          (weesRole === 'super_admin'
                            ? 'Super Administrador'
                            : weesRole === 'admin'
                            ? 'Administrador'
                            : 'Colaborador'))
                      : null) ||
                    localProfile?.role ||
                    '';
                  const signerEmail =
                    (isWeesUser ? weesProfile?.email : null) ||
                    localProfile?.email ||
                    authProfile?.email ||
                    data?.accessInfo?.clientEmail ||
                    null;

                  if (!signerName) {
                    toast.error('Por favor, cadastre seu perfil primeiro');
                    setShowProfileForm(true);
                    return;
                  }

                  await submitSignatureMutation.mutateAsync({
                    signatureData: sig,
                    signerName,
                    signerRole,
                    signerEmail,
                  });
                }}
                isSubmitting={submitSignatureMutation.isPending}
                onRegisterSignature={
                  isWeesUser
                    ? () => navigate('/settings')
                    : hasEmail
                      ? () => setIsEditingProfile(true)
                      : undefined
                }
              />
            )}
          </>
        ) : (
          <Card className="border-2 border-success bg-success/5">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-success">Relatório Assinado</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {isSigned 
                  ? 'Sua assinatura foi registrada com sucesso!'
                  : 'Este link já foi usado para assinar o relatório.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="text-center md:text-left">
              <p className="font-semibold text-foreground/80">{company?.name || 'Empresa'}</p>
              <p>{company?.email || ''}</p>
              </div>
              <div className="text-center md:text-right">
                <p className="italic">Documento gerado pelo Sistema RDO</p>
                <p>Acessado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
