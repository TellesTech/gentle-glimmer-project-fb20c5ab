import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WaveSparkline } from '@/components/ui/wave-sparkline';
import {
  Clock, Zap, CheckCircle, BarChart3, FolderOpen,
  DollarSign, TrendingUp, Settings2, Save, ChevronDown, FileText, Info, Calendar, Users,
} from 'lucide-react';
import { format, subDays, startOfMonth, startOfYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useImpactSettings,
  useUpdateImpactSettings,
  useImpactStats,
  type ImpactSettings,
  type PeriodFilter,
  type ScopeFilter,
} from '@/hooks/useImpactMetrics';
import { useAuth } from '@/contexts/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'year', label: 'Este ano' },
  { value: 'all', label: 'Desde o início' },
];

function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${color || 'bg-primary/10'}`}>
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WaveCard({
  icon: Icon, label, value, sub, accent, series, tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent: string; // hsl(...) color
  series: number[];
  tooltip?: string;
}) {
  const card = (
    <Card className="overflow-hidden relative">
      <CardContent className="pt-6 pb-0">
        <div className="flex items-start gap-3 relative z-10">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${accent.replace(')', ' / 0.12)').replace('hsl(', 'hsl(')}` }}>
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {label}
              {tooltip && <Info className="h-3 w-3 text-muted-foreground/60" />}
            </p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{sub}</p>}
          </div>
        </div>
        <div className="-mx-6 -mb-px mt-2">
          <WaveSparkline data={series} color={accent} height={56} />
        </div>
      </CardContent>
    </Card>
  );
  if (!tooltip) return card;
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">{tooltip}</TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

