import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClientPreviewMode } from '@/hooks/useClientPreviewMode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { ClientLayout } from '@/components/client/ClientLayout';
import { useClientPortalSettings } from '@/hooks/useClientPortalSettings';
import { supabase } from '@/integrations/supabase/client';
import { PortalResponsiblesCard } from '@/components/client/PortalResponsiblesCard';
import { PageBackHeader } from '@/components/client/PageBackHeader';
import { AnimatedFolder, type Project as FolderProject } from '@/components/ui/3d-folder';
import {
  FileText,
  CheckCircle,
  Clock,
  PenTool,
  AlertTriangle,
  Eye,
  TrendingUp,
  BarChart3,
  Camera,
  Activity,
  Timer,
  Target,
  Filter,
  Wrench,
  ChevronRight,
  Building2,
  Calendar,
  Download,
  Loader2,
} from 'lucide-react';
import { EyeOff } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, subDays, startOfDay, endOfDay, isWithinInterval, differenceInDays, getYear, getMonth, isSameMonth, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildActivityGroups, type ActivityGroupInputReport } from '@/lib/rdoActivityGroups';
import { useActivityNames } from '@/hooks/useActivityNames';
import { RenameActivityDialog, type RenameActivityTarget } from '@/components/reports/RenameActivityDialog';
import { Pencil } from 'lucide-react';

import { cn } from '@/lib/utils';
import JSZip from 'jszip';
import { getReportPdfBlob } from '@/lib/clientReportDownload';
import { triggerDownloadFromBlob } from '@/lib/downloadUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, Tooltip, CartesianGrid } from 'recharts';

interface PendingReport {
  id: string;
  report_id: string;
  status: string;
  created_at: string;
  approved_at?: string | null;
  /** True only when the WEES team explicitly added this user as an approver
   *  for this report and the approval is still pending. Drives the "Aprovar"
   *  button visibility. Read-only access (history) is granted by site link. */
  canSign?: boolean;
  /** Row id in report_*_approvers (used by handleApproveSignature). */
  approverRowId?: string | null;
  report: {
    id: string;
    date: string;
    shift: string;
    status: string;
    rdo_number?: number | null;
    location?: string | null;
    maintenance_order_number?: string | null;
    maintenance_order_title?: string | null;
    project: {
      id: string;
      name: string;
      company: { id: string; name: string } | null;
    } | null;
  } | null;
}

