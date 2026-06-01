import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Brain, TrendingUp, Users, Loader2, Download, AlertTriangle, ChevronDown, ShieldAlert, Info, FileWarning, RefreshCw, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { generateAIAnalysisPdf } from '@/lib/generateAIAnalysisPdf';
import { generateAuditPdf } from '@/lib/generateAuditPdf';
import { triggerDownloadFromBlob } from '@/lib/downloadUtils';
import { calculateWorkHours, mergeAndCalculateWorkHours } from '@/lib/workforceCalculations';
import { resolveWorkerFunction, ProfileEntry } from '@/lib/resolveWorkerFunction';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';

interface WorkforceRecord {
  id?: string;
  activity_name: string;
  date: string;
  worker_name: string;
  function_role: string | null;
  start_time?: string | null;
  end_time?: string | null;
  normal_hours: number;
  compensation_hours: number;
  overtime_75: number;
  overtime_100: number;
  night_bonus: number;
}

interface DelayRecord {
  activity_name: string;
  date: string;
  description: string;
  hours: string;
}

interface Props {
  records: WorkforceRecord[];
  delays: DelayRecord[];
  startDate: string;
  endDate: string;
  projectId: string;
  onNavigateToRecord?: (info: { workerName: string; date: string; id?: string }) => void;
}

type ErrorSeverity = 'high' | 'medium' | 'low';

interface AuditError {
  type: string;
  severity: ErrorSeverity;
  message: string;
  workerName: string;
  date: string;
  activity: string;
}

function detectErrors(records: WorkforceRecord[]): AuditError[] {
  const errors: AuditError[] = [];
  const seen = new Map<string, number>();

  for (const r of records) {
    const base = { workerName: r.worker_name, date: r.date, activity: r.activity_name };
    const totalHours = r.normal_hours + r.overtime_75 + r.overtime_100;

    // 1. HN > 9h
    if (r.normal_hours > 9) {
      errors.push({ ...base, type: 'Horas Excessivas', severity: 'high', message: `HN = ${r.normal_hours}h (máx 9h)` });
    }

    // 2. Total > 14h
    if (totalHours > 14) {
      errors.push({ ...base, type: 'Horas Excessivas', severity: 'high', message: `Total = ${totalHours.toFixed(1)}h (máx 14h)` });
    }

    // 3. Horários ausentes
    if (!r.start_time || !r.end_time) {
      errors.push({ ...base, type: 'Horário Ausente', severity: 'medium', message: !r.start_time && !r.end_time ? 'Entrada e saída ausentes' : !r.start_time ? 'Entrada ausente' : 'Saída ausente' });
    }

    // 4. Função indefinida
    if (!r.function_role || r.function_role === 'MEIO OFICIAL') {
      errors.push({ ...base, type: 'Função Indefinida', severity: 'medium', message: r.function_role ? 'Função genérica "MEIO OFICIAL"' : 'Sem função definida' });
    }

    // 5. Duplicatas
    const dupeKey = `${r.worker_name.trim().toUpperCase()}|${r.date}|${r.activity_name}`;
    const count = (seen.get(dupeKey) || 0) + 1;
    seen.set(dupeKey, count);
    if (count === 2) {
      errors.push({ ...base, type: 'Duplicata', severity: 'high', message: 'Registro duplicado (mesmo colaborador/data/projeto)' });
    }

    // 6. Horas zeradas
    if (r.normal_hours === 0 && r.overtime_75 === 0 && r.overtime_100 === 0 && r.night_bonus === 0) {
      errors.push({ ...base, type: 'Horas Zeradas', severity: 'medium', message: 'Todas as horas = 0' });
    }

    // 7. Horário invertido (simples: start > end sem ser noturno)
    if (r.start_time && r.end_time) {
      const [sh, sm] = r.start_time.split(':').map(Number);
      const [eh, em] = r.end_time.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (startMin > endMin && r.night_bonus === 0) {
        errors.push({ ...base, type: 'Horário Invertido', severity: 'high', message: `Entrada ${r.start_time} > Saída ${r.end_time} sem ADN` });
      }
    }

    // 8. Extras sem HN completa
    if ((r.overtime_75 > 0 || r.overtime_100 > 0) && r.normal_hours < 9) {
      errors.push({ ...base, type: 'Extras sem HN Completa', severity: 'low', message: `HN = ${r.normal_hours}h com extras registradas` });
    }
  }

  return errors;
}

const SEVERITY_CONFIG: Record<ErrorSeverity, { label: string; color: string; icon: React.ElementType }> = {
  high: { label: 'Alto', color: 'bg-destructive text-destructive-foreground', icon: ShieldAlert },
  medium: { label: 'Médio', color: 'bg-orange-500 text-white', icon: AlertTriangle },
  low: { label: 'Baixo', color: 'bg-yellow-500 text-white', icon: Info },
};

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-primary mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-primary mt-5 mb-2 border-b border-primary/20 pb-1">$2</h2>')
    .replace(/^# (.+)$/gm, '<h2 class="text-base font-bold text-primary mt-5 mb-2 border-b border-primary/20 pb-1">$1</h2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^\d+\.\s(.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>')
    .replace(/\n/g, '<br/>');
}