export default function ImpactMetrics() {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const { data: settings, isLoading: loadingSettings } = useImpactSettings();
  const { data: stats, isLoading: loadingStats } = useImpactStats(period, scope, settings);
  const updateSettings = useUpdateImpactSettings();
  const [editSettings, setEditSettings] = useState<Partial<ImpactSettings> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const handleSaveSettings = () => {
    if (!settings || !editSettings) return;
    updateSettings.mutate({ id: settings.id, ...editSettings });
    setEditSettings(null);
  };

  const s = settings || ({
    manual_time_per_rdo: 10,
    system_time_per_rdo: 1,
    hourly_salary: 25,
    document_search_time: 60,
    hh_calculation_time: 30,
  } as ImpactSettings);

  const total = stats?.totalReports || 0;
  const docSearchTime = s.document_search_time || 60;
  const hhTime = s.hh_calculation_time || 30;
  const manualPerRdo = s.manual_time_per_rdo;
  const systemPerRdo = s.system_time_per_rdo;
  const completedActivities = stats?.completedActivities || 0;
  const finalizedProjects = stats?.finalizedProjects || 0;
  const workerMonths = stats?.workerMonths || 0;

  // Refined savings — HH base is now (worker × month), not per attendance row
  const rdoSavingsMin = (manualPerRdo - systemPerRdo) * total;
  const reportSavingsMin = docSearchTime * finalizedProjects;
  const hhSavingsMin = hhTime * workerMonths;
  const rdoSavingsHours = rdoSavingsMin / 60;
  const reportSavingsHours = reportSavingsMin / 60;
  const hhSavingsHours = hhSavingsMin / 60;
  const totalHoursSaved = rdoSavingsHours + reportSavingsHours + hhSavingsHours;

  // Aggregate multiplier — reflects all 3 sources, consistent with system_time_per_rdo
  const manualTotal = (manualPerRdo * total) + (docSearchTime * finalizedProjects) + (hhTime * workerMonths);
  const systemTotal = systemPerRdo * (total + finalizedProjects + workerMonths);
  const multiplier = systemTotal > 0 ? manualTotal / systemTotal : 0;
  const salaryEquiv = totalHoursSaved * s.hourly_salary;

  // Real annual projection: normalized by days in period
  const startDate = stats?.periodStart ? parseISO(stats.periodStart) : (stats?.monthlyBreakdown?.[0]?.month ? parseISO(stats.monthlyBreakdown[0].month + '-01') : null);
  const endDate = stats?.periodEnd ? parseISO(stats.periodEnd) : new Date();
  
  const daysInPeriod = startDate ? Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 30;
  const annualFactor = 365 / daysInPeriod;

  const projRdosYear = total * annualFactor;
  const projFinalizedYear = finalizedProjects * annualFactor;
  const projWorkerMonthsYear = workerMonths * annualFactor;
  const projHoursYear = (
    projRdosYear * (manualPerRdo - systemPerRdo) +
    projFinalizedYear * docSearchTime +
    projWorkerMonthsYear * hhTime
  ) / 60;
  const projBrlYear = projHoursYear * s.hourly_salary;
  const hasHistory = total > 0;

  // Per-category monthly series for sparkline waves
  const monthlySavings = stats?.monthlySavings || [];
  const rdoSeries = useMemo(() => monthlySavings.map(m => m.rdoHours), [monthlySavings]);
  const reportSeries = useMemo(() => monthlySavings.map(m => m.reportHours), [monthlySavings]);
  const hhSeries = useMemo(() => monthlySavings.map(m => m.hhHours), [monthlySavings]);

  // Stacked area chart data
  const chartData = useMemo(() => monthlySavings.map(m => {
    const [y, mo] = m.month.split('-');
    return {
      name: `${mo}/${y.slice(2)}`,
      RDOs: Number(m.rdoHours.toFixed(1)),
      'Relatórios Finais': Number(m.reportHours.toFixed(1)),
      'Cálculo HH': Number(m.hhHours.toFixed(1)),
    };
  }), [monthlySavings]);

  const isLoading = loadingSettings || loadingStats;

  // Period context
  const today = new Date();
  const periodLabel = periodOptions.find(p => p.value === period)?.label || '';
  let dateRangeLabel = '';
  const fmt = (d: Date) => format(d, 'dd/MM/yyyy', { locale: ptBR });
  if (period === '7d') dateRangeLabel = `${fmt(subDays(today, 7))} → ${fmt(today)}`;
  else if (period === '30d') dateRangeLabel = `${fmt(subDays(today, 30))} → ${fmt(today)}`;
  else if (period === '90d') dateRangeLabel = `${fmt(subDays(today, 90))} → ${fmt(today)}`;
  else if (period === 'month') dateRangeLabel = `${fmt(startOfMonth(today))} → ${fmt(today)}`;
  else if (period === 'year') dateRangeLabel = `${fmt(startOfYear(today))} → ${fmt(today)}`;
  else if (period === 'all') {
    const first = stats?.monthlyBreakdown?.[0]?.month;
    if (first) dateRangeLabel = `Desde ${fmt(parseISO(first + '-01'))} → ${fmt(today)}`;
    else dateRangeLabel = `Desde o início → ${fmt(today)}`;
  }
  const scopeLabel = scope === 'all' ? 'Todos os Projetos' : 'Atividades Concluídas (100%)';

  // Wave palette — semantic-friendly hsl tokens
  const COLOR_RDO = 'hsl(199 89% 48%)';      // cyan-ish
  const COLOR_REPORT = 'hsl(173 80% 40%)';   // teal
  const COLOR_HH = 'hsl(258 90% 66%)';       // violet

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Métricas de Impacto</h1>
          <p className="text-muted-foreground">
            Visualize o impacto do sistema na produtividade da sua operação
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Atividades Concluídas (100%)</SelectItem>
              <SelectItem value="all">Todos os Projetos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Period context card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Período de análise</p>
              <p className="text-2xl font-bold tracking-tight mt-1">{periodLabel}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {dateRangeLabel} <span className="mx-1">·</span> {scopeLabel}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wave cards — savings decomposition */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <WaveCard
            icon={Zap}
            label="Economia com RDOs"
            value={`${rdoSavingsHours.toFixed(1)}h`}
            sub={`${total} RDOs × ${(manualPerRdo - systemPerRdo)} min economizados`}
            accent={COLOR_RDO}
            series={rdoSeries}
          />
          <WaveCard
            icon={FileText}
            label="Economia com Relatórios Finais"
            value={`${reportSavingsHours.toFixed(1)}h`}
            sub={`${finalizedProjects} atividades concluídas × ${docSearchTime} min de busca`}
            accent={COLOR_REPORT}
            series={reportSeries}
            tooltip="Considera atividades funcionalmente concluídas: projetos com status Finalizado OU com pelo menos um RDO em 100%."
          />
          <WaveCard
            icon={Users}
            label="Economia com Cálculo de HH"
            value={`${hhSavingsHours.toFixed(1)}h`}
            sub={`${workerMonths} colaborador-mês × ${hhTime} min/cálculo`}
            accent={COLOR_HH}
            series={hhSeries}
            tooltip="Base refinada: tempo manual para fechar a planilha mensal de HH de cada colaborador (turnos + adicional + extras). Conta apenas atividades funcionalmente concluídas."
          />
        </div>
      )}

      {/* KPI grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            icon={Clock}
            label="Total de Horas Economizadas"
            value={`${totalHoursSaved.toFixed(1)}h`}
            sub="soma das três fontes de economia"
            color="bg-primary/10"
          />
          <MetricCard
            icon={DollarSign}
            label="Equivalente Salarial"
            value={`R$ ${salaryEquiv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`com base em R$ ${s.hourly_salary}/hora`}
            color="bg-emerald-500/10"
          />
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <div>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-green-500/10">
                          <TrendingUp className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            Multiplicador Real <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
                          </p>
                          <p className="text-2xl font-bold tracking-tight">{multiplier.toFixed(1)}x</p>
                          <p className="text-xs text-muted-foreground mt-1">ganho agregado vs. processo manual</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Calculado sobre o total agregado dos 3 processos (RDO + Relatório Final + HH), não apenas sobre o tempo de RDO.
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          <MetricCard
            icon={CheckCircle}
            label={scope === 'all' ? "Projetos no Período" : "Atividades Concluídas"}
            value={completedActivities.toString()}
            sub={scope === 'all' ? `${total} RDOs de todos os projetos` : `${total} RDOs de projetos finalizados`}
            color="bg-blue-500/10"
          />
          <MetricCard
            icon={BarChart3}
            label={scope === 'all' ? "Total de RDOs" : "RDOs em Atividades Concluídas"}
            value={total.toString()}
            sub={scope === 'all' ? "todos os projetos no período" : "somente de projetos com 100% de progresso"}
            color="bg-purple-500/10"
          />
          <MetricCard
            icon={FolderOpen}
            label={scope === 'all' ? "Projetos Distintos" : "Projetos Finalizados"}
            value={(stats?.distinctProjects || 0).toString()}
            sub={scope === 'all' ? "projetos distintos no período" : "projetos com status concluído"}
            color="bg-orange-500/10"
          />

          {/* Annual projection — deterministic (monthly average × 12) */}
          {!hasHistory ? (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-muted">
                    <DollarSign className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Economia Anual Projetada</p>
                    <p className="text-sm text-muted-foreground mt-1">Sem dados no período</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Card className="cursor-help">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-yellow-500/10">
                          <DollarSign className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            Economia Anual Projetada
                            <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
                          </p>
                          <p className="text-2xl font-bold tracking-tight">
                            R$ {projBrlYear.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Projeção baseada em {Math.round(daysInPeriod)} dias de dados
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <div className="space-y-2 text-xs">
                    <p className="font-medium">Como é calculado</p>
                    <p className="text-muted-foreground">
                      Normalização anual baseada nos dias decorridos do período ({Math.round(daysInPeriod)} dias), multiplicando pela taxa de produtividade atual (fator {annualFactor.toFixed(2)}x).
                    </p>
                    <div className="pt-1 border-t space-y-0.5">
                      <p><span className="font-medium">Período real:</span> {total.toFixed(0)} RDOs · {finalizedProjects.toFixed(1)} atividades · {workerMonths.toFixed(1)} colab-mês</p>
                      <p><span className="font-medium">Projeção 12 meses:</span> {projRdosYear.toFixed(0)} RDOs · {projFinalizedYear.toFixed(0)} atividades · {projWorkerMonthsYear.toFixed(0)} colab-mês</p>
                      <p className="pt-1"><span className="font-medium">Economia:</span> {projHoursYear.toFixed(0)}h/ano × R$ {s.hourly_salary}/h = <span className="font-bold">R$ {projBrlYear.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span></p>
                    </div>
                  </div>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Stacked wave chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Mensal — Horas Economizadas por Categoria</CardTitle>
            <CardDescription>Decomposição empilhada das três fontes de economia ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-rdo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_RDO} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={COLOR_RDO} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="g-rep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_REPORT} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={COLOR_REPORT} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="g-hh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_HH} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={COLOR_HH} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v}h`} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [`${value}h`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="RDOs" stackId="1" stroke={COLOR_RDO} strokeWidth={2} fill="url(#g-rdo)" />
                  <Area type="monotone" dataKey="Relatórios Finais" stackId="1" stroke={COLOR_REPORT} strokeWidth={2} fill="url(#g-rep)" />
                  <Area type="monotone" dataKey="Cálculo HH" stackId="1" stroke={COLOR_HH} strokeWidth={2} fill="url(#g-hh)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings panel — super_admin only, cleaned */}
      {isSuperAdmin && (
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Parâmetros de Cálculo</CardTitle>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </div>
                <CardDescription>Apenas os parâmetros realmente usados nas fórmulas</CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tempo manual por RDO (min)</Label>
                    <Input
                      type="number"
                      value={editSettings?.manual_time_per_rdo ?? s.manual_time_per_rdo}
                      onChange={e => setEditSettings(prev => ({ ...prev, manual_time_per_rdo: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo no sistema por RDO (min)</Label>
                    <Input
                      type="number"
                      value={editSettings?.system_time_per_rdo ?? s.system_time_per_rdo}
                      onChange={e => setEditSettings(prev => ({ ...prev, system_time_per_rdo: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Salário/hora (R$)</Label>
                    <Input
                      type="number"
                      value={editSettings?.hourly_salary ?? s.hourly_salary}
                      onChange={e => setEditSettings(prev => ({ ...prev, hourly_salary: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo de busca de documentos (min)</Label>
                    <Input
                      type="number"
                      value={editSettings?.document_search_time ?? s.document_search_time}
                      onChange={e => setEditSettings(prev => ({ ...prev, document_search_time: Number(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground">por atividade finalizada</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Tempo para calcular HH por colaborador/mês (min)</Label>
                    <Input
                      type="number"
                      value={editSettings?.hh_calculation_time ?? s.hh_calculation_time}
                      onChange={e => setEditSettings(prev => ({ ...prev, hh_calculation_time: Number(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground">Tempo manual para fechar a planilha mensal de Homem-Hora de 1 colaborador (turnos + adicional + extras)</p>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSaveSettings} disabled={updateSettings.isPending || !editSettings}>
                    <Save className="h-4 w-4 mr-1.5" /> Salvar Parâmetros
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <div className="flex justify-center">
        <Badge variant="secondary" className="text-xs">
          Métricas calculadas com parâmetros configuráveis
        </Badge>
      </div>
    </div>
  );
}
