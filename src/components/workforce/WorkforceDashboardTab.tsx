import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, CartesianGrid, Legend, Tooltip } from 'recharts';
import { Clock, Users, TrendingUp, AlertTriangle, Moon } from 'lucide-react';
import { normalizeFunction, getBaseFunction } from '@/lib/jobFunctions';

interface WorkforceRecord {
  id: string;
  activity_name: string;
  date: string;
  worker_name: string;
  function_role: string | null;
  normal_hours: number;
  compensation_hours: number;
  overtime_75: number;
  overtime_100: number;
  night_bonus: number;
}

interface Props {
  records: WorkforceRecord[];
}

const COLORS_INDUSTRIAL = ['#991919', '#1e293b', '#059669', '#d97706', '#2563eb', '#7c3aed', '#db2777', '#0891b2'];

const formatHHMM = (h: number) => `${Math.floor(h)}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2, '0')}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 text-xs" style={{ borderLeft: `3px solid ${payload[0]?.color || payload[0]?.fill || '#991919'}` }}>
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{formatHHMM(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const DonutCenterLabel = ({ viewBox, total }: any) => {
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">{formatHHMM(total)}</tspan>
      <tspan x={cx} y={cy + 10} className="fill-muted-foreground text-[10px]">Total HH</tspan>
    </text>
  );
};

export function WorkforceDashboardTab({ records }: Props) {
  const totalHH = useMemo(() => records.reduce((s, r) => s + r.normal_hours + r.compensation_hours + r.overtime_75 + r.overtime_100, 0), [records]);
  const totalExtras = useMemo(() => records.reduce((s, r) => s + r.overtime_75 + r.overtime_100, 0), [records]);
  const totalADN = useMemo(() => records.reduce((s, r) => s + r.night_bonus, 0), [records]);
  const uniqueWorkers = useMemo(() => new Set(records.map(r => r.worker_name)).size, [records]);

  const byRole = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach(r => {
      const fn = getBaseFunction(normalizeFunction(r.function_role) || 'MEIO OFICIAL');
      map[fn] = (map[fn] || 0) + r.normal_hours + r.overtime_75 + r.overtime_100 + r.compensation_hours;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [records]);

  const byActivity = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach(r => {
      map[r.activity_name] = (map[r.activity_name] || 0) + r.normal_hours + r.overtime_75 + r.overtime_100 + r.compensation_hours;
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + '…' : name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [records]);

  const hoursPie = useMemo(() => {
    const hn = records.reduce((s, r) => s + r.normal_hours, 0);
    const com = records.reduce((s, r) => s + r.compensation_hours, 0);
    const h75 = records.reduce((s, r) => s + r.overtime_75, 0);
    const h100 = records.reduce((s, r) => s + r.overtime_100, 0);
    const adn = records.reduce((s, r) => s + r.night_bonus, 0);
    return [
      { name: 'Normais', value: Math.round(hn * 100) / 100 },
      { name: 'Compensação', value: Math.round(com * 100) / 100 },
      { name: 'HE 75%', value: Math.round(h75 * 100) / 100 },
      { name: 'HE 100%', value: Math.round(h100 * 100) / 100 },
      { name: 'Adic. Noturno', value: Math.round(adn * 100) / 100 },
    ].filter(d => d.value > 0);
  }, [records]);

  const pieTotal = useMemo(() => hoursPie.reduce((s, d) => s + d.value, 0), [hoursPie]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, { hn: number; extras: number; adn: number }> = {};
    records.forEach(r => {
      if (!map[r.date]) map[r.date] = { hn: 0, extras: 0, adn: 0 };
      map[r.date].hn += r.normal_hours;
      map[r.date].extras += r.overtime_75 + r.overtime_100;
      map[r.date].adn += r.night_bonus;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
      date: date.slice(5).replace('-', '/'),
      hn: Math.round(d.hn * 100) / 100,
      extras: Math.round(d.extras * 100) / 100,
      adn: Math.round(d.adn * 100) / 100,
    }));
  }, [records]);

  const roleConfig = useMemo(() => Object.fromEntries(byRole.map((d, i) => [d.name, { label: d.name, color: COLORS_INDUSTRIAL[i % COLORS_INDUSTRIAL.length] }])), [byRole]);
  const pieConfig = useMemo(() => Object.fromEntries(hoursPie.map((d, i) => [d.name, { label: d.name, color: COLORS_INDUSTRIAL[i % COLORS_INDUSTRIAL.length] }])), [hoursPie]);

  const kpis = [
    { icon: Clock, label: 'Total HH', value: formatHHMM(totalHH), bg: 'bg-red-100 dark:bg-red-900/30', iconColor: 'text-[#991919]' },
    { icon: Users, label: 'Colaboradores', value: String(uniqueWorkers), bg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
    { icon: TrendingUp, label: 'HH Médio/Dia', value: formatHHMM(dailyTrend.length ? totalHH / dailyTrend.length : 0), bg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600' },
    { icon: AlertTriangle, label: 'Horas Extras', value: formatHHMM(totalExtras), bg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600' },
    { icon: Moon, label: 'Adic. Noturno', value: formatHHMM(totalADN), bg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600' },
  ];

  if (records.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">Nenhum dado para exibir. Processe os RDOs primeiro.</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-default">
            <CardContent className="pt-4 pb-3 flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`w-4.5 h-4.5 ${kpi.iconColor}`} />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.iconColor}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* HH by Role - Gradient Bars */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">HH por Função</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={roleConfig} className="h-[280px]">
              <BarChart data={byRole} layout="vertical" margin={{ left: 10, right: 16, top: 10, bottom: 10 }}>
                <defs>
                  {byRole.map((_, i) => {
                    const color = COLORS_INDUSTRIAL[i % COLORS_INDUSTRIAL.length];
                    return (
                      <linearGradient key={`gr-${i}`} id={`barGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={color} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={color} stopOpacity={1} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800} animationBegin={100} name="HH">
                  {byRole.map((_, i) => <Cell key={i} fill={`url(#barGrad${i})`} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Hours Distribution - Donut */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição de Horas</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={pieConfig} className="h-[240px]">
              <PieChart>
                <Pie
                  data={hoursPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  cornerRadius={4}
                  animationDuration={900}
                  animationBegin={100}
                  strokeWidth={0}
                >
                  {hoursPie.map((_, i) => <Cell key={i} fill={COLORS_INDUSTRIAL[i % COLORS_INDUSTRIAL.length]} />)}
                  <DonutCenterLabel total={pieTotal} />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-[10px] text-foreground">{value}</span>}
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Daily trend - Area Chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução Diária de HH</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={{ hn: { label: 'Normais', color: '#1e293b' }, extras: { label: 'Extras', color: '#d97706' }, adn: { label: 'Noturno', color: '#7c3aed' } }} className="h-[250px]">
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="gradHN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExtras" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradADN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-xs">{value}</span>} />
              <Area type="natural" dataKey="hn" stroke="#1e293b" strokeWidth={2.5} fill="url(#gradHN)" dot={{ r: 2.5, fill: '#1e293b' }} activeDot={{ r: 5, strokeWidth: 2 }} name="Normais" animationDuration={800} />
              <Area type="natural" dataKey="extras" stroke="#d97706" strokeWidth={2.5} fill="url(#gradExtras)" dot={{ r: 2.5, fill: '#d97706' }} activeDot={{ r: 5, strokeWidth: 2 }} name="Extras" animationDuration={800} animationBegin={200} />
              <Area type="natural" dataKey="adn" stroke="#7c3aed" strokeWidth={2.5} fill="url(#gradADN)" dot={{ r: 2.5, fill: '#7c3aed' }} activeDot={{ r: 5, strokeWidth: 2 }} name="Noturno" animationDuration={800} animationBegin={400} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* HH by Activity - Gradient Bars */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 Atividades por HH</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={{ value: { label: 'HH Total', color: '#991919' } }} className="h-[250px]">
            <BarChart data={byActivity}>
              <defs>
                <linearGradient id="barGradActivity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#991919" stopOpacity={1} />
                  <stop offset="100%" stopColor="#991919" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} angle={-20} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="url(#barGradActivity)" radius={[6, 6, 0, 0]} animationDuration={800} animationBegin={100} name="HH Total" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