// Build a stylized SVG "paper" preview for an RDO (used when no real photo exists).
function buildRdoCardImage(rdoNumber: number | null | undefined, dateLabel: string, status: string): string {
  const isApproved = status === 'approved';
  const tagBg = isApproved ? '#16a34a' : '#d4a017';
  const tagText = isApproved ? 'Assinado' : 'Pendente';
  const numberLabel = rdoNumber != null ? `RDO ${rdoNumber}` : 'RDO';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 280'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0' stop-color='#ffffff'/>
        <stop offset='1' stop-color='#f7f7f7'/>
      </linearGradient>
    </defs>
    <rect width='200' height='280' fill='url(#bg)'/>
    <rect x='0' y='0' width='200' height='44' fill='#f4c430'/>
    <text x='100' y='29' font-family='Inter,Arial,sans-serif' font-size='14' font-weight='700' fill='#3a2a00' text-anchor='middle'>RDO</text>
    <text x='100' y='150' font-family='Inter,Arial,sans-serif' font-size='38' font-weight='800' fill='#1a1a1a' text-anchor='middle'>${numberLabel.replace('RDO ', '#')}</text>
    <text x='100' y='185' font-family='Inter,Arial,sans-serif' font-size='14' font-weight='600' fill='#555555' text-anchor='middle'>${dateLabel}</text>
    <rect x='50' y='220' width='100' height='28' rx='14' fill='${tagBg}'/>
    <text x='100' y='239' font-family='Inter,Arial,sans-serif' font-size='12' font-weight='700' fill='#ffffff' text-anchor='middle'>${tagText}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Native portal-only flow

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function ClientDashboard() {
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('7d');
  const [selectedActivity, setSelectedActivity] = useState<string>('all');

  const { clientProfile, user, isLoading: authLoading } = useClientAuth();
  const { role, profile: adminProfile } = useAuth();
  const { isClientPreview } = useClientPreviewMode();
  const { settings: portalSettings } = useClientPortalSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const isInternalUser = role === 'admin' || role === 'super_admin' || role === 'collaborator';
  const isAdminView = isInternalUser && !clientProfile;
  const isCollaboratorView = searchParams.get('portal_user') === 'collaborator' && isAdminView;
  const adminCompanyId = searchParams.get('company_id');
  const adminSiteId = searchParams.get('site_id');

  // Fetch admin profile signature for internal users without client profile
  const { data: adminSignatureProfile } = useQuery({
    queryKey: ['admin-signature-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, signature_data, job_title')
        .eq('id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: isInternalUser && !clientProfile && !!user?.id,
    staleTime: 60000,
  });

  // Effective signature data: prefer clientProfile, fallback to admin profile
  const effectiveSignatureData = clientProfile?.signature_data || adminSignatureProfile?.signature_data || null;
  const effectiveName = clientProfile?.name || adminSignatureProfile?.name || adminProfile?.name || '';
  const effectiveRole = clientProfile?.role || adminSignatureProfile?.job_title || 'Colaborador';

  if (!authLoading && !user) {
    navigate('/login');
  }

  // Admin view reports
  // - When ?company_id is present (admin entered via Settings → "Visualizar portal"), scope by it.
  // - Otherwise (e.g., admin/collaborator coming from the "Assinaturas" menu),
  //   auto-resolve the sites via portal_admin_access + site_responsibles.
  const { data: adminReportsData, isLoading: adminReportsLoading } = useQuery({
    queryKey: ['admin-client-dashboard-reports', adminCompanyId, adminSiteId, user?.id, role],
    queryFn: async () => {
      let pIds: string[] = [];
      const isSuper = role === 'super_admin';

      // Compute the set of sites this internal user is allowed to see
      // (super_admin bypasses the restriction).
      let allowedSiteIds: Set<string> | null = null;
      if (!isSuper && user?.id) {
        const [{ data: paa }, { data: srs }] = await Promise.all([
          supabase.from('portal_admin_access').select('site_id').eq('user_id', user.id),
          supabase.from('site_responsibles').select('site_id').eq('user_id', user.id),
        ]);
        allowedSiteIds = new Set<string>([
          ...((paa || []) as any[]).map((r) => r.site_id),
          ...((srs || []) as any[]).map((r) => r.site_id),
        ].filter(Boolean));
        // Internal user with no explicit access → nothing to show
        if (allowedSiteIds.size === 0) return [];
      }

      // Resolve effective siteIds based on URL params and allowed set
      let effectiveSiteIds: string[] = [];
      if (adminSiteId) {
        if (!isSuper && allowedSiteIds && !allowedSiteIds.has(adminSiteId)) return [];
        effectiveSiteIds = [adminSiteId];
      } else if (adminCompanyId) {
        const { data: sites } = await supabase.from('sites').select('id').eq('company_id', adminCompanyId);
        const sIds = (sites || []).map((s: any) => s.id as string);
        effectiveSiteIds = isSuper || !allowedSiteIds
          ? sIds
          : sIds.filter((id) => allowedSiteIds!.has(id));
        if (!effectiveSiteIds.length) return [];
      } else if (allowedSiteIds) {
        effectiveSiteIds = Array.from(allowedSiteIds);
      } else {
        // super_admin without any URL scoping → nothing to fetch in admin view
        return [];
      }

      if (effectiveSiteIds.length) {
        const { data: cp } = await supabase.from('projects').select('id').in('site_id', effectiveSiteIds);
        pIds = (cp || []).map((p: any) => p.id);
      }

      if (!pIds.length) return [];

      const { data, error } = await supabase
        .from('reports')
        .select(`
          id, date, shift, status, rdo_number, location, maintenance_order_number, maintenance_order_title,
          project:projects (id, name, site_id, company:companies (id, name))
        `)
        .in('project_id', pIds)
        .in('status', ['sent', 'signed', 'finalized'])
        .order('date', { ascending: false });

      if (error) throw error;

      // Portal do cliente exibe RDOs enviados para assinatura e assinados (sent/signed/finalized).
      return (data || []).map((r: any) => {
        const isApproved = r.status === 'signed' || r.status === 'finalized';
        const mappedStatus = isApproved ? 'approved' : 'pending';
        return {
          id: r.id, report_id: r.id,
          status: mappedStatus,
          created_at: r.date, approved_at: mappedStatus === 'approved' ? r.date : null,
          report: {
            id: r.id, date: r.date, shift: r.shift, status: r.status, rdo_number: r.rdo_number,
            location: r.location ?? null,
            maintenance_order_number: r.maintenance_order_number ?? null,
            maintenance_order_title: r.maintenance_order_title ?? null,
            project: r.project,
          },
        };
      }) as PendingReport[];
    },
    enabled: isAdminView && !!user?.id,
    staleTime: 30000,
  });

  // Client reports
  // Visibility rule (RESTRICTIVE): client only sees RDOs explicitly sent to
  // them for signature, i.e. reports where they have a row in
  // report_company_approvers (contacts) or report_client_approvers (clients),
  // regardless of approval status. RDOs of their unit they were NOT invited
  // to sign do NOT appear.
  const { data: clientReportsData, isLoading: clientReportsLoading } = useQuery({
    queryKey: ['client-dashboard-reports', clientProfile?.id, clientProfile?._source, clientProfile?.company_id],
    queryFn: async () => {
      if (!clientProfile?.id) return [];
      const isContact = clientProfile._source === 'company_contacts';

      // 1) Approver rows for THIS user across all their reports
      const approverByReport = new Map<string, { id: string; status: string; approved_at: string | null; created_at: string }>();
      if (isContact) {
        const { data: rcoa } = await supabase
          .from('report_company_approvers')
          .select('id, report_id, status, approved_at, created_at')
          .eq('contact_id', clientProfile.id);
        (rcoa || []).forEach((r: any) => approverByReport.set(r.report_id, r));
      } else {
        const { data: rca } = await supabase
          .from('report_client_approvers')
          .select('id, report_id, status, approved_at, created_at')
          .eq('client_id', clientProfile.id);
        (rca || []).forEach((r: any) => approverByReport.set(r.report_id, r));
      }

      // 2) Todos os RDOs enviados/assinados das unidades do usuário (visibilidade
      //    automática; RLS já exclui meses ocultados pela WEES).
      const { data: siteRows } = await (supabase as any).rpc('portal_user_site_ids', {
        _user_id: user?.id,
      });
      const siteIds: string[] = (siteRows || [])
        .map((s: any) => (typeof s === 'string' ? s : s?.portal_user_site_ids))
        .filter(Boolean);
      if (!siteIds.length) return [];

      const { data: projRows } = await supabase.from('projects').select('id').in('site_id', siteIds);
      const projectIds = (projRows || []).map((p: any) => p.id);
      if (!projectIds.length) return [];

      const { data: reports, error } = await supabase
        .from('reports')
        .select(`
          id, date, shift, status, rdo_number, location, maintenance_order_number, maintenance_order_title,
          project:projects (id, name, site_id, company:companies (id, name))
        `)
        .in('project_id', projectIds)
        .in('status', ['sent', 'signed', 'finalized'])
        .order('date', { ascending: false });
      if (error) throw error;

      return (reports || [])
        .map((r: any) => {
          const reportSigned = r.status === 'signed' || r.status === 'finalized';
          const approverRow = approverByReport.get(r.id);
          const isApproved = approverRow?.status === 'approved' || reportSigned;
          const mappedStatus = isApproved ? 'approved' : 'pending';
          return {
            id: approverRow?.id || r.id,
            report_id: r.id,
            status: mappedStatus,
            created_at: approverRow?.created_at || r.date,
            approved_at: approverRow?.approved_at || (isApproved ? r.date : null),
            canSign: !!approverRow && approverRow.status !== 'approved' && !reportSigned,
            approverRowId: approverRow?.id ?? null,
            report: {
              id: r.id,
              date: r.date,
              shift: r.shift,
              status: r.status,
              rdo_number: r.rdo_number,
              location: r.location ?? null,
              maintenance_order_number: r.maintenance_order_number ?? null,
              maintenance_order_title: r.maintenance_order_title ?? null,
              project: r.project,
            },
          };
        }) as PendingReport[];
    },
    enabled: !!clientProfile?.id,
    staleTime: 30000,
  });

  const reportsData = isAdminView ? adminReportsData : clientReportsData;
  const reportsLoading = isAdminView ? adminReportsLoading : clientReportsLoading;

  // ===== Pastas de mês ocultas (somente super admin gerencia) =====
  const isSuperAdmin = role === 'super_admin' && !isClientPreview;
  const hiddenScopeCompanyId = adminCompanyId || clientProfile?.company_id || null;

  const { data: hiddenMonths } = useQuery({
    queryKey: ['portal-hidden-months', hiddenScopeCompanyId, adminSiteId],
    queryFn: async () => {
      let q = supabase.from('portal_hidden_months').select('id, company_id, site_id, year, month');
      if (adminSiteId) q = q.eq('site_id', adminSiteId);
      else if (hiddenScopeCompanyId) q = q.eq('company_id', hiddenScopeCompanyId);
      const { data } = await q;
      return (data || []) as { id: string; company_id: string; site_id: string; year: number; month: number }[];
    },
    enabled: !!hiddenScopeCompanyId || !!adminSiteId,
  });

  const hiddenMonthKeys = useMemo(
    () => new Set((hiddenMonths || []).map(h => `${h.year}-${h.month}`)),
    [hiddenMonths],
  );

  const canToggleHiddenMonth = isSuperAdmin && !!adminSiteId && !!adminCompanyId;

  // Relatórios visíveis: o cliente não conta os meses ocultos nas métricas.
  // O super admin continua vendo os números totais (ele enxerga as pastas ocultas).
  const visibleReports = useMemo(() => {
    const all = reportsData || [];
    if (isSuperAdmin || hiddenMonthKeys.size === 0) return all;
    return all.filter(r => {
      if (!r.report?.date) return true;
      const d = parseISO(r.report.date);
      return !hiddenMonthKeys.has(`${getYear(d)}-${getMonth(d)}`);
    });
  }, [reportsData, hiddenMonthKeys, isSuperAdmin]);

  // Photo count
  const reportIds = useMemo(() => (reportsData || []).map(r => r.report_id).filter(Boolean), [reportsData]);

  // RDOs já assinados pela equipe WEES (report_signatures) → status "parcial"
  // enquanto o cliente não assina.
  const { data: weesSignedIds } = useQuery({
    queryKey: ['client-internal-signatures', reportIds],
    queryFn: async () => {
      if (!reportIds.length) return new Set<string>();
      const { data } = await supabase
        .from('report_signatures')
        .select('report_id, signature_data')
        .in('report_id', reportIds);
      return new Set<string>((data || []).filter((s: any) => !!s.signature_data).map((s: any) => s.report_id));
    },
    enabled: reportIds.length > 0,
    staleTime: 30000,
  });

  const { data: photosCount } = useQuery({
    queryKey: ['client-photos-count', reportIds],
    queryFn: async () => {
      if (!reportIds.length) return 0;
      const { count, error } = await supabase
        .from('report_photos')
        .select('id', { count: 'exact', head: true })
        .in('report_id', reportIds.slice(0, 100));
      if (error) return 0;
      return count || 0;
    },
    enabled: reportIds.length > 0,
    staleTime: 60000,
  });


  // Computed metrics — based purely on approver.status (native portal flow)
  const metrics = useMemo(() => {
    const all = visibleReports;
    const total = all.length;

    const approved = all.filter(r => r.status === 'approved');
    const pending = all.filter(r => r.status !== 'approved');
    const now = new Date();
    const OVERDUE_DAYS = 3;
    const overdue = pending.filter(r => {
      const d = r.report?.date ? parseISO(r.report.date) : null;
      return d && differenceInDays(now, d) > OVERDUE_DAYS;
    });

    // Avg signature time (days between report date and approved_at)
    const signedWithTime = approved.filter(r => r.approved_at && r.report?.date);
    let avgSignatureDays = 0;
    if (signedWithTime.length > 0) {
      const totalDays = signedWithTime.reduce((sum, r) => {
        const reportDate = parseISO(r.report!.date);
        const approvedDate = parseISO(r.approved_at!);
        return sum + Math.max(differenceInDays(approvedDate, reportDate), 0);
      }, 0);
      avgSignatureDays = Math.round((totalDays / signedWithTime.length) * 10) / 10;
    }

    // % signed on time (within OVERDUE_DAYS)
    let onTimePercent = 100;
    if (signedWithTime.length > 0) {
      const onTime = signedWithTime.filter(r => {
        const d = differenceInDays(parseISO(r.approved_at!), parseISO(r.report!.date));
        return d <= OVERDUE_DAYS;
      });
      onTimePercent = Math.round((onTime.length / signedWithTime.length) * 100);
    }

    // Unique projects
    const projectSet = new Set<string>();
    all.forEach(r => { if (r.report?.project?.id) projectSet.add(r.report.project.id); });

    // Score (0-100)
    let score = 100;
    score -= overdue.length * 5;
    if (avgSignatureDays > 3) score -= Math.round((avgSignatureDays - 3) * 2);
    score = Math.max(0, Math.min(100, score));

    return {
      total,
      signed: approved.length,
      pending: pending.length,
      overdue: overdue.length,
      onTimePercent,
      avgSignatureDays,
      totalProjects: projectSet.size,
      score,
    };
  }, [visibleReports]);

  // Score status

  // Chart data
  const chartData = useMemo(() => {
    if (!visibleReports.length) return [];
    const now = new Date();
    const days = chartPeriod === '7d' ? 7 : 30;
    return Array.from({ length: days }, (_, i) => {
      const date = subDays(now, days - 1 - i);
      const start = startOfDay(date);
      const end = endOfDay(date);
      const inRange = visibleReports.filter(r => {
        const d = r.report?.date ? parseISO(r.report.date) : null;
        return d && isWithinInterval(d, { start, end });
      });
      return {
        name: format(date, days <= 7 ? 'EEE' : 'dd/MM', { locale: ptBR }),
        Assinados: inRange.filter(r => r.status === 'approved').length,
        Pendentes: inRange.filter(r => r.status !== 'approved').length,
      };
    });
  }, [visibleReports, chartPeriod]);

  // Pending list (sorted by oldest first)
  const pendingList = useMemo(() => {
    return visibleReports
      .filter(r => r.status !== 'approved')
      .sort((a, b) => {
        const da = a.report?.date || '';
        const db = b.report?.date || '';
        return da.localeCompare(db);
      });
  }, [visibleReports]);

  // Unique activities for filter
  const uniqueActivities = useMemo(() => {
    const activityMap = new Map<string, number>();
    pendingList.forEach(r => {
      const name = r.report?.project?.name;
      if (name) activityMap.set(name, (activityMap.get(name) || 0) + 1);
    });
    return Array.from(activityMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pendingList]);

  const filteredPendingList = useMemo(() => {
    if (selectedActivity === 'all') return pendingList;
    return pendingList.filter(r => r.report?.project?.name === selectedActivity);
  }, [pendingList, selectedActivity]);

  // Aggregate by Month/Year and then by Activity (project)
  type ActivityReport = { id: string; date: string | null; status: string; rdoNumber: number | null };

  const toggleHiddenMonth = async (
    e: React.MouseEvent,
    month: { year: number; month: number; monthName: string },
    hidden: boolean,
  ) => {
    e.stopPropagation();
    if (!canToggleHiddenMonth) return;
    try {
      if (hidden) {
        const { error } = await supabase
          .from('portal_hidden_months')
          .delete()
          .eq('site_id', adminSiteId!)
          .eq('year', month.year)
          .eq('month', month.month);
        if (error) throw error;
        toast({ title: 'Pasta reexibida', description: `${month.monthName} ${month.year} voltou a aparecer para o cliente.` });
      } else {
        const { error } = await supabase.from('portal_hidden_months').insert({
          company_id: adminCompanyId!,
          site_id: adminSiteId!,
          year: month.year,
          month: month.month,
          hidden_by: user?.id ?? null,
        });
        if (error) throw error;
        toast({ title: 'Pasta ocultada', description: `${month.monthName} ${month.year} não aparece mais para o cliente.` });
      }
      queryClient.invalidateQueries({ queryKey: ['portal-hidden-months'] });
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Não foi possível alterar a visibilidade.', variant: 'destructive' });
    }
  };
  
  // Unidades presentes nos RDOs visíveis (para nomes personalizados de pastas)
  const reportSiteIds = useMemo(() => {
    const s = new Set<string>();
    visibleReports.forEach(r => {
      const sid = (r.report as any)?.project?.site_id;
      if (sid) s.add(sid);
    });
    return Array.from(s);
  }, [visibleReports]);

  const { names: activityNames, rename: renameActivity, resetName: resetActivityName, isSaving: renamingActivity } =
    useActivityNames(reportSiteIds);
  const [renameTarget, setRenameTarget] = useState<RenameActivityTarget | null>(null);

  const monthFolders = useMemo(() => {
    const all = visibleReports;
    if (!all.length) return [];

    const monthMap = new Map<string, { year: number; month: number; reports: PendingReport[] }>();

    all.forEach(r => {
      if (!r.report?.date) return;
      const d = parseISO(r.report.date);
      const year = getYear(d);
      const month = getMonth(d);
      const key = `${year}-${month}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { year, month, reports: [] });
      }
      monthMap.get(key)!.reports.push(r);
    });

    return Array.from(monthMap.values())
      .map(({ year, month, reports }) => {
        // Build activity groups for THIS month using the shared logic
        const inputReports: ActivityGroupInputReport[] = reports.map(r => ({
          id: r.report!.id,
          date: r.report!.date,
          location: (r.report as any).location,
          maintenance_order_number: (r.report as any).maintenance_order_number,
          maintenance_order_title: (r.report as any).maintenance_order_title,
          project_id: r.report!.project!.id,
          project_name: r.report!.project!.name,
        }));

        const groups = buildActivityGroups(inputReports, activityNames);

        const activities = groups.map(group => {
          const groupReports = reports.filter(r => group.reportIds.includes(r.report_id));
          const signed = groupReports.filter(r => r.status === 'approved').length;
          const pending = groupReports.length - signed;
          // RDOs ainda não assinados pelo cliente, mas já assinados pela WEES.
          const partial = groupReports.filter(
            r => r.status !== 'approved' && weesSignedIds?.has(r.report_id)
          ).length;
          
          return {
            id: group.id,
            name: group.name,
            siteId: (groupReports.find(r => (r.report as any)?.project?.site_id)?.report as any)?.project?.site_id ?? null,
            hasCustomName: activityNames.has(group.id),
            total: group.count,
            pending: pending,
            signed: signed,
            partial,
            lastDate: group.lastDate || null,
            reports: groupReports.map(r => ({
              id: r.report_id,
              date: r.report!.date,
              status: r.status,
              rdo_number: r.report?.rdo_number ?? null,
              activityName: group.name
            })),
          };
        }).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));

        const total = reports.length;
        const signed = reports.filter(r => r.status === 'approved').length;
        const partial = reports.filter(
          r => r.status !== 'approved' && weesSignedIds?.has(r.report_id)
        ).length;

        return {
          id: `${year}-${month}`,
          year,
          month,
          monthName: monthNames[month],
          totalReports: total,
          pendingReports: total - signed,
          signedReports: signed,
          partialReports: partial,
          activities,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }, [visibleReports, weesSignedIds, activityNames]);

  // Super admin vê tudo (com selo "Oculto"); demais usuários não veem pastas ocultas.
  const visibleMonthFolders = useMemo(
    () => (isSuperAdmin ? monthFolders : monthFolders.filter(m => !hiddenMonthKeys.has(`${m.year}-${m.month}`))),
    [monthFolders, hiddenMonthKeys, isSuperAdmin],
  );

  // Folder previews (cover photos)
  const folderReportIds = useMemo(() => {
    const ids = new Set<string>();
    monthFolders.forEach(m => m.activities.forEach(a => a.reports.slice(0, 5).forEach(r => ids.add(r.id))));
    return Array.from(ids);
  }, [monthFolders]);

  // ===== Download de pasta de RDOs do mês (ZIP) =====
  const [downloadingMonthId, setDownloadingMonthId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  const handleDownloadMonth = async (
    e: React.MouseEvent,
    month: (typeof monthFolders)[number],
  ) => {
    e.stopPropagation();
    if (downloadingMonthId) return;

    const items = month.activities.flatMap((a) =>
      a.reports.map((r) => ({ ...r, activityName: a.name })),
    );
    if (items.length === 0) {
      toast({ title: 'Nenhum RDO neste mês', variant: 'destructive' });
      return;
    }

    setDownloadingMonthId(month.id);
    setDownloadProgress({ done: 0, total: items.length });

    try {
      const zip = new JSZip();
      let ok = 0;
      let failed = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const { blob, filename } = await getReportPdfBlob(item.id);
          const folder = (item.activityName || 'Atividade').replace(/[^\w\-À-ÿ ]+/g, '_').trim();
          zip.file(`${folder}/${filename}`, blob);
          ok += 1;
        } catch (err) {
          console.warn('[ClientDashboard] falha no RDO', item.id, err);
          failed += 1;
        }
        setDownloadProgress({ done: i + 1, total: items.length });
      }

      if (ok === 0) {
        toast({ title: 'Não foi possível gerar os PDFs', variant: 'destructive' });
        return;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownloadFromBlob(blob, `RDOs_${month.monthName}_${month.year}.zip`);
      toast({
        title: `${ok} RDO(s) baixados`,
        description: failed > 0 ? `${failed} não puderam ser gerados.` : undefined,
      });
    } catch (err) {
      console.error('[ClientDashboard] erro no ZIP', err);
      toast({ title: 'Erro ao gerar o arquivo ZIP', variant: 'destructive' });
    } finally {
      setDownloadingMonthId(null);
      setDownloadProgress(null);
    }
  };


  const { data: coverPhotosMap } = useQuery({
    queryKey: ['client-activity-cover-photos', folderReportIds],
    queryFn: async () => {
      if (!folderReportIds.length) return new Map<string, string>();
      const { data, error } = await supabase
        .from('report_photos')
        .select('report_id, photo_url, created_at')
        .in('report_id', folderReportIds.slice(0, 100))
        .order('created_at', { ascending: true });
      if (error) return new Map<string, string>();
      const m = new Map<string, string>();
      (data || []).forEach((row: any) => {
        if (!m.has(row.report_id) && row.photo_url) m.set(row.report_id, row.photo_url);
      });
      return m;
    },
    enabled: folderReportIds.length > 0,
    staleTime: 60000,
  });

  // Resolve company/site context for the responsibles card
  const responsiblesCompanyId = useMemo(() => {
    if (adminCompanyId) return adminCompanyId;
    return clientProfile?.company_id || null;
  }, [adminCompanyId, clientProfile?.company_id]);
  const responsiblesSiteIds = useMemo(() => (adminSiteId ? [adminSiteId] : undefined), [adminSiteId]);

  // Resolve portal name (site or company) for the admin informational banner
  const { data: portalContextName } = useQuery({
    queryKey: ['admin-portal-context-name', adminSiteId, adminCompanyId],
    enabled: isAdminView && (!!adminSiteId || !!adminCompanyId),
    queryFn: async () => {
      if (adminSiteId) {
        const { data } = await supabase.from('sites').select('name').eq('id', adminSiteId).maybeSingle();
        if (data?.name) return data.name as string;
      }
      if (adminCompanyId) {
        const { data } = await supabase.from('companies').select('name').eq('id', adminCompanyId).maybeSingle();
        if (data?.name) return data.name as string;
      }
      return null;
    },
  });


  const handleApproveSignature = async (reportApproverId: string, reportId: string) => {
    if (!effectiveSignatureData) {
      toast({ title: 'Assinatura não configurada', description: 'Configure sua assinatura no perfil primeiro', variant: 'destructive' });
      navigate(`/client/profile?${searchParams.toString()}`);
      return;
    }
    setApprovingId(reportApproverId);
    try {
      const { error: signatureError } = await supabase
        .from('report_signatures')
        .insert({ report_id: reportId, signature_data: effectiveSignatureData, signer_name: effectiveName, signer_role: effectiveRole });
      if (signatureError) throw signatureError;

      const isContact = clientProfile?._source === 'company_contacts';
      if (clientProfile) {
        const { error: updateError } = isContact
          ? await supabase.from('report_company_approvers').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', reportApproverId)
          : await supabase.from('report_client_approvers').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', reportApproverId);
        if (updateError) throw updateError;
      }

      toast({ title: 'Relatório aprovado!', description: 'Sua assinatura foi aplicada com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['client-dashboard-reports'] });
    } catch (error) {
      console.error('Error approving report:', error);
      toast({ title: 'Erro ao aprovar', description: 'Ocorreu um erro ao aplicar sua assinatura', variant: 'destructive' });
    } finally {
      setApprovingId(null);
    }
  };

  const getShiftLabel = (shift: string) => {
    const labels: Record<string, string> = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' };
    return labels[shift] || shift;
  };

  if (authLoading) {
    return (
      <ClientLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (!clientProfile && !isAdminView) {
    return (
      <ClientLayout>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Perfil de cliente não encontrado</h2>
          <p className="text-muted-foreground text-center">Sua conta não possui um perfil de cliente vinculado.</p>
          <Button onClick={() => navigate('/login')}>Voltar ao login</Button>
        </div>
      </ClientLayout>
    );
  }

  const displayName = isAdminView ? adminProfile?.name : clientProfile?.name;

  return (
    <ClientLayout>
      <div className="space-y-5 sm:space-y-6 min-w-0">
        {/* Collaborator Banner */}
        {isCollaboratorView && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-primary/10">
                  <PenTool className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Área do Colaborador</h2>
                  <p className="text-sm text-muted-foreground">
                    {effectiveName} · {effectiveRole}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {effectiveSignatureData ? (
                  <Badge variant="outline" className="border-[hsl(var(--success))] text-[hsl(var(--success))]">
                    <CheckCircle className="h-3 w-3 mr-1" /> Assinatura ativa
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/client/profile?${searchParams.toString()}`)}>
                    <PenTool className="h-4 w-4 mr-1" /> Configurar assinatura
                  </Button>
                )}
                {pendingList.length > 0 && effectiveSignatureData && (
                  <Badge variant="default">{pendingList.length} pendência(s)</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Page identifier — Portal {Empresa} */}
        {portalContextName && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 shadow-sm">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0 shadow-inner">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-primary/70 font-bold">Unidade Operacional</p>
              <p className="text-base sm:text-lg font-black text-foreground truncate leading-tight tracking-tight">{portalContextName}</p>
            </div>
          </div>
        )}

        {/* Welcome */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold truncate">Olá, {displayName?.split(' ')[0]}!</h1>
          <p className="text-sm text-muted-foreground">
            {pendingList.length > 0
              ? (portalSettings.pending_message || '{count} relatório(s) aguardando aprovação.').replace('{count}', String(pendingList.length))
              : (portalSettings.all_clear_message || 'Todos os relatórios estão em dia.')}
          </p>
        </div>

        {/* Portal Responsibles — WEES + Cliente */}
        <PortalResponsiblesCard companyId={responsiblesCompanyId} siteIds={responsiblesSiteIds} />

        {/* Signature Alert */}
        {portalSettings.show_supersign_alert !== false && !effectiveSignatureData && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{portalSettings.no_signature_alert_title || 'Assinatura WEES não configurada'}</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span className="text-sm">{portalSettings.no_signature_alert_message || 'Configure sua assinatura digital para aprovar relatórios.'}</span>
              <Button size="sm" variant="outline" onClick={() => navigate(`/client/profile?${searchParams.toString()}`)} className="w-fit">
                <PenTool className="h-4 w-4 mr-2" />Configurar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ===== TOP INDICATORS (COMPACT PILLS STYLE) ===== */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-full border border-border shadow-sm">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">RDOs</span>
            {reportsLoading ? <Skeleton className="h-4 w-6" /> : (
              <span className="text-sm font-bold ml-1">{metrics.total}</span>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--success))/5] rounded-full border border-[hsl(var(--success))/20] shadow-sm">
            <CheckCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
            <span className="text-xs font-semibold text-[hsl(var(--success))] uppercase tracking-wider">Assinados</span>
            {reportsLoading ? <Skeleton className="h-4 w-6" /> : (
              <span className="text-sm font-bold ml-1 text-[hsl(var(--success))]">{metrics.signed}</span>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/20 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Pendentes</span>
            {reportsLoading ? <Skeleton className="h-4 w-6" /> : (
              <span className="text-sm font-bold ml-1 text-primary">{metrics.pending}</span>
            )}
          </div>
        </div>

        {/* Histórico chart removed */}

        {/* ===== NAVEGAÇÃO POR PASTAS (ESTILO WINDOWS) ===== */}
        {visibleMonthFolders.length > 0 && (
          <div className="space-y-6">
            {!selectedMonthId ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 sm:gap-10 py-4">
                {visibleMonthFolders.map((month) => {
                  const isHidden = hiddenMonthKeys.has(`${month.year}-${month.month}`);
                  return (
                  <div
                    key={month.id}
                    className={cn('flex flex-col items-center gap-3 group cursor-pointer', isHidden && 'opacity-50')}
                    onClick={() => setSelectedMonthId(month.id)}
                  >
                    <div className="relative w-24 h-20 sm:w-32 sm:h-24 transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                      {/* Folder Rear Part */}
                      <div className="absolute inset-x-0 bottom-0 top-3 rounded-lg bg-[#e5b52a] shadow-sm" />
                      {/* Folder Tab */}
                      <div className="absolute top-0 left-0 w-10 h-6 rounded-t-lg bg-[#e5b52a]" />
                      {/* Folder Front Part (slightly slanted/offset for 3D effect) */}
                      <div className="absolute inset-x-0 bottom-0 top-5 rounded-lg bg-[#f4c430] shadow-md transition-transform group-hover:-rotate-1 origin-bottom-left" />
                      
                      {/* Icon overlay for visual cues */}
                      <div className="absolute inset-0 flex items-center justify-center pt-4">
                        <Calendar className="h-6 w-6 text-yellow-900/30" />
                      </div>

                      {/* Baixar todos os RDOs do mês */}
                      <button
                        type="button"
                        title="Baixar RDOs do mês (ZIP)"
                        onClick={(e) => handleDownloadMonth(e, month)}
                        disabled={downloadingMonthId === month.id}
                        className="absolute -top-2 -right-2 z-30 rounded-full bg-background border shadow-sm p-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 disabled:opacity-100"
                      >
                        {downloadingMonthId === month.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {/* Ocultar/reexibir pasta do mês (somente super admin) */}
                      {canToggleHiddenMonth && (
                        <button
                          type="button"
                          title={isHidden ? 'Reexibir pasta para o cliente' : 'Ocultar pasta do cliente'}
                          onClick={(e) => toggleHiddenMonth(e, month, isHidden)}
                          className="absolute -top-2 -left-2 z-30 rounded-full bg-background border shadow-sm p-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        >
                          {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                    <div className="text-center min-w-0 px-1">
                      <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{month.monthName}</p>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">{month.year}</p>
                      {isHidden && (
                        <Badge variant="secondary" className="mt-1 h-4 px-1.5 text-[10px]">Oculto</Badge>
                      )}
                      {downloadingMonthId === month.id && downloadProgress && (
                        <p className="text-[10px] text-primary font-semibold mt-0.5">
                          {downloadProgress.done}/{downloadProgress.total}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1 animate-in fade-in slide-in-from-left-4 duration-300">
                <PageBackHeader
                  onBack={() => setSelectedMonthId(null)}
                  icon={<Calendar className="h-5 w-5" />}
                  iconClassName="bg-yellow-100 text-yellow-700"
                  title={`${visibleMonthFolders.find(m => m.id === selectedMonthId)?.monthName ?? ''} ${visibleMonthFolders.find(m => m.id === selectedMonthId)?.year ?? ''}`}
                  className="mb-0"
                />

                <div className="flex flex-wrap items-center gap-4 px-1 py-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pendente de Assinatura</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f4c430] shadow-sm" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assinado ou Parcial</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 sm:gap-10 pt-1 pb-4">
                  {visibleMonthFolders.find(m => m.id === selectedMonthId)?.activities.map((a) => {
                    const status = a.pending === 0
                      ? 'completed'
                      : (a.signed > 0 || a.partial > 0) ? 'partial' : 'pending';
                    
                    return (
                      <div
                        key={a.id}
                        className="flex flex-col items-center gap-3 group cursor-pointer self-start"
                        onClick={() => {
                          const folder = visibleMonthFolders.find(m => m.id === selectedMonthId);
                          const params = new URLSearchParams(searchParams);
                          if (folder) {
                            params.set('year', String(folder.year));
                            params.set('month', String(folder.month));
                          }
                          navigate(`/client/activity/${encodeURIComponent(a.id)}?${params.toString()}`);
                        }}
                      >
                        <div className="relative w-24 h-20 sm:w-32 sm:h-24 transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                          {/* Renomear pasta de atividade */}
                          <button
                            type="button"
                            title="Renomear pasta"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget({
                                groupKey: a.id,
                                siteId: a.siteId,
                                currentName: a.name,
                                hasCustomName: a.hasCustomName,
                              });
                            }}
                            className="absolute -top-2 -right-2 z-30 rounded-full bg-background border shadow-sm p-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {/* Folder Rear Part */}
                          <div className={cn(
                            "absolute inset-x-0 bottom-0 top-3 rounded-lg shadow-sm",
                            status === 'pending' ? "bg-red-200" : "bg-[#e5b52a]"
                          )} />
                          {/* Folder Tab */}
                          <div className={cn(
                            "absolute top-0 left-0 w-10 h-6 rounded-t-lg",
                            status === 'pending' ? "bg-red-200" : "bg-[#e5b52a]"
                          )} />
                          {/* Folder Front Part */}
                          <div className={cn(
                            "absolute inset-x-0 bottom-0 top-5 rounded-lg shadow-md transition-transform group-hover:-rotate-1 origin-bottom-left",
                            status === 'pending' ? "bg-red-500" : "bg-[#f4c430]"
                          )} />
                          
                          {/* Status Icon Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pt-4">
                            {status === 'completed' ? (
                              <CheckCircle className="h-6 w-6 text-green-800/40" />
                            ) : (
                              <Activity className={cn("h-6 w-6", status === 'pending' ? "text-white/40" : "text-yellow-900/30")} />
                            )}
                          </div>
                        </div>
                        <div className="text-center min-w-0 px-1 w-full">
                          <p
                            title={a.name}
                            className={cn(
                              "font-bold text-sm break-words leading-snug transition-colors",
                              status === 'pending' ? "text-red-600 group-hover:text-red-700" : "text-foreground group-hover:text-primary"
                            )}
                          >
                            {a.name}
                          </p>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                            {a.total} RDO(s)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}


        {/* Empty state removed as per user request */}
      </div>

      <RenameActivityDialog
        target={renameTarget}
        isSaving={renamingActivity}
        onOpenChange={(open) => { if (!open) setRenameTarget(null); }}
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
    </ClientLayout>
  );
}