export function WorkforceAITab({ records, delays, startDate, endDate, projectId, onNavigateToRecord }: Props) {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAuditPdf, setDownloadingAuditPdf] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [auditRecords, setAuditRecords] = useState<WorkforceRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAuditData = useCallback(async () => {
    setAuditLoading(true);
    try {
      // 1. Fetch ALL attendance records (no date filter)
      const { data: attendanceData } = await supabase
        .from('report_attendance')
        .select(`
          id, user_name, arrival_time, departure_time, present, user_id, report_id,
          reports!inner(id, date, project_id, projects(name))
        `)
        .eq('present', true);

      // 2. Get ALL profiles for intelligent matching
      const { data: allProfilesRaw } = await supabase
        .from('profiles')
        .select('id, name, job_title');
      const allProfiles: ProfileEntry[] = (allProfilesRaw || []).filter((p: any) => p.name && p.job_title) as ProfileEntry[];
      const profilesById: Record<string, string> = {};
      for (const p of allProfiles) {
        if (p.job_title) profilesById[p.id] = p.job_title;
      }

      // 3. Convert to WorkforceRecord — agrupar por worker+date para mesclar turnos
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

        const mergedStart = group.reduce((earliest: string | null, a: any) =>
          !a.arrival_time ? earliest : (!earliest || a.arrival_time < earliest ? a.arrival_time : earliest), null as string | null);
        const mergedEnd = group.reduce((latest: string | null, a: any) =>
          !a.departure_time ? latest : (!latest || a.departure_time > latest ? a.departure_time : latest), null as string | null);

        rdoRecords.push({
          id: `rdo-${first.id}`,
          activity_name: projectName,
          date: report?.date || '',
          worker_name: first.user_name || 'Sem nome',
          function_role: functionRole,
          start_time: mergedStart || null,
          end_time: mergedEnd || null,
          normal_hours: hours.normalHours,
          compensation_hours: hours.compensationHours,
          overtime_75: hours.overtime75,
          overtime_100: hours.overtime100,
          night_bonus: hours.nightBonus,
        });
      }

      // 4. Fetch ALL manual records (no date filter)
      const { data: manualData } = await supabase
        .from('workforce_database')
        .select('*')
        .order('date', { ascending: true });

      const manualRecords: WorkforceRecord[] = (manualData || []).map((r: any) => ({
        ...r,
      }));

      const allRecords = [...rdoRecords, ...manualRecords].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.worker_name.localeCompare(b.worker_name);
      });

      setAuditRecords(allRecords);
    } catch (err) {
      console.error('Error loading audit data:', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  const auditErrors = useMemo(() => detectErrors(auditRecords), [auditRecords]);

  const errorsByType = useMemo(() => {
    const grouped: Record<string, AuditError[]> = {};
    for (const e of auditErrors) {
      (grouped[e.type] ||= []).push(e);
    }
    return grouped;
  }, [auditErrors]);

  const severityCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const e of auditErrors) counts[e.severity]++;
    return counts;
  }, [auditErrors]);

  const toggleType = (type: string) => setOpenTypes(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleExpand = (type: string) => setExpandedTypes(prev => {
    const next = new Set(prev);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });

  const exportErrors = async () => {
    if (auditErrors.length === 0) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Erros Detectados');
    ws.columns = [
      { header: 'Tipo', key: 'type', width: 25 },
      { header: 'Severidade', key: 'severity', width: 12 },
      { header: 'Colaborador', key: 'workerName', width: 30 },
      { header: 'Data', key: 'date', width: 14 },
      { header: 'Projeto/Atividade', key: 'activity', width: 30 },
      { header: 'Descrição', key: 'message', width: 50 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };

    for (const e of auditErrors) {
      ws.addRow({ ...e, severity: SEVERITY_CONFIG[e.severity].label });
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerDownloadFromBlob(blob, `erros-hh-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Exportado', description: `${auditErrors.length} erros exportados.` });
  };

  const exportAuditPdf = async () => {
    if (auditErrors.length === 0) return;
    setDownloadingAuditPdf(true);
    try {
      const doc = await generateAuditPdf(auditErrors, {
        projectName: projectId !== 'all' ? `Projeto ${projectId.slice(0, 8)}` : 'Todos os Projetos',
        startDate, endDate,
      });
      const blob = doc.output('blob');
      triggerDownloadFromBlob(blob, `auditoria-hh-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'PDF gerado', description: 'Download iniciado.' });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    } finally {
      setDownloadingAuditPdf(false);
    }
  };

  const analyzeWithAI = async () => {
    if (records.length === 0) {
      toast({ title: 'Sem dados', description: 'Processe os RDOs antes de analisar.', variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-workforce-data', {
        body: {
          action: 'analyze-productivity',
          project_id: projectId !== 'all' ? projectId : null,
          start_date: startDate,
          end_date: endDate,
          records: records.slice(0, 500).map(r => ({
            activity: r.activity_name, date: r.date, worker: r.worker_name,
            function: r.function_role, hn: r.normal_hours, h75: r.overtime_75,
            h100: r.overtime_100, adn: r.night_bonus,
          })),
          delays: delays.slice(0, 100).map(d => ({
            activity: d.activity_name, date: d.date, description: d.description, hours: d.hours,
          })),
        },
      });
      if (error) throw error;
      setAnalysis(data.analysis || 'Análise não disponível.');
    } catch (err: any) {
      toast({ title: 'Erro na análise', description: err.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!analysis) return;
    setDownloading(true);
    try {
      const doc = await generateAIAnalysisPdf(analysis, {
        projectName: projectId !== 'all' ? `Projeto ${projectId.slice(0, 8)}` : 'Todos os Projetos',
        startDate, endDate,
      });
      const blob = doc.output('blob');
      triggerDownloadFromBlob(blob, `analise-produtividade-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'PDF gerado', description: 'Download iniciado.' });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Seção de Auditoria ── */}
      <Card className="border-orange-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-orange-500" />
              Auditoria de Dados
              <Badge variant="outline" className="text-[10px] font-normal">Todos os registros</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={fetchAuditData} disabled={auditLoading} variant="ghost" size="sm" className="gap-1.5 text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
              {auditErrors.length > 0 && (
                <>
                  <Button onClick={exportAuditPdf} disabled={downloadingAuditPdf} variant="outline" size="sm" className="gap-1.5 text-xs">
                    {downloadingAuditPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar PDF
                  </Button>
                  <Button onClick={exportErrors} variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" /> Exportar Excel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando dados para auditoria...
            </div>
          ) : auditRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum registro encontrado no banco de dados.</p>
          ) : auditErrors.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <ShieldAlert className="w-4 h-4" />
              Nenhum erro detectado — dados consistentes.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs font-normal">
                  {auditErrors.length} erro{auditErrors.length !== 1 ? 's' : ''} encontrado{auditErrors.length !== 1 ? 's' : ''}
                </Badge>
                {(Object.entries(severityCounts) as [ErrorSeverity, number][]).filter(([, c]) => c > 0).map(([sev, count]) => (
                  <Badge key={sev} className={`text-xs ${SEVERITY_CONFIG[sev].color}`}>
                    {SEVERITY_CONFIG[sev].label}: {count}
                  </Badge>
                ))}
              </div>

              {/* Grouped errors */}
              <div className="space-y-2">
                {Object.entries(errorsByType).map(([type, errs]) => {
                  const topSev = errs.reduce<ErrorSeverity>((a, e) => {
                    const rank = { high: 3, medium: 2, low: 1 };
                    return rank[e.severity] > rank[a] ? e.severity : a;
                  }, 'low');
                  const Icon = SEVERITY_CONFIG[topSev].icon;
                  return (
                    <Collapsible key={type} open={openTypes[type]} onOpenChange={() => toggleType(type)}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left text-sm">
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">{type}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5">{errs.length}</Badge>
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${openTypes[type] ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className={`mt-1 border rounded-lg divide-y ${expandedTypes.has(type) ? 'max-h-[600px]' : 'max-h-60'} overflow-y-auto`}>
                          {(expandedTypes.has(type) ? errs : errs.slice(0, 50)).map((e, i) => (
                            <div key={i} className="px-3 py-2 text-xs flex items-center gap-3 hover:bg-muted/30">
                              <span className="text-muted-foreground whitespace-nowrap">{e.date}</span>
                              <span className="font-medium min-w-0 truncate">{e.workerName}</span>
                              <span className="text-muted-foreground flex-1 min-w-0 truncate">{e.message}</span>
                              {onNavigateToRecord && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => onNavigateToRecord({ workerName: e.workerName, date: e.date })}
                                      className="flex-shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ir para registro</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          ))}
                          {errs.length > 50 && (
                            <button
                              onClick={() => toggleExpand(type)}
                              className="w-full px-3 py-2 text-xs text-primary hover:bg-muted/50 transition-colors font-medium"
                            >
                              {expandedTypes.has(type) ? 'Mostrar menos' : `Ver todos os ${errs.length} registros`}
                            </button>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Cards IA ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Brain, title: 'Análise de Produtividade', desc: 'Identifica desperdícios e padrões' },
          { icon: TrendingUp, title: 'Previsão de HH', desc: 'Projeta demanda futura baseada no histórico' },
          { icon: Users, title: 'Dimensionamento', desc: 'Sugere equipe ideal por função' },
        ].map(card => (
          <Card key={card.title}>
            <CardContent className="pt-4 pb-3 text-center">
              <card.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">{card.title}</p>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-x-3">
        <Button onClick={analyzeWithAI} disabled={analyzing || records.length === 0} size="lg" className="gap-2">
          {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {analyzing ? 'Analisando...' : 'Analisar com IA'}
        </Button>
        {analysis && (
          <Button onClick={handleDownloadPdf} disabled={downloading} size="lg" variant="outline" className="gap-2">
            {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            Baixar PDF
          </Button>
        )}
        {records.length === 0 && <p className="text-xs text-muted-foreground mt-2">Processe os RDOs primeiro</p>}
      </div>

      {analysis && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Análise de IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(analysis) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
