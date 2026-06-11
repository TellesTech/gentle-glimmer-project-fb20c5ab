import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/loose-client';
import { calculateWorkHours, mergeAndCalculateWorkHours } from '@/lib/workforceCalculations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, subMonths, subDays, parseISO } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Loader2, FileSpreadsheet, FileText, Trash2, Upload, BarChart3, Brain, AlertTriangle, ClipboardList, Factory, RefreshCw } from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import { normalizeFunction, JOB_FUNCTIONS, getBaseFunction } from '@/lib/jobFunctions';
import { resolveWorkerFunction, ProfileEntry } from '@/lib/resolveWorkerFunction';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkforceDashboardTab } from '@/components/workforce/WorkforceDashboardTab';
import { WorkforceReportsTab } from '@/components/workforce/WorkforceReportsTab';
import { WorkforceAITab } from '@/components/workforce/WorkforceAITab';
import { WorkforceDelaysTab } from '@/components/workforce/WorkforceDelaysTab';

interface WorkforceRecord {
  id: string;
  activity_name: string;
  date: string;
  worker_name: string;
  function_role: string | null;
  start_time: string | null;
  end_time: string | null;
  normal_hours: number;
  compensation_hours: number;
  overtime_75: number;
  overtime_100: number;
  night_bonus: number;
  processed_by_ai: boolean;
  source?: 'rdo' | 'manual';
}

interface DelayRecord {
  id: string;
  activity_name: string;
  date: string;
  reason: string | null;
  description: string;
  hours: string;
  source: 'rdo' | 'manual';
}

