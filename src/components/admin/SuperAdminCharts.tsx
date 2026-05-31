import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { parseISO } from 'date-fns';
import { 
  BarChart3, PieChart as PieChartIcon, TrendingUp, Users, 
  Building2, FileText, ClipboardCheck, UserCheck, Percent,
  Activity, Crown, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartData {
  reportsByDay: { date: string; count: number }[];
  reportsByStatus: { status: string; count: number; color: string }[];
  topCompanies: { name: string; reports: number }[];
  usersByWeek: { week: string; count: number }[];
  workforceByCompany: { name: string; planned: number; actual: number }[];
  topSupervisors: { name: string; count: number }[];
  contractsData: { contract: string; count: number }[];
  workforceTrend: { week: string; planned: number; actual: number }[];
  generalStats: {
    totalPlanned: number;
    totalActual: number;
    generalPercentage: number;
    totalContracts: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b',
  completed: '#10b981',
  finalized: '#3b82f6',
  sent: '#8b5cf6',
  signed: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  completed: 'Concluído',
  finalized: 'Finalizado',
  sent: 'Enviado',
  signed: 'Assinado',
};

// Premium Card Component
const PremiumCard = ({ 
  children, 
  className,
  glowColor = 'amber'
}: { 
  children: React.ReactNode; 
  className?: string;
  glowColor?: 'amber' | 'blue' | 'green' | 'purple' | 'emerald';
}) => {
  const glowStyles = {
    amber: 'hover:shadow-amber-500/20',
    blue: 'hover:shadow-blue-500/20',
    green: 'hover:shadow-green-500/20',
    purple: 'hover:shadow-purple-500/20',
    emerald: 'hover:shadow-emerald-500/20',
  };

  return (
    <Card className={cn(
      "relative overflow-hidden backdrop-blur-sm bg-card/80 border-border/50",
      "transition-all duration-300 hover:shadow-xl",
      glowStyles[glowColor],
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      {children}
    </Card>
  );
};

// Premium Stat Card
const PremiumStatCard = ({
  icon: Icon,
  label,
  value,
  gradient,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  gradient: string;
  iconColor: string;
}) => (
  <PremiumCard className={cn("group", gradient)}>
    <CardContent className="pt-5 pb-4">
      <div className="flex items-center gap-4">
        <div className={cn(
          "p-3 rounded-xl backdrop-blur-sm transition-transform duration-300 group-hover:scale-110",
          "bg-gradient-to-br from-white/20 to-white/5 shadow-inner"
        )}>
          <Icon className={cn("h-6 w-6", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold mt-0.5 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </CardContent>
  </PremiumCard>
);

// Premium Chart Card
const PremiumChartCard = ({
  title,
  icon: Icon,
  iconColor,
  children,
  className,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <PremiumCard className={className}>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold flex items-center gap-2">
        <div className={cn("p-1.5 rounded-lg", iconColor.replace('text-', 'bg-').replace('-500', '-500/20').replace('-600', '-600/20'))}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{title}</span>
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </PremiumCard>
);

export function SuperAdminCharts() {
  const [data, setData] = useState<ChartData>({
    reportsByDay: [],
    reportsByStatus: [],
    topCompanies: [],
    usersByWeek: [],
    workforceByCompany: [],
    topSupervisors: [],
    contractsData: [],
    workforceTrend: [],
    generalStats: { totalPlanned: 0, totalActual: 0, generalPercentage: 0, totalContracts: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch reports with all needed data
      const { data: reports } = await supabase
        .from('reports')
        .select(`
          id, date, status, created_at, 
          planned_workforce, actual_workforce,
          supervisor_name, contract_number,
          project:projects(company:companies(name))
        `)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Fetch users
      const { data: users } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Process reports by day
      const reportsByDayMap = new Map<string, number>();
      const statusCount = new Map<string, number>();
      const companyReports = new Map<string, number>();
      const supervisorCount = new Map<string, number>();
      const contractCount = new Map<string, number>();
      const workforceByCompanyMap = new Map<string, { planned: number; actual: number }>();
      const workforceTrendMap = new Map<string, { planned: number; actual: number }>();
      
      let totalPlanned = 0;
      let totalActual = 0;
      const uniqueContracts = new Set<string>();

      reports?.forEach((report: any) => {
        // Reports by day
        const date = parseISO(report.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        reportsByDayMap.set(date, (reportsByDayMap.get(date) || 0) + 1);

        // Status count
        const status = report.status || 'draft';
        statusCount.set(status, (statusCount.get(status) || 0) + 1);

        // Company reports and workforce
        const companyName = report.project?.company?.name || 'Sem fábrica';
        companyReports.set(companyName, (companyReports.get(companyName) || 0) + 1);
        
        const currentWorkforce = workforceByCompanyMap.get(companyName) || { planned: 0, actual: 0 };
        workforceByCompanyMap.set(companyName, {
          planned: currentWorkforce.planned + (report.planned_workforce || 0),
          actual: currentWorkforce.actual + (report.actual_workforce || 0),
        });

        // Supervisor count
        if (report.supervisor_name) {
          supervisorCount.set(report.supervisor_name, (supervisorCount.get(report.supervisor_name) || 0) + 1);
        }

        // Contract count
        if (report.contract_number) {
          contractCount.set(report.contract_number, (contractCount.get(report.contract_number) || 0) + 1);
          uniqueContracts.add(report.contract_number);
        }

        // Workforce totals
        totalPlanned += report.planned_workforce || 0;
        totalActual += report.actual_workforce || 0;

        // Workforce trend by week
        const weekStart = parseISO(report.date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const currentTrend = workforceTrendMap.get(weekKey) || { planned: 0, actual: 0 };
        workforceTrendMap.set(weekKey, {
          planned: currentTrend.planned + (report.planned_workforce || 0),
          actual: currentTrend.actual + (report.actual_workforce || 0),
        });
      });

      // Process users by week
      const usersByWeekMap = new Map<string, number>();
      users?.forEach((user) => {
        const weekStart = new Date(user.created_at);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = `Sem ${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
        usersByWeekMap.set(weekKey, (usersByWeekMap.get(weekKey) || 0) + 1);
      });

      // Convert maps to arrays
      const reportsByDay = Array.from(reportsByDayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);

      const reportsByStatus = Array.from(statusCount.entries())
        .map(([status, count]) => ({ 
          status: STATUS_LABELS[status] || status, 
          count,
          color: STATUS_COLORS[status] || '#64748b'
        }));

      const topCompanies = Array.from(companyReports.entries())
        .map(([name, reports]) => ({ name: name.substring(0, 15), reports }))
        .sort((a, b) => b.reports - a.reports)
        .slice(0, 5);

      const usersByWeek = Array.from(usersByWeekMap.entries())
        .map(([week, count]) => ({ week, count }))
        .sort((a, b) => a.week.localeCompare(b.week));

      const workforceByCompany = Array.from(workforceByCompanyMap.entries())
        .map(([name, data]) => ({ name: name.substring(0, 12), ...data }))
        .sort((a, b) => b.planned - a.planned)
        .slice(0, 5);

      const topSupervisors = Array.from(supervisorCount.entries())
        .map(([name, count]) => ({ name: name.substring(0, 15), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const contractsData = Array.from(contractCount.entries())
        .map(([contract, count]) => ({ contract: contract.substring(0, 12), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const workforceTrend = Array.from(workforceTrendMap.entries())
        .map(([week, data]) => ({ week, ...data }))
        .sort((a, b) => a.week.localeCompare(b.week));

      const generalPercentage = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

      setData({
        reportsByDay,
        reportsByStatus,
        topCompanies,
        usersByWeek,
        workforceByCompany,
        topSupervisors,
        contractsData,
        workforceTrend,
        generalStats: {
          totalPlanned,
          totalActual,
          generalPercentage,
          totalContracts: uniqueContracts.size,
        },
      });
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Loading Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        
        {/* Loading Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="backdrop-blur-sm bg-card/50">
              <CardContent className="pt-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="backdrop-blur-sm bg-card/50">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const chartConfig = {
    count: { label: 'Quantidade', color: 'hsl(var(--primary))' },
    reports: { label: 'Relatórios', color: 'hsl(var(--primary))' },
    planned: { label: 'Programado', color: '#3b82f6' },
    actual: { label: 'Real', color: '#10b981' },
  };

  return (
    <div className="space-y-6">
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PremiumChartCard
          title="Relatórios por Dia (14 dias)"
          icon={TrendingUp}
          iconColor="text-blue-500"
        >
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart data={data.reportsByDay}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <ChartTooltip 
                content={<ChartTooltipContent />} 
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="url(#lineGradient)" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ fill: '#8b5cf6', strokeWidth: 0, r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </PremiumChartCard>

        <PremiumChartCard
          title="Relatórios por Status"
          icon={PieChartIcon}
          iconColor="text-purple-500"
        >
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <PieChart>
              <defs>
                {data.reportsByStatus.map((entry, index) => (
                  <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={data.reportsByStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={75}
                paddingAngle={3}
                label={({ status, count }) => `${status}: ${count}`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              >
                {data.reportsByStatus.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#pieGradient-${index})`}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </PremiumChartCard>
      </div>

      {/* Charts Row 2 - Workforce */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PremiumChartCard
          title="Efetivo: Programado vs Real (Top Fábricas)"
          icon={BarChart3}
          iconColor="text-emerald-500"
        >
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={data.workforceByCompany}>
              <defs>
                <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => <span className="text-sm font-medium">{value}</span>}
              />
              <Bar dataKey="planned" name="Programado" fill="url(#plannedGradient)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="actual" name="Real" fill="url(#actualGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </PremiumChartCard>

        <PremiumChartCard
          title="Efetivo por Período (Semanal)"
          icon={Activity}
          iconColor="text-indigo-500"
        >
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart data={data.workforceTrend}>
              <defs>
                <linearGradient id="areaPlanned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="areaActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => <span className="text-sm font-medium">{value}</span>}
              />
              <Area 
                type="monotone" 
                dataKey="planned" 
                name="Programado"
                stroke="#3b82f6" 
                strokeWidth={2}
                fill="url(#areaPlanned)" 
              />
              <Area 
                type="monotone" 
                dataKey="actual" 
                name="Real"
                stroke="#10b981" 
                strokeWidth={2}
                fill="url(#areaActual)" 
              />
            </AreaChart>
          </ChartContainer>
        </PremiumChartCard>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PremiumChartCard
          title="Top Fábricas"
          icon={Building2}
          iconColor="text-blue-600"
        >
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={data.topCompanies} layout="vertical">
              <defs>
                <linearGradient id="companyGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="reports" fill="url(#companyGradient)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        </PremiumChartCard>

        <PremiumChartCard
          title="Top Supervisores"
          icon={ClipboardCheck}
          iconColor="text-violet-500"
        >
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={data.topSupervisors} layout="vertical">
              <defs>
                <linearGradient id="supervisorGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" name="Relatórios" fill="url(#supervisorGradient)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        </PremiumChartCard>

        <PremiumChartCard
          title="Contratos Mais Ativos"
          icon={FileText}
          iconColor="text-amber-500"
        >
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={data.contractsData} layout="vertical">
              <defs>
                <linearGradient id="contractGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <YAxis type="category" dataKey="contract" tick={{ fontSize: 9 }} width={80} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" name="Relatórios" fill="url(#contractGradient)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        </PremiumChartCard>
      </div>

      {/* Users by Week */}
      <PremiumChartCard
        title="Novos Usuários por Semana"
        icon={Users}
        iconColor="text-teal-500"
      >
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart data={data.usersByWeek}>
            <defs>
              <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area 
              type="monotone" 
              dataKey="count" 
              stroke="#14b8a6" 
              strokeWidth={2}
              fill="url(#usersGradient)" 
            />
          </AreaChart>
        </ChartContainer>
      </PremiumChartCard>
    </div>
  );
}
