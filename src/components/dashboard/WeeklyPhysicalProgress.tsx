import { useMemo, useState } from 'react';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart,
  LabelList
} from 'recharts';
import { BarChart3, Users, Calendar, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useReportsProgress, DateFilterType } from '@/hooks/useReportsProgress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

// Cores WEES padrão industrial (HEX fixas conforme imagem de referência)
const COLORS = {
  lbPeriod: '#0066CC',          // Azul LB (Linha Base)
  realPeriod: '#00AA00',        // Verde Realizado
  replanPeriod: '#888888',      // Cinza Replanejado
  lbAccumulated: '#0066CC',     // Azul acumulado
  realAccumulated: '#00AA00',   // Verde acumulado
  presencePrev: '#0066CC',      // Azul previsto
  presenceReal: '#00AA00',      // Verde real
  statusOk: '#00AA00',          // Verde
  statusWarning: '#FFCC00',     // Amarelo
  statusCritical: '#FF0000',    // Vermelho
};

interface WeeklyPhysicalProgressProps {
  projectId: string;
}

export default function WeeklyPhysicalProgress({ projectId }: WeeklyPhysicalProgressProps) {
  const [dateFilter, setDateFilter] = useState<DateFilterType>({ type: 'all' });
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);

  const { 
    reports, 
    isLoading, 
    calculatedData, 
  } = useReportsProgress(projectId, dateFilter);

  // Handler para filtros rápidos
  const handleFilterChange = (value: string) => {
    if (value && value !== 'custom') {
      setDateFilter({ type: value as DateFilterType['type'] });
    }
  };

  // Handler para aplicar filtro customizado
  const handleApplyCustomFilter = () => {
    if (customStartDate && customEndDate) {
      setDateFilter({
        type: 'custom',
        startDate: customStartDate,
        endDate: customEndDate,
      });
      setCustomPopoverOpen(false);
    }
  };

  // Formatar label do período atual
  const periodLabel = useMemo(() => {
    if (dateFilter.type === 'all') return 'Todos os RDOs';
    if (dateFilter.type === '7d') return 'Últimos 7 dias';
    if (dateFilter.type === '14d') return 'Últimos 14 dias';
    if (dateFilter.type === '30d') return 'Últimos 30 dias';
    if (dateFilter.type === 'custom' && dateFilter.startDate && dateFilter.endDate) {
      return `${format(dateFilter.startDate, 'dd/MM/yy')} - ${format(dateFilter.endDate, 'dd/MM/yy')}`;
    }
    return '';
  }, [dateFilter]);

  // Status automático baseado nos cálculos do hook (conforme especificação WEES)
  const status = useMemo(() => {
    const { statusType, deviationPercent, totalPlanned } = calculatedData;
    
    if (totalPlanned === 0) {
      return { color: COLORS.statusOk, label: 'N/A', description: 'Sem dados', deviation: 0 };
    }
    
    const statusColors = {
      ok: COLORS.statusOk,
      warning: COLORS.statusWarning,
      critical: COLORS.statusCritical,
    };
    
    const statusLabels = {
      ok: 'OK',
      warning: 'ATENÇÃO',
      critical: 'CRÍTICO',
    };
    
    return { 
      color: statusColors[statusType], 
      label: statusLabels[statusType], 
      description: `Desvio: ${deviationPercent >= 0 ? '+' : ''}${deviationPercent.toFixed(1).replace('.', ',')}%`,
      deviation: deviationPercent,
    };
  }, [calculatedData]);

  // Dados para o gráfico combinado (Curva S)
  const chartData = useMemo(() => {
    return calculatedData.dates.map((date, index) => ({
      date,
      dateWithDay: calculatedData.datesWithDay[index],
      lbPeriodo: calculatedData.plannedPeriod[index],
      realPeriodo: calculatedData.actualPeriod[index],
      lbAcumulado: calculatedData.plannedAccumulated[index],
      realAcumulado: calculatedData.actualAccumulated[index],
    }));
  }, [calculatedData]);

  // Dados para histograma de presenças (com diferença para barras direcionais)
  const presenceData = useMemo(() => {
    return calculatedData.dates.map((date, index) => {
      const diff = calculatedData.presenceDifference[index];
      return {
        date,
        dateWithDay: calculatedData.datesWithDay[index],
        day: calculatedData.dayNames[index],
        P: calculatedData.plannedPresence[index],
        R: calculatedData.actualPresence[index],
        // Diferença para histograma: barra para cima (azul) ou para baixo (verde)
        diffPositive: diff > 0 ? diff : 0,  // Falta de presença
        diffNegative: diff < 0 ? Math.abs(diff) : 0,  // Excesso de presença
        diffValue: diff,  // Valor original para tooltip
      };
    });
  }, [calculatedData]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-[300px] bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ===== FILTRO DE PERÍODO ===== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup 
            type="single" 
            value={dateFilter.type === 'custom' ? undefined : dateFilter.type}
            onValueChange={handleFilterChange}
            className="bg-muted/50 rounded-md p-0.5"
          >
            <ToggleGroupItem value="7d" size="sm" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              7 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="14d" size="sm" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              14 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" size="sm" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              30 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Todos
            </ToggleGroupItem>
          </ToggleGroup>

          <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={dateFilter.type === 'custom' ? 'default' : 'outline'} 
                size="sm" 
                className="h-7 text-xs gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Customizado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Data inicial</Label>
                  <CalendarComponent
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    locale={ptBR}
                    className="rounded-md border pointer-events-auto"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Data final</Label>
                  <CalendarComponent
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    locale={ptBR}
                    disabled={(date) => customStartDate ? date < customStartDate : false}
                    className="rounded-md border pointer-events-auto"
                  />
                </div>
                <Button 
                  onClick={handleApplyCustomFilter} 
                  className="w-full"
                  disabled={!customStartDate || !customEndDate}
                  size="sm"
                >
                  Aplicar Filtro
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Badge variant="secondary" className="text-xs gap-1.5 h-7">
          <Calendar className="h-3 w-3" />
          {periodLabel}
          {reports.length > 0 && <span className="text-muted-foreground">({reports.length} RDOs)</span>}
        </Badge>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum RDO encontrado {dateFilter.type !== 'all' ? 'neste período' : 'para esta atividade'}.</p>
          <p className="text-xs mt-1">{dateFilter.type !== 'all' ? 'Tente expandir o período de busca.' : 'Crie RDOs para visualizar o avanço físico.'}</p>
        </div>
      ) : (
        <>
      {/* ===== SEÇÃO 1: AVANÇO FÍSICO ACUMULADO ===== */}
      <div className="border border-border rounded bg-card">
        {/* Header do Card */}
        <div className="bg-muted/50 px-3 py-2 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-center">
            Avanço Físico Acumulado (%)
          </h3>
        </div>

        {/* Quadros Superiores: PREVISTO | INDICADOR | REALIZADO */}
        <div className="grid grid-cols-3 divide-x divide-border">
          {/* Previsto */}
          <div className="p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              PREVISTO
            </p>
            <p className="text-xl font-bold" style={{ color: COLORS.lbPeriod }}>
              {calculatedData.totalPlanned.toFixed(1).replace('.', ',')}
            </p>
          </div>

          {/* Indicador Central com Desvio */}
          <div className="p-3 text-center flex flex-col items-center justify-center">
            <div 
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
              style={{ 
                backgroundColor: status.color,
                borderColor: status.color 
              }}
            />
            {/* Exibir desvio percentual */}
            <p className="mt-1 text-xs font-semibold" style={{ color: status.color }}>
              {status.deviation !== 0 && (
                <>{status.deviation >= 0 ? '+' : ''}{status.deviation.toFixed(1).replace('.', ',')}%</>
              )}
            </p>
            {/* Legenda de cores conforme especificação */}
            <div className="mt-1 space-y-0.5 text-[8px] text-muted-foreground">
              <div className="flex items-center gap-1 justify-center">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.statusOk }} />
                <span>desvio ≥ 0%</span>
              </div>
              <div className="flex items-center gap-1 justify-center">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.statusWarning }} />
                <span>-5% ≤ desvio &lt; 0%</span>
              </div>
              <div className="flex items-center gap-1 justify-center">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.statusCritical }} />
                <span>desvio &lt; -5%</span>
              </div>
            </div>
          </div>

          {/* Realizado */}
          <div className="p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              REALIZADO
            </p>
            <p 
              className="text-xl font-bold"
              style={{ color: status.color }}
            >
              {calculatedData.totalActual.toFixed(1).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* Gráfico Principal (Barras + Linhas - Curva S) */}
        <div className="p-3 border-t border-border">
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(500, reports.length * 55) }}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 15, right: 40, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" strokeOpacity={0.6} />
                  <XAxis 
                    dataKey="dateWithDay" 
                    tick={{ fontSize: 8, fill: '#666' }}
                    tickLine={{ stroke: '#ccc' }}
                    axisLine={{ stroke: '#ccc' }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis 
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 9, fill: '#666' }}
                    tickLine={{ stroke: '#ccc' }}
                    axisLine={{ stroke: '#ccc' }}
                    domain={[0, 'auto']}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 9, fill: '#666' }}
                    tickLine={{ stroke: '#ccc' }}
                    axisLine={{ stroke: '#ccc' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        lbPeriodo: 'LB Período',
                        realPeriodo: 'Real. Período',
                        lbAcumulado: 'LB Acumul.',
                        realAcumulado: 'Real. Acumul.',
                      };
                      return [value.toFixed(1).replace('.', ','), labels[name] || name];
                    }}
                    contentStyle={{ 
                      borderRadius: '4px', 
                      border: '1px solid #ccc',
                      backgroundColor: '#fff',
                      fontSize: '11px',
                      padding: '6px 10px'
                    }}
                  />
                  
                  {/* Barras do Período */}
                  <Bar 
                    yAxisId="left"
                    dataKey="lbPeriodo" 
                    name="LB Período"
                    fill={COLORS.lbPeriod} 
                    fillOpacity={1}
                    radius={0}
                    barSize={14}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="realPeriodo" 
                    name="Real. Período"
                    fill={COLORS.realPeriod} 
                    fillOpacity={1}
                    radius={0}
                    barSize={14}
                  />
                  
                  {/* Linhas Acumuladas */}
                  <Line 
                    yAxisId="right"
                    type="linear" 
                    dataKey="lbAcumulado" 
                    name="LB Acumul."
                    stroke={COLORS.lbAccumulated} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.lbAccumulated, strokeWidth: 0, r: 3 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="linear" 
                    dataKey="realAcumulado" 
                    name="Real. Acumul."
                    stroke={COLORS.realAccumulated} 
                    strokeWidth={2}
                    dot={{ fill: COLORS.realAccumulated, strokeWidth: 0, r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tabela Técnica Somente Leitura */}
        <div className="border-t border-border">
          <ScrollArea className="w-full whitespace-nowrap">
            <table className="w-full text-[10px] border-collapse">
              <tbody>
                {/* Linha 1: LB Período */}
                <tr className="border-b border-border bg-muted/20">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10 min-w-[90px]">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: COLORS.lbPeriod }} />
                      <span style={{ color: COLORS.lbPeriod }}>LB Período</span>
                    </div>
                  </td>
                  {calculatedData.plannedPeriod.map((value, index) => (
                    <td key={index} className="p-1.5 text-center min-w-[45px]">
                      {value.toFixed(1).replace('.', ',')}
                    </td>
                  ))}
                </tr>

                {/* Linha 2: Real. Período */}
                <tr className="border-b border-border bg-muted/10">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: COLORS.realPeriod }} />
                      <span style={{ color: COLORS.realPeriod }}>Real. Período</span>
                    </div>
                  </td>
                  {calculatedData.actualPeriod.map((value, index) => (
                    <td key={index} className="p-1.5 text-center">
                      {value.toFixed(1).replace('.', ',')}
                    </td>
                  ))}
                </tr>

                {/* Linha 3: LB Acumul. */}
                <tr className="border-b border-border bg-muted/20">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.lbAccumulated }} />
                      <span style={{ color: COLORS.lbAccumulated }}>LB Acumul.</span>
                    </div>
                  </td>
                  {calculatedData.plannedAccumulated.map((value, index) => (
                    <td key={index} className="p-1.5 text-center font-semibold" style={{ color: COLORS.lbAccumulated }}>
                      {value.toFixed(1).replace('.', ',')}
                    </td>
                  ))}
                </tr>

                {/* Linha 4: Real. Acumul. */}
                <tr className="border-b border-border bg-muted/10">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.realAccumulated }} />
                      <span style={{ color: COLORS.realAccumulated }}>Real. Acumul.</span>
                    </div>
                  </td>
                  {calculatedData.actualAccumulated.map((value, index) => (
                    <td key={index} className="p-1.5 text-center font-semibold" style={{ color: COLORS.realAccumulated }}>
                      {value.toFixed(1).replace('.', ',')}
                    </td>
                  ))}
                </tr>

                {/* Linha de Cabeçalho com Datas */}
                <tr className="bg-muted/30 border-t-2 border-border">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10 text-muted-foreground">
                    Data
                  </td>
                  {calculatedData.datesWithDay.map((dateWithDay, index) => (
                    <td key={index} className="p-1.5 text-center text-muted-foreground min-w-[55px]">
                      <div className="text-[9px] font-medium">{dateWithDay}</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      {/* ===== SEÇÃO 2: HISTOGRAMA DE PRESENÇAS ===== */}
      <div className="border border-border rounded bg-card">
        {/* Header */}
        <div className="bg-muted/50 px-3 py-2 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            Histograma Semanal – Presenças
          </h3>
        </div>

        {/* Gráfico de Barras P x R */}
        <div className="p-3">
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(400, reports.length * 50) }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={presenceData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" strokeOpacity={0.6} />
                  <XAxis 
                    dataKey="dateWithDay" 
                    tick={{ fontSize: 8, fill: '#666' }}
                    tickLine={{ stroke: '#ccc' }}
                    axisLine={{ stroke: '#ccc' }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fill: '#666' }}
                    tickLine={{ stroke: '#ccc' }}
                    axisLine={{ stroke: '#ccc' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'P' ? 'Previsto' : name === 'R' ? 'Realizado' : 'Diferença'
                    ]}
                    contentStyle={{ 
                      borderRadius: '4px', 
                      border: '1px solid #ccc',
                      backgroundColor: '#fff',
                      fontSize: '11px'
                    }}
                  />
                  <Bar 
                    dataKey="P" 
                    name="P"
                    fill={COLORS.presencePrev} 
                    barSize={16}
                  >
                    <LabelList dataKey="P" position="top" fontSize={9} fill="#333" />
                  </Bar>
                  <Bar 
                    dataKey="R" 
                    name="R"
                    fill={COLORS.presenceReal} 
                    barSize={16}
                  >
                    <LabelList dataKey="R" position="top" fontSize={9} fill="#333" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legenda Textual */}
          <div className="flex items-center justify-center gap-6 mt-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: COLORS.presencePrev }} />
              <span>P - previsto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: COLORS.presenceReal }} />
              <span>R - real</span>
            </div>
          </div>
        </div>

        {/* Tabela de Presenças Somente Leitura */}
        <div className="border-t border-border">
          <ScrollArea className="w-full whitespace-nowrap">
            <table className="w-full text-[10px] border-collapse">
              <tbody>
                {/* Linha de Cabeçalho com Datas */}
                <tr className="bg-muted/30 border-b border-border">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10 min-w-[90px] text-muted-foreground">
                    Presenças
                  </td>
                  {calculatedData.datesWithDay.map((dateWithDay, index) => (
                    <td key={index} className="p-1.5 text-center text-muted-foreground min-w-[55px]">
                      <div className="text-[9px] font-medium">{dateWithDay}</div>
                    </td>
                  ))}
                </tr>

                {/* Linha P - Previsto */}
                <tr className="border-b border-border bg-muted/10">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: COLORS.presencePrev }} />
                      <span style={{ color: COLORS.presencePrev }}>P - previsto</span>
                    </div>
                  </td>
                  {calculatedData.plannedPresence.map((value, index) => (
                    <td key={index} className="p-1.5 text-center">
                      {value}
                    </td>
                  ))}
                </tr>

                {/* Linha R - Real */}
                <tr className="border-b border-border bg-muted/5">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: COLORS.presenceReal }} />
                      <span style={{ color: COLORS.presenceReal }}>R - real</span>
                    </div>
                  </td>
                  {calculatedData.actualPresence.map((value, index) => (
                    <td key={index} className="p-1.5 text-center">
                      {value}
                    </td>
                  ))}
                </tr>

                {/* Linha Diferença (P - R) */}
                <tr className="bg-muted/20">
                  <td className="p-1.5 font-bold bg-muted/40 sticky left-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm bg-gray-400" />
                      <span className="text-muted-foreground">Diferença</span>
                    </div>
                  </td>
                  {calculatedData.presenceDifference.map((value, index) => (
                    <td 
                      key={index} 
                      className="p-1.5 text-center font-semibold"
                      style={{ 
                        color: value > 0 ? COLORS.statusCritical : value < 0 ? COLORS.statusOk : '#666'
                      }}
                    >
                      {value > 0 ? `-${value}` : value < 0 ? `+${Math.abs(value)}` : '0'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