const formatHHMM = (decimalHours: number) => {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

const formatHHMMSS = (decimalHours: number) => {
  const h = Math.floor(decimalHours);
  const m = Math.floor((decimalHours - h) * 60);
  const s = Math.round(((decimalHours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function WorkforceDatabase() {
  const { role, profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<WorkforceRecord[]>([]);
  const [delays, setDelays] = useState<DelayRecord[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string; lastReportDate: string | null }[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [projects, setProjects] = useState<{ id: string; name: string; site_id: string | null }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [lastReportDate, setLastReportDate] = useState<string | null>(null);
  
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadSites(); loadProjects(); }, []);
  useEffect(() => { loadRecords(); loadDelays(); loadLastReportDate(); }, [startDate, endDate, selectedProject, selectedSite]);

  const loadSites = async () => {
    // Buscar sites + último RDO de cada site (via projects + reports)
    const { data: sitesData } = await supabase.from('sites').select('id, name').order('name');
    if (!sitesData) return;

    // Buscar último RDO por site em páginas
    const lastBySite: Record<string, string> = {};
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: lastReports, error } = await supabase
        .from('reports')
        .select('date, projects!inner(site_id)')
        .order('date', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error || !lastReports || lastReports.length === 0) break;

      for (const r of (lastReports || []) as any[]) {
        const sId = r.projects?.site_id;
        if (sId && !lastBySite[sId]) lastBySite[sId] = r.date;
      }

      if (lastReports.length < pageSize) hasMore = false;
      from += pageSize;
      
      // Se já achamos data para todos os sites, podemos parar mais cedo
      if (Object.keys(lastBySite).length === sitesData.length) break;
    }

    setSites(sitesData.map(s => ({ ...s, lastReportDate: lastBySite[s.id] || null })));
  };

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name, site_id').order('name');
    if (data) setProjects(data);
  };

  const loadLastReportDate = async () => {
    let q = supabase.from('reports').select('date, projects!inner(site_id)').order('date', { ascending: false }).limit(1);
    if (selectedProject !== 'all') {
      q = q.eq('project_id', selectedProject);
    } else if (selectedSite !== 'all') {
      q = q.eq('projects.site_id', selectedSite);
    }
    const { data } = await q;
    setLastReportDate((data && data[0]?.date) || null);
  };

  const filteredProjects = selectedSite === 'all'
    ? projects
    : projects.filter(p => p.site_id === selectedSite);

  const handleSiteChange = (value: string) => {
    setSelectedSite(value);
    setSelectedProject('all');
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      // 1. Buscar dados automáticos dos RDOs (reports + report_attendance) com PAGINAÇÃO
      const attendanceData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let rdoQuery = supabase
          .from('report_attendance')
          .select(`
            id,
            user_name,
            arrival_time,
            departure_time,
            present,
            user_id,
            report_id,
            reports!inner(id, date, project_id, shift, projects(name))
          `)
          .eq('present', true)
          .gte('reports.date', startDate)
          .lte('reports.date', endDate)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (selectedProject !== 'all') {
          rdoQuery = rdoQuery.eq('reports.project_id', selectedProject);
        } else if (selectedSite !== 'all') {
          const siteProjectIds = projects.filter(p => p.site_id === selectedSite).map(p => p.id);
          if (siteProjectIds.length > 0) {
            rdoQuery = rdoQuery.in('reports.project_id', siteProjectIds);
          } else {
            setRecords([]);
            setLoading(false);
            return;
          }
        }

        const { data: page, error: attError } = await rdoQuery;
        if (attError) {
          console.error('Error loading attendance page:', attError);
          break;
        }
        
        if (!page || page.length === 0) break;
        attendanceData.push(...page);
        
        if (page.length < pageSize) hasMore = false;
        from += pageSize;
      }


      // 2. Buscar TODOS os profiles para matching inteligente
      const { data: allProfilesRaw } = await supabase
        .from('profiles')
        .select('id, name, job_title');
      const allProfiles: ProfileEntry[] = (allProfilesRaw || []).filter(p => p.name && p.job_title) as ProfileEntry[];
      const profilesById: Record<string, string> = {};
      for (const p of allProfiles) {
        if (p.job_title) profilesById[p.id] = p.job_title;
      }

      // 3. Converter attendance em WorkforceRecord com cálculo CLT
      // Agrupar por worker+date para mesclar turnos do mesmo dia
      const attByKey = new Map<string, any[]>();
      for (const att of (attendanceData || [])) {
        const report = (att as any).reports as any;
        const date = report?.date || '';
        const name = ((att as any).user_name || 'Sem nome').trim().toUpperCase();
        const key = `${name}|${date}`;
        if (!attByKey.has(key)) attByKey.set(key, []);
        attByKey.get(key)!.push(att);
      }

      const rdoRecords: WorkforceRecord[] = [];
      for (const [, group] of attByKey) {
        const first = group[0] as any;
        const report = first.reports as any;
        const projectName = report?.projects?.name || 'Sem projeto';
        const functionRole = resolveWorkerFunction(
          first.user_name, first.user_id, null, profilesById, allProfiles
        );

        const shifts = group
          .filter((a: any) => a.arrival_time && a.departure_time)
          .map((a: any) => ({ start: a.arrival_time, end: a.departure_time }));

        const hours = shifts.length > 1
          ? mergeAndCalculateWorkHours(shifts)
          : calculateWorkHours(first.arrival_time, first.departure_time);

        const mergedStart = group.reduce((earliest: string | null, a: any) => {
          if (!a.arrival_time) return earliest;
          return !earliest || a.arrival_time < earliest ? a.arrival_time : earliest;
        }, null as string | null);
        const mergedEnd = group.reduce((latest: string | null, a: any) => {
          if (!a.departure_time) return latest;
          return !latest || a.departure_time > latest ? a.departure_time : latest;
        }, null as string | null);

        rdoRecords.push({
          id: `rdo-${first.id}`,
          activity_name: projectName,
          date: report?.date || '',
          worker_name: first.user_name || 'Sem nome',
          function_role: functionRole,
          start_time: mergedStart,
          end_time: mergedEnd,
          normal_hours: hours.normalHours,
          compensation_hours: hours.compensationHours,
          overtime_75: hours.overtime75,
          overtime_100: hours.overtime100,
          night_bonus: hours.nightBonus,
          processed_by_ai: false,
          source: 'rdo' as const,
        });
      }

      // 4. Buscar dados manuais (workforce_database) para mesclar — COM PAGINAÇÃO
      const manualData: any[] = [];
      let mFrom = 0;
      const mPageSize = 1000;
      let mHasMore = true;

      while (mHasMore) {
        let manualQuery = supabase
          .from('workforce_database')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(mFrom, mFrom + mPageSize - 1);
        if (selectedProject !== 'all') manualQuery = manualQuery.eq('project_id', selectedProject);

        const { data: mPage, error: mErr } = await manualQuery;
        if (mErr) {
          console.error('Error loading manual workforce page:', mErr);
          break;
        }
        if (!mPage || mPage.length === 0) break;
        manualData.push(...mPage);
        if (mPage.length < mPageSize) mHasMore = false;
        mFrom += mPageSize;
      }

      const manualRecords: WorkforceRecord[] = (manualData || []).map((r: any) => ({
        ...r,
        source: 'manual' as const,
      }));

      // 5. Deduplicar: RDO tem prioridade sobre manual
      const rdoKeys = new Set(
        rdoRecords.map(r => `${r.worker_name.trim().toUpperCase()}|${r.date}`)
      );
      const filteredManual = manualRecords.filter(r =>
        !rdoKeys.has(`${r.worker_name.trim().toUpperCase()}|${r.date}`)
      );

      const allRecords = [...rdoRecords, ...filteredManual].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.worker_name.localeCompare(b.worker_name);
      });

      setRecords(allRecords);
    } catch (err) {
      console.error('Error loading records:', err);
    }
    setLoading(false);
  };

  const loadDelays = async () => {
    const allDelayRecords: DelayRecord[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Fetch all RDO deviations (operational, climatic, AMT)
    const deviationTypes = [
      { hoursKey: 'operational_deviation_hours', detailsKey: 'operational_deviation_details', reasonKey: 'operational_deviation_reason', label: 'Operacional' },
      { hoursKey: 'climatic_deviation_hours', detailsKey: 'climatic_deviation_details', reasonKey: 'climatic_deviation_reason', label: 'Climático' },
      { hoursKey: 'amt_deviation_hours', detailsKey: 'amt_deviation_details', reasonKey: 'amt_deviation_reason', label: 'AMT' },
    ];

    // Load RDO deviations with pagination
    while (hasMore) {
      let query = supabase
        .from('reports')
        .select('id, date, operational_deviation_hours, operational_deviation_details, operational_deviation_reason, climatic_deviation_hours, climatic_deviation_details, climatic_deviation_reason, amt_deviation_hours, amt_deviation_details, amt_deviation_reason, project_id, projects(name, site_id)')
        .gte('date', startDate)
        .lte('date', endDate)
        .range(from, from + pageSize - 1)
        .order('date', { ascending: true })
        .order('id', { ascending: true });

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject);
      } else if (selectedSite !== 'all') {
        const siteProjectIds = projects.filter(p => p.site_id === selectedSite).map(p => p.id);
        if (siteProjectIds.length > 0) {
          query = query.in('project_id', siteProjectIds);
        }
      }

      const { data: page, error } = await query;
      if (error || !page || page.length === 0) break;

      for (const report of page) {
        const projectName = (report as any).projects?.name || 'N/A';
        
        // Extract all deviation types from this report
        for (const dt of deviationTypes) {
          const hours = (report as any)[dt.hoursKey];
          const details = (report as any)[dt.detailsKey];
          const reason = (report as any)[dt.reasonKey];
          
          // Only add if there are hours or details
          if (hours || (details && details.trim())) {
            // Parse hours format (HH:MM:SS or HH:MM or decimal)
            let hoursStr = '00:00';
            if (hours) {
              if (typeof hours === 'string') {
                hoursStr = hours.substring(0, 5); // Get HH:MM
              } else if (typeof hours === 'number') {
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                hoursStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              }
            }
            
            allDelayRecords.push({
              id: `rdo-${report.id}-${dt.label}`,
              activity_name: projectName,
              date: report.date,
              reason: reason || dt.label,
              description: details || '',
              hours: hoursStr,
              source: 'rdo',
            });
          }
        }
      }

      if (page.length < pageSize) hasMore = false;
      from += pageSize;
    }

    // Load manual delays from workforce_delays
    let mFrom = 0;
    let mHasMore = true;
    while (mHasMore) {
      let query = supabase
        .from('workforce_delays')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .range(mFrom, mFrom + pageSize - 1)
        .order('date', { ascending: true });

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject);
      } else if (selectedSite !== 'all') {
        const siteProjectIds = projects.filter(p => p.site_id === selectedSite).map(p => p.id);
        if (siteProjectIds.length > 0) {
          query = query.in('project_id', siteProjectIds);
        }
      }

      const { data: page, error } = await query;
      if (error || !page || page.length === 0) break;

      for (const delay of page) {
        // Convert decimal hours to HH:MM
        const h = Math.floor(delay.delay_hours);
        const m = Math.round((delay.delay_hours - h) * 60);
        const hoursStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        allDelayRecords.push({
          id: delay.id,
          activity_name: delay.activity_name,
          date: delay.date,
          reason: delay.delay_type || 'Outro',
          description: delay.description || '',
          hours: hoursStr,
          source: 'manual',
        });
      }

      if (page.length < pageSize) mHasMore = false;
      mFrom += pageSize;
    }

    setDelays(allDelayRecords);
  };


  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('Planilha vazia');
      const rawData: Record<string, any>[] = [];
      const headers: string[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, colNumber) => { headers[colNumber] = String(cell.value || ''); });
        } else {
          const obj: Record<string, any> = {};
          row.eachCell((cell, colNumber) => { obj[headers[colNumber] || `col${colNumber}`] = cell.value; });
          if (Object.keys(obj).length > 0) rawData.push(obj);
        }
      });
      if (rawData.length === 0) throw new Error('Nenhum dado encontrado');
      const { data, error } = await supabase.functions.invoke('process-workforce-data', {
        body: { action: 'import-spreadsheet', rawData, project_id: selectedProject !== 'all' ? selectedProject : null },
      });
      if (error) throw error;
      toast({ title: 'Importação concluída', description: data.message });
      await loadRecords();
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearRecords = async () => {
    let query = supabase.from('workforce_database').delete().gte('date', startDate).lte('date', endDate);
    if (selectedProject !== 'all') query = query.eq('project_id', selectedProject);
    const { error } = await query;
    if (!error) { setRecords([]); toast({ title: 'Registros removidos' }); }
  };

  // Materializa RDOs do período filtrado em workforce_database e workforce_delays
  const syncFromRdos = async () => {
    setSyncing(true);
    try {
      // 1) Buscar presenças do período (com paginação) respeitando filtros
      const attendanceData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .from('report_attendance')
          .select(`
            id, user_name, arrival_time, departure_time, present, user_id, report_id,
            reports!inner(id, date, project_id, projects!inner(id, name, site_id, sites!inner(company_id)))
          `)
          .eq('present', true)
          .gte('reports.date', startDate)
          .lte('reports.date', endDate)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (selectedProject !== 'all') {
          q = q.eq('reports.project_id', selectedProject);
        } else if (selectedSite !== 'all') {
          const siteProjectIds = projects.filter(p => p.site_id === selectedSite).map(p => p.id);
          if (siteProjectIds.length === 0) break;
          q = q.in('reports.project_id', siteProjectIds);
        }

        const { data: page, error } = await q;
        if (error) throw error;
        if (!page || page.length === 0) break;
        attendanceData.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }

      // 2) Agrupar por (worker+date) — mesma chave usada em loadRecords
      const groups = new Map<string, any[]>();
      for (const att of attendanceData) {
        const report = (att as any).reports;
        const date = report?.date || '';
        const name = ((att as any).user_name || 'Sem nome').trim().toUpperCase();
        const key = `${name}|${date}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(att);
      }

      // 3) Upsert em workforce_database
      const rows: any[] = [];
      const orphanIds: string[] = [];
      for (const [, group] of groups) {
        const first = group[0];
        const report = first.reports as any;
        const project = report?.projects as any;
        const shifts = group
          .filter((a: any) => a.arrival_time && a.departure_time)
          .map((a: any) => ({ start: a.arrival_time, end: a.departure_time }));
        const hours = shifts.length > 1
          ? mergeAndCalculateWorkHours(shifts)
          : calculateWorkHours(first.arrival_time, first.departure_time);
        const mergedStart = group.reduce((earliest: string | null, a: any) =>
          !a.arrival_time ? earliest : (!earliest || a.arrival_time < earliest ? a.arrival_time : earliest), null);
        const mergedEnd = group.reduce((latest: string | null, a: any) =>
          !a.departure_time ? latest : (!latest || a.departure_time > latest ? a.departure_time : latest), null);

        rows.push({
          report_id: report?.id,
          project_id: report?.project_id,
          attendance_id: first.id,
          company_id: project?.sites?.company_id ?? null,
          activity_name: project?.name || 'Sem projeto',
          date: report?.date,
          worker_name: first.user_name || 'Sem nome',
          function_role: null,
          start_time: mergedStart,
          end_time: mergedEnd,
          normal_hours: hours.normalHours,
          compensation_hours: hours.compensationHours,
          overtime_75: hours.overtime75,
          overtime_100: hours.overtime100,
          night_bonus: hours.nightBonus,
          processed_by_ai: false,
        });
        for (let i = 1; i < group.length; i++) orphanIds.push(group[i].id);
      }

      let presencasUpserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase
          .from('workforce_database')
          .upsert(batch, { onConflict: 'attendance_id' });
        if (error) throw error;
        presencasUpserted += batch.length;
      }

      // Remove linhas órfãs (turnos secundários do mesmo grupo que possam ter sido gravados antes)
      if (orphanIds.length > 0) {
        await supabase.from('workforce_database').delete().in('attendance_id', orphanIds);
      }

      // 4) Sincronizar atrasos (deviations) dos reports
      let reportsQ = supabase
        .from('reports')
        .select('id, date, project_id, operational_deviation_hours, operational_deviation_details, operational_deviation_reason, climatic_deviation_hours, climatic_deviation_details, climatic_deviation_reason, amt_deviation_hours, amt_deviation_details, amt_deviation_reason, projects!inner(id, name, site_id, sites!inner(company_id))')
        .gte('date', startDate)
        .lte('date', endDate);
      if (selectedProject !== 'all') {
        reportsQ = reportsQ.eq('project_id', selectedProject);
      } else if (selectedSite !== 'all') {
        const siteProjectIds = projects.filter(p => p.site_id === selectedSite).map(p => p.id);
        if (siteProjectIds.length > 0) reportsQ = reportsQ.in('project_id', siteProjectIds);
      }
      const { data: reportRows, error: rErr } = await reportsQ;
      if (rErr) throw rErr;

      const delayRows: any[] = [];
      const sources = [
        { src: 'operational', h: 'operational_deviation_hours', d: 'operational_deviation_details', r: 'operational_deviation_reason', enum: 'outro' },
        { src: 'climatic', h: 'climatic_deviation_hours', d: 'climatic_deviation_details', r: 'climatic_deviation_reason', enum: 'clima' },
        { src: 'amt', h: 'amt_deviation_hours', d: 'amt_deviation_details', r: 'amt_deviation_reason', enum: 'outro' },
      ];
      for (const rep of (reportRows || []) as any[]) {
        for (const s of sources) {
          const hrs = parseFloat(rep[s.h] || 0);
          if (!hrs || hrs <= 0) continue;
          delayRows.push({
            report_id: rep.id,
            delay_source: s.src,
            project_id: rep.project_id,
            company_id: rep.projects?.sites?.company_id ?? null,
            activity_name: rep.projects?.name || 'Sem projeto',
            date: rep.date,
            description: rep[s.d] || rep[s.r] || s.src,
            delay_type: s.enum,
            delay_hours: hrs,
          });
        }
      }
      let atrasosUpserted = 0;
      for (let i = 0; i < delayRows.length; i += 500) {
        const batch = delayRows.slice(i, i + 500);
        const { error } = await supabase
          .from('workforce_delays')
          .upsert(batch, { onConflict: 'report_id,delay_source' });
        if (error) throw error;
        atrasosUpserted += batch.length;
      }

      toast({
        title: 'Sincronização concluída',
        description: `${presencasUpserted} presença(s) e ${atrasosUpserted} atraso(s) materializados.`,
      });
      await Promise.all([loadRecords(), loadDelays()]);
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      toast({ title: 'Erro ao sincronizar', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setSyncing(false);
      setShowSyncConfirm(false);
    }
  };

  const numericFields = ['normal_hours', 'compensation_hours', 'overtime_75', 'overtime_100', 'night_bonus'];

  const startEditing = (id: string, field: string, currentValue: string | number | null) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue ?? ''));
  };

  const cancelEditing = () => { setEditingCell(null); setEditValue(''); };

  const saveEdit = useCallback(async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const record = records.find(r => r.id === id);
    if (!record || record.source === 'rdo') { cancelEditing(); return; }
    const oldValue = (record as any)[field];
    let newValue: any = editValue;
    if (numericFields.includes(field)) newValue = parseFloat(editValue.replace(',', '.')) || 0;
    if (String(oldValue ?? '') === String(newValue)) { cancelEditing(); return; }
    const { error } = await supabase.from('workforce_database').update({ [field]: newValue }).eq('id', id);
    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    else setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: newValue } : r));
    cancelEditing();
  }, [editingCell, editValue, records]);

  const handleDeleteRecord = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('workforce_database').delete().eq('id', deleteTarget);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { setRecords(prev => prev.filter(r => r.id !== deleteTarget)); toast({ title: 'Registro excluído' }); }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const renderEditableCell = (record: WorkforceRecord, field: string, displayValue: string, className?: string) => {
    const isEditing = editingCell?.id === record.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <Input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEditing(); }} className="h-7 text-sm min-w-[60px]" />
      );
    }
    return (
      <span className={`cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded transition-colors ${className || ''}`} onClick={() => startEditing(record.id, field, (record as any)[field])}>
        {displayValue}
      </span>
    );
  };

  const totals = records.reduce((acc, r) => ({ hn: acc.hn + r.normal_hours, com: acc.com + r.compensation_hours, h75: acc.h75 + r.overtime_75, h100: acc.h100 + r.overtime_100, adn: acc.adn + r.night_bonus }), { hn: 0, com: 0, h75: 0, h100: 0, adn: 0 });

  const byRole = records.reduce((acc, r) => {
    const normalized = normalizeFunction(r.function_role) || 'MEIO OFICIAL';
    const validRole = (JOB_FUNCTIONS as readonly string[]).includes(normalized) ? normalized : 'MEIO OFICIAL';
    const roleName = getBaseFunction(validRole);
    if (!acc[roleName]) acc[roleName] = { workers: new Set<string>(), hn: 0, com: 0, h75: 0, h100: 0, adn: 0 };
    acc[roleName].workers.add(r.worker_name.trim().toUpperCase());
    acc[roleName].hn += r.normal_hours;
    acc[roleName].com += r.compensation_hours;
    acc[roleName].h75 += r.overtime_75;
    acc[roleName].h100 += r.overtime_100;
    acc[roleName].adn += r.night_bonus;
    return acc;
  }, {} as Record<string, { workers: Set<string>; hn: number; com: number; h75: number; h100: number; adn: number }>);
  const totalUniqueWorkers = new Set(records.map(r => r.worker_name.trim().toUpperCase())).size;

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const headerStyle: Partial<ExcelJS.Style> = { font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2332' } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { bottom: { style: 'thin' } } };
    const ws = wb.addWorksheet('Base de Dados HH');
    ws.columns = [{ header: 'ATIVIDADE', key: 'activity', width: 30 }, { header: 'DIA', key: 'date', width: 12 }, { header: 'NOME', key: 'name', width: 25 }, { header: 'FUNÇÃO', key: 'role', width: 20 }, { header: 'INÍCIO', key: 'start', width: 18 }, { header: 'FIM', key: 'end', width: 16 }, { header: 'HN', key: 'hn', width: 8 }, { header: 'COM', key: 'com', width: 8 }, { header: 'HH-75%', key: 'h75', width: 8 }, { header: 'HH-100%', key: 'h100', width: 10 }, { header: 'ADN', key: 'adn', width: 8 }];
    ws.getRow(1).eachCell(cell => { Object.assign(cell, { style: headerStyle }); });
    records.forEach(r => {
      const fnNorm = normalizeFunction(r.function_role) || 'MEIO OFICIAL';
      const fnValid = (JOB_FUNCTIONS as readonly string[]).includes(fnNorm) ? fnNorm : 'MEIO OFICIAL';
      ws.addRow({ activity: r.activity_name?.toUpperCase(), date: format(new Date(r.date + 'T12:00:00'), 'dd/MM/yyyy'), name: r.worker_name, role: getBaseFunction(fnValid), start: r.start_time || '', end: r.end_time || '', hn: formatHHMM(r.normal_hours), com: formatHHMM(r.compensation_hours), h75: formatHHMM(r.overtime_75), h100: formatHHMM(r.overtime_100), adn: formatHHMM(r.night_bonus) });
    });
    const totalRow = ws.addRow({ activity: 'TOTAL', hn: formatHHMM(totals.hn), com: formatHHMM(totals.com), h75: formatHHMM(totals.h75), h100: formatHHMM(totals.h100), adn: formatHHMM(totals.adn) });
    totalRow.font = { bold: true };
    const wsResumo = wb.addWorksheet('Resumo por Função');
    wsResumo.columns = [{ header: 'FUNÇÃO', key: 'role', width: 25 }, { header: 'QTD', key: 'count', width: 8 }, { header: 'HN', key: 'hn', width: 12 }, { header: 'COM', key: 'com', width: 12 }, { header: 'HH-75%', key: 'h75', width: 12 }, { header: 'HH-100%', key: 'h100', width: 12 }, { header: 'ADN', key: 'adn', width: 12 }];
    wsResumo.getRow(1).eachCell(cell => { Object.assign(cell, { style: headerStyle }); });
    Object.entries(byRole).sort(([a], [b]) => a.localeCompare(b)).forEach(([roleName, data]) => { wsResumo.addRow({ role: roleName, count: data.workers.size, hn: formatHHMMSS(data.hn), com: formatHHMMSS(data.com), h75: formatHHMMSS(data.h75), h100: formatHHMMSS(data.h100), adn: formatHHMMSS(data.adn) }); });
    const totalResumo = wsResumo.addRow({ role: 'TOTAL GERAL', count: totalUniqueWorkers, hn: formatHHMMSS(totals.hn), com: formatHHMMSS(totals.com), h75: formatHHMMSS(totals.h75), h100: formatHHMMSS(totals.h100), adn: formatHHMMSS(totals.adn) });
    totalResumo.font = { bold: true };
    if (delays.length > 0) {
      const wsAtrasos = wb.addWorksheet('Atrasos no Período');
      wsAtrasos.columns = [
        { header: 'DATA', key: 'date', width: 15 },
        { header: 'ATIVIDADE / PROJETO', key: 'activity', width: 30 },
        { header: 'MOTIVO', key: 'reason', width: 20 },
        { header: 'DESCRIÇÃO', key: 'description', width: 50 },
        { header: 'TEMPO', key: 'hours', width: 12 }
      ];
      wsAtrasos.getRow(1).eachCell(cell => { Object.assign(cell, { style: headerStyle }); });
      
      delays.forEach(d => {
        wsAtrasos.addRow({
          date: format(new Date(d.date + 'T12:00:00'), 'dd/MM/yyyy'),
          activity: d.activity_name?.toUpperCase(),
          reason: d.reason || '',
          description: d.description || '',
          hours: d.hours
        });
      });

      const totalDelayMinutes = delays.reduce((acc, d) => {
        const parts = (d.hours || '00:00').split(':');
        const h = parseInt(parts[0] || '0', 10);
        const m = parseInt(parts[1] || '0', 10);
        return acc + (h * 60) + m;
      }, 0);
      
      const totalH = Math.floor(totalDelayMinutes / 60);
      const totalM = totalDelayMinutes % 60;
      const totalDelayStr = `${String(totalH).padStart(2, '0')}:${String(totalM).padStart(2, '0')}`;

      const totalAtrasosRow = wsAtrasos.addRow({
        date: 'TOTAL',
        hours: totalDelayStr
      });
      totalAtrasosRow.font = { bold: true };
    }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `base_dados_hh_${startDate}_${endDate}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    // Fetch branding
    const { data: brandingData } = await supabase.rpc('get_public_branding');
    const branding = brandingData?.[0];
    const primaryHex = branding?.primary_color || '#991919';
    const accentHex = branding?.accent_color || '#6B0F0F';
    const systemName = branding?.system_name || 'Sistema RDO';

    const hexToRgb = (hex: string): [number, number, number] => {
      const h = hex.replace('#', '');
      return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
    };
    const primaryRgb = hexToRgb(primaryHex);
    const accentRgb = hexToRgb(accentHex);

    // Fetch logo
    let logoBase64: string | null = null;
    try {
      const { getLogoBase64 } = await import('@/lib/logoBase64');
      logoBase64 = await getLogoBase64();
    } catch { /* no logo */ }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const headerH = 28;

    // Header with primary color
    doc.setFillColor(...primaryRgb); doc.rect(0, 0, pageW, headerH, 'F');

    // Logo — preserve aspect ratio within max box 14mm tall × 28mm wide
    let logoEndX = 10;
    if (logoBase64) {
      try {
        const imgProps = doc.getImageProperties(logoBase64);
        const aspectRatio = imgProps.width / imgProps.height;
        const maxH = 14;
        const maxW = 28;
        let logoH = maxH;
        let logoW = logoH * aspectRatio;
        if (logoW > maxW) { logoW = maxW; logoH = logoW / aspectRatio; }
        const logoX = 8;
        const logoY = (headerH - logoH) / 2;
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH);
        logoEndX = logoX + logoW + 4;
      } catch { /* skip */ }
    }

    // Title — centered on page
    doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text('BASE DE DADOS — HOMEM-HORA', pageW / 2, headerH / 2 - 1, { align: 'center' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${format(new Date(startDate + 'T12:00:00'), 'dd/MM/yyyy')} a ${format(new Date(endDate + 'T12:00:00'), 'dd/MM/yyyy')}`, pageW / 2, headerH / 2 + 5, { align: 'center' });

    // Accent line
    doc.setFillColor(...accentRgb); doc.rect(0, headerH, pageW, 1, 'F');

    const cols = ['ATIVIDADE', 'DIA', 'NOME', 'FUNÇÃO', 'INÍCIO', 'FIM', 'HN', 'COM', 'HH-75%', 'HH-100%', 'ADN'];
    const colWidths = [50, 22, 40, 30, 16, 16, 14, 14, 16, 18, 14];
    let y = headerH + 5; const startX = 10;
    const drawTableHeader = () => {
      doc.setFillColor(...accentRgb); doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      let x = startX; cols.forEach((col, i) => { doc.text(col, x + colWidths[i] / 2, y + 5, { align: 'center' }); x += colWidths[i]; }); y += 7;
    };
    drawTableHeader(); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    records.forEach((r, idx) => {
      if (y > 190) { doc.addPage(); y = 10; drawTableHeader(); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); }
      const bg = idx % 2 === 0 ? [245, 245, 245] : [255, 255, 255];
      doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 6, 'F');
      doc.setTextColor(30, 30, 30);
      const values = [(r.activity_name || '').toUpperCase().substring(0, 25), format(new Date(r.date + 'T12:00:00'), 'dd/MM/yy'), r.worker_name.substring(0, 20), normalizeFunction(r.function_role).substring(0, 15), r.start_time || '', r.end_time || '', formatHHMM(r.normal_hours), formatHHMM(r.compensation_hours), formatHHMM(r.overtime_75), formatHHMM(r.overtime_100), formatHHMM(r.night_bonus)];
      let x = startX; values.forEach((val, i) => { const align = i >= 6 ? 'center' : 'left'; doc.text(val, align === 'center' ? x + colWidths[i] / 2 : x + 1, y + 4, { align }); x += colWidths[i]; }); y += 6;
    });
    // Totals row with primary color
    doc.setFillColor(...primaryRgb); doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    let x = startX;
    const totalValues = ['TOTAL', '', '', '', '', '', formatHHMM(totals.hn), formatHHMM(totals.com), formatHHMM(totals.h75), formatHHMM(totals.h100), formatHHMM(totals.adn)];
    totalValues.forEach((val, i) => { const align = i >= 6 || i === 0 ? 'center' : 'left'; doc.text(val, align === 'center' ? x + colWidths[i] / 2 : x + 1, y + 5, { align }); x += colWidths[i]; });
    // Footer with dynamic system name
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(6); doc.setTextColor(128, 128, 128); doc.text(`Gerado por ${systemName} — ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, pageH - 5, { align: 'center' });
    // Atrasos section in PDF
    if (delays.length > 0) {
      doc.addPage();
      y = 20;
      
      doc.setFillColor(...primaryRgb);
      doc.rect(0, 0, pageW, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO DE ATRASOS NO PERÍODO', pageW / 2, 10, { align: 'center' });
      
      const delayCols = ['DATA', 'ATIVIDADE / PROJETO', 'MOTIVO', 'DESCRIÇÃO', 'TEMPO'];
      const delayWidths = [30, 60, 40, 90, 30];
      const delayStartX = (pageW - delayWidths.reduce((a, b) => a + b, 0)) / 2;
      
      const drawDelayHeader = () => {
        doc.setFillColor(...accentRgb);
        doc.rect(delayStartX, y, delayWidths.reduce((a, b) => a + b, 0), 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        let x = delayStartX;
        delayCols.forEach((col, i) => {
          doc.text(col, x + delayWidths[i] / 2, y + 5, { align: 'center' });
          x += delayWidths[i];
        });
        y += 7;
      };
      
      drawDelayHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      
      delays.sort((a, b) => b.date.localeCompare(a.date)).forEach((d, idx) => {
        if (y > 185) {
          doc.addPage();
          y = 20;
          drawDelayHeader();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
        }
        
        const bg = idx % 2 === 0 ? [245, 245, 245] : [255, 255, 255];
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.rect(delayStartX, y, delayWidths.reduce((a, b) => a + b, 0), 6, 'F');
        doc.setTextColor(30, 30, 30);
        
         const values = [
           format(new Date(d.date + 'T12:00:00'), 'dd/MM/yyyy'),
           (d.activity_name || '').toUpperCase().substring(0, 25),
           (d.reason || '').substring(0, 15),
           (d.description || '').substring(0, 50),
           d.hours || '00:00'
         ];
         
         let x = delayStartX;
         values.forEach((val, i) => {
           const align = i === 4 || i === 0 ? 'center' : 'left';
           doc.text(val, align === 'center' ? x + delayWidths[i] / 2 : x + 2, y + 4, { align });
           x += delayWidths[i];
         });
         y += 6;
      });
      
      // Total delay row
      const totalDelayMinutes = delays.reduce((acc, d) => {
        const parts = (d.hours || '00:00').split(':');
        const h = parseInt(parts[0] || '0', 10);
        const m = parseInt(parts[1] || '0', 10);
        return acc + (h * 60) + m;
      }, 0);
      const h = Math.floor(totalDelayMinutes / 60);
      const m = totalDelayMinutes % 60;
      const totalStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      doc.setFillColor(...primaryRgb);
      doc.rect(delayStartX, y, delayWidths.reduce((a, b) => a + b, 0), 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL DE HORAS PERDIDAS NO PERÍODO', delayStartX + 100, y + 5, { align: 'right' });
      doc.text(totalStr, delayStartX + delayWidths.reduce((a, b) => a + b, 0) - 15, y + 5, { align: 'center' });
    }
    doc.save(`base_dados_hh_${startDate}_${endDate}.pdf`);
  };

  if (role && !['admin', 'super_admin'].includes(role)) {
    return <div className="p-6 text-center text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Base de Dados HH
          </h1>
          <p className="text-muted-foreground text-sm">Homem-Hora — Dados automáticos dos RDOs</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1.5"><Label>Data Início</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Data Fim</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            <div className="min-w-0 space-y-1.5">
              <Label className="flex items-center gap-1"><Factory className="w-3.5 h-3.5" /> Fábrica</Label>
              <Select value={selectedSite} onValueChange={handleSiteChange}>
                <SelectTrigger className="truncate focus:ring-1 focus:ring-offset-0"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fábricas</SelectItem>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {s.name}
                        {s.lastReportDate ? (
                          <span className="text-[10px] text-muted-foreground">· último {format(parseISO(s.lastReportDate), 'dd/MM/yy')}</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">· sem RDOs</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Atividade / Projeto</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="truncate focus:ring-1 focus:ring-offset-0"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex-1">
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importing ? 'Importando...' : 'Importar Planilha'}
              </Button>
              {(role === 'admin' || role === 'super_admin') && (
                <Button
                  variant="default"
                  onClick={() => setShowSyncConfirm(true)}
                  disabled={syncing}
                  className="flex-1"
                  title="Materializa os RDOs do período filtrado em workforce_database/workforce_delays"
                >
                  {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {syncing ? 'Sincronizando...' : 'Sincronizar com RDOs'}
                </Button>
              )}
            </div>
          </div>

          {/* Atalhos rápidos de período */}
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
            <span className="text-xs text-muted-foreground font-medium mr-1">Período rápido:</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
              const now = new Date();
              setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
            }}>Mês atual</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
              const prev = subMonths(new Date(), 1);
              setStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
            }}>Mês anterior</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
              setStartDate(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
              setEndDate(format(new Date(), 'yyyy-MM-dd'));
            }}>Últimos 90 dias</Button>
            {lastReportDate && (
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => {
                const last = parseISO(lastReportDate);
                setStartDate(format(startOfMonth(last), 'yyyy-MM-dd'));
                setEndDate(format(endOfMonth(last), 'yyyy-MM-dd'));
              }}>Ir ao último RDO ({format(parseISO(lastReportDate), 'dd/MM/yy')})</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aviso quando filtro retorna vazio mas existe histórico */}
      {!loading && records.length === 0 && lastReportDate && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              <strong>Nenhum registro no período selecionado.</strong>{' '}
              {selectedSite !== 'all' || selectedProject !== 'all' ? (
                <>O último RDO {selectedProject !== 'all' ? 'deste projeto' : 'desta fábrica'} foi em <strong>{format(parseISO(lastReportDate), 'dd/MM/yyyy')}</strong>.</>
              ) : (
                <>O último RDO do sistema foi em <strong>{format(parseISO(lastReportDate), 'dd/MM/yyyy')}</strong>.</>
              )}
            </span>
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => {
              const last = parseISO(lastReportDate);
              setStartDate(format(startOfMonth(last), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(last), 'yyyy-MM-dd'));
            }}>Ir ao mês do último RDO</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
              setStartDate(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
              setEndDate(format(new Date(), 'yyyy-MM-dd'));
            }}>Ver últimos 90 dias</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Aviso quando fábrica não tem nenhum RDO */}
      {!loading && records.length === 0 && !lastReportDate && (selectedSite !== 'all' || selectedProject !== 'all') && (
        <Alert className="border-muted bg-muted/30">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-sm">
            <strong>Nenhum RDO cadastrado</strong> para a {selectedProject !== 'all' ? 'atividade' : 'fábrica'} selecionada.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions bar */}
      {(records.length > 0 || delays.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" /> Exportar Excel</Button>
            </TooltipTrigger>
            <TooltipContent>Exportar base de dados HH em formato Excel (.xlsx)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="w-4 h-4 mr-1" /> Exportar PDF</Button>
            </TooltipTrigger>
            <TooltipContent>Exportar base de dados HH em formato PDF</TooltipContent>
          </Tooltip>
          <Badge variant="secondary" className="ml-auto">{records.length} registros</Badge>
          {records.length > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={clearRecords}><Trash2 className="w-4 h-4 mr-1" /> Limpar</Button>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full md:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="detalhado" className="gap-1"><Database className="w-3.5 h-3.5" /> Detalhado</TabsTrigger>
          <TabsTrigger value="resumo" className="gap-1"><ClipboardList className="w-3.5 h-3.5" /> Resumo</TabsTrigger>
          <TabsTrigger value="atrasos" className="gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Atrasos</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1"><FileText className="w-3.5 h-3.5" /> Relatórios</TabsTrigger>
          <TabsTrigger value="ia" className="gap-1"><Brain className="w-3.5 h-3.5" /> IA & Previsões</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <WorkforceDashboardTab records={records} />
        </TabsContent>

        {/* Detalhado */}
        <TabsContent value="detalhado">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : records.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum registro encontrado</p>
                  <p className="text-sm">Os dados são preenchidos automaticamente a partir dos RDOs</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">ATIVIDADE</TableHead>
                        <TableHead className="font-bold">DIA</TableHead>
                        <TableHead className="font-bold">NOME</TableHead>
                        <TableHead className="font-bold">FUNÇÃO</TableHead>
                        <TableHead className="font-bold text-center">INÍCIO</TableHead>
                        <TableHead className="font-bold text-center">FIM</TableHead>
                        <TableHead className="font-bold text-center">HN</TableHead>
                        <TableHead className="font-bold text-center">COM</TableHead>
                        <TableHead className="font-bold text-center">HH-75%</TableHead>
                        <TableHead className="font-bold text-center">HH-100%</TableHead>
                        <TableHead className="font-bold text-center">ADN</TableHead>
                        <TableHead className="font-bold text-center w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map(r => {
                        const isRdo = r.source === 'rdo';
                        return (
                        <TableRow key={r.id} className={isRdo ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              {isRdo && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">RDO</Badge>}
                              {r.activity_name?.toUpperCase()}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{format(new Date(r.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-sm font-medium">{isRdo ? r.worker_name : renderEditableCell(r, 'worker_name', r.worker_name)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{isRdo ? normalizeFunction(r.function_role) : renderEditableCell(r, 'function_role', normalizeFunction(r.function_role))}</TableCell>
                          <TableCell className="text-sm text-center">{isRdo ? (r.start_time || '') : renderEditableCell(r, 'start_time', r.start_time || '')}</TableCell>
                          <TableCell className="text-sm text-center">{isRdo ? (r.end_time || '') : renderEditableCell(r, 'end_time', r.end_time || '')}</TableCell>
                          <TableCell className="text-sm text-center font-medium">{isRdo ? formatHHMM(r.normal_hours) : renderEditableCell(r, 'normal_hours', formatHHMM(r.normal_hours))}</TableCell>
                          <TableCell className="text-sm text-center">{isRdo ? formatHHMM(r.compensation_hours) : renderEditableCell(r, 'compensation_hours', formatHHMM(r.compensation_hours))}</TableCell>
                          <TableCell className="text-sm text-center text-orange-600">{isRdo ? formatHHMM(r.overtime_75) : renderEditableCell(r, 'overtime_75', formatHHMM(r.overtime_75), 'text-orange-600')}</TableCell>
                          <TableCell className="text-sm text-center text-red-600">{isRdo ? formatHHMM(r.overtime_100) : renderEditableCell(r, 'overtime_100', formatHHMM(r.overtime_100), 'text-red-600')}</TableCell>
                          <TableCell className="text-sm text-center text-blue-600">{isRdo ? formatHHMM(r.night_bonus) : renderEditableCell(r, 'night_bonus', formatHHMM(r.night_bonus), 'text-blue-600')}</TableCell>
                          <TableCell className="text-center p-1">
                            {!isRdo && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(r.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted font-bold border-t-2">
                        <TableCell colSpan={6} className="text-right font-bold">TOTAL</TableCell>
                        <TableCell className="text-center">{formatHHMM(totals.hn)}</TableCell>
                        <TableCell className="text-center">{formatHHMM(totals.com)}</TableCell>
                        <TableCell className="text-center text-orange-600">{formatHHMM(totals.h75)}</TableCell>
                        <TableCell className="text-center text-red-600">{formatHHMM(totals.h100)}</TableCell>
                        <TableCell className="text-center text-blue-600">{formatHHMM(totals.adn)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resumo */}
        <TabsContent value="resumo">
          <Card>
            <CardContent className="p-0">
              {records.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><Database className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="font-medium">Nenhum registro para resumir</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">FUNÇÃO</TableHead>
                        <TableHead className="font-bold text-center">QTD</TableHead>
                        <TableHead className="font-bold text-center">HN</TableHead>
                        <TableHead className="font-bold text-center">COM</TableHead>
                        <TableHead className="font-bold text-center">HH-75%</TableHead>
                        <TableHead className="font-bold text-center">HH-100%</TableHead>
                        <TableHead className="font-bold text-center">ADN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(byRole).sort(([a], [b]) => a.localeCompare(b)).map(([roleName, data]) => (
                        <TableRow key={roleName}>
                          <TableCell className="text-sm font-medium">{roleName}</TableCell>
                          <TableCell className="text-sm text-center">{data.workers.size}</TableCell>
                          <TableCell className="text-sm text-center">{formatHHMMSS(data.hn)}</TableCell>
                          <TableCell className="text-sm text-center">{formatHHMMSS(data.com)}</TableCell>
                          <TableCell className="text-sm text-center text-orange-600">{formatHHMMSS(data.h75)}</TableCell>
                          <TableCell className="text-sm text-center text-red-600">{formatHHMMSS(data.h100)}</TableCell>
                          <TableCell className="text-sm text-center text-blue-600">{formatHHMMSS(data.adn)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted font-bold border-t-2">
                        <TableCell className="font-bold">TOTAL GERAL</TableCell>
                        <TableCell className="text-center font-bold">{totalUniqueWorkers}</TableCell>
                        <TableCell className="text-center font-bold">{formatHHMMSS(totals.hn)}</TableCell>
                        <TableCell className="text-center font-bold">{formatHHMMSS(totals.com)}</TableCell>
                        <TableCell className="text-center font-bold text-orange-600">{formatHHMMSS(totals.h75)}</TableCell>
                        <TableCell className="text-center font-bold text-red-600">{formatHHMMSS(totals.h100)}</TableCell>
                        <TableCell className="text-center font-bold text-blue-600">{formatHHMMSS(totals.adn)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {delays.length > 0 && (
            <Card className="mt-6 border-amber-500/20">
              <div className="p-4 border-b bg-amber-50/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-lg text-amber-900">Atrasos no Período</h3>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Dias com atraso: <strong className="text-foreground">{new Set(delays.map(d => d.date)).size}</strong></span>
                  <span className="text-muted-foreground">Total horas perdidas: <strong className="text-destructive">
                    {(() => {
                      const totalMinutes = delays.reduce((acc, d) => {
                        const parts = (d.hours || '00:00').split(':');
                        const h = parseInt(parts[0] || '0', 10);
                        const m = parseInt(parts[1] || '0', 10);
                        return acc + (h * 60) + m;
                      }, 0);
                      const h = Math.floor(totalMinutes / 60);
                      const m = totalMinutes % 60;
                      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    })()}
                  </strong></span>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                     <TableHeader>
                       <TableRow className="bg-muted/30">
                         <TableHead className="font-bold w-[120px]">DATA</TableHead>
                         <TableHead className="font-bold">ATIVIDADE / PROJETO</TableHead>
                         <TableHead className="font-bold w-[150px]">MOTIVO</TableHead>
                         <TableHead className="font-bold">DESCRIÇÃO</TableHead>
                         <TableHead className="font-bold text-center w-[100px]">TEMPO</TableHead>
                       </TableRow>
                     </TableHeader>
                    <TableBody>
                      {delays.sort((a, b) => b.date.localeCompare(a.date)).map((d, idx) => (
                        <TableRow key={`${d.id}-${idx}`}>
                          <TableCell className="font-medium">{format(new Date(d.date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-sm">{d.activity_name?.toUpperCase()}</TableCell>
                          <TableCell className="text-sm font-semibold">{d.reason || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{d.description || '—'}</TableCell>
                          <TableCell className="text-center font-mono font-medium text-destructive">{d.hours || '00:00'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Atrasos */}
        <TabsContent value="atrasos">
          <WorkforceDelaysTab startDate={startDate} endDate={endDate} projectId={selectedProject} companyId={profile?.company_id || null} projects={projects} />
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios">
          <WorkforceReportsTab records={records} />
        </TabsContent>

        {/* IA */}
        <TabsContent value="ia">
          <WorkforceAITab
            records={records}
            delays={delays}
            startDate={startDate}
            endDate={endDate}
            projectId={selectedProject}
            onNavigateToRecord={({ workerName, date }) => {
              // Adjust date range if needed
              if (date < startDate || date > endDate) {
                setStartDate(date);
                setEndDate(date);
              }
              setActiveTab('detalhado');
              // Use setTimeout so tab switch renders first, then scroll
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 100);
              // Highlight search via toast
              toast({
                title: 'Registro localizado',
                description: `Busque por "${workerName}" na data ${date}`,
              });
            }}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }} title="Excluir registro" description="Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita." confirmText="Excluir" variant="destructive" onConfirm={handleDeleteRecord} isLoading={deleting} />
      <ConfirmDialog
        open={showSyncConfirm}
        onOpenChange={open => { if (!open && !syncing) setShowSyncConfirm(false); }}
        title="Sincronizar com RDOs"
        description={`Isso vai materializar todas as presenças e atrasos dos RDOs do período (${startDate} a ${endDate}) nas tabelas workforce_database e workforce_delays. Registros já sincronizados serão atualizados. Continuar?`}
        confirmText="Sincronizar"
        onConfirm={syncFromRdos}
        isLoading={syncing}
      />
    </div>
  );
}
