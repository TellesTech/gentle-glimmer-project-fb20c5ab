import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Activity, Database, Shield, AlertTriangle, CheckCircle, RefreshCw, TrendingUp,
} from "lucide-react";

interface HealthData {
  counts: Record<string, number>;
  dqScores: Record<string, number>;
  globalDQ: number;
  anomalies: Array<{ id: string; name: string; progress: number }>;
  reportsPerDay: Record<string, number>;
  correctionsCount: number;
  timestamp: string;
}

const countLabels: Record<string, string> = {
  reports: 'Relatórios',
  projects: 'Atividades',
  profiles: 'Efetivo',
  companies: 'Fábricas',
  sites: 'Unidades',
  activities: 'Ativ. nos RDOs',
  photos: 'Fotos',
  deviations: 'Desvios',
};

const CHART_COLORS = [
  "hsl(218, 45%, 18%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 68%, 60%)",
  "hsl(199, 89%, 48%)",
];

export default function AdminDataQuality() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('health-check');
      if (error) throw error;
      setData(result);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  const dqChartData = data ? Object.entries(data.dqScores).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    score: value,
  })) : [];

  const reportsChartData = data ? Object.entries(data.reportsPerDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      relatórios: count,
    })) : [];

  const countsData = data ? [
    { name: "Relatórios", value: data.counts.reports },
    { name: "Atividades", value: data.counts.projects },
    { name: "Efetivo", value: data.counts.profiles },
    { name: "Unidades", value: data.counts.sites },
    { name: "Fotos", value: data.counts.photos },
  ] : [];

  const getDQColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getDQBadge = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Qualidade de Dados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento de integridade, completude e anomalias do sistema
          </p>
        </div>
        <Button onClick={fetchHealth} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">DQ Score Global</p>
                    <p className={`text-2xl font-bold ${getDQColor(data.globalDQ)}`}>
                      {data.globalDQ}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Relatórios</p>
                    <p className="text-2xl font-bold text-foreground">{data.counts.reports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Anomalias</p>
                    <p className="text-2xl font-bold text-warning">{data.anomalies.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Correções Registradas</p>
                    <p className="text-2xl font-bold text-foreground">{data.correctionsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DQ Score by Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  DQ Score por Tabela
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dqChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      formatter={(value: number) => [`${value}%`, "Score"]}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {dqChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.score >= 80 ? "hsl(142, 71%, 45%)" : entry.score >= 60 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Reports per Day */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Relatórios / Dia (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={reportsChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="relatórios"
                      stroke="hsl(218, 45%, 18%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(218, 45%, 18%)", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Distribution + Anomalies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição de Dados</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={countsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {countsData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Anomalies */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Anomalias Detectadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.anomalies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mb-2 text-success" />
                    <p className="text-sm">Nenhuma anomalia detectada</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto">
                    {data.anomalies.map((anomaly) => (
                      <div key={anomaly.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                        <div>
                          <p className="text-sm font-medium text-foreground">{anomaly.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Progresso: {anomaly.progress}% — Em andamento sem evolução
                          </p>
                        </div>
                        <Badge variant={getDQBadge(anomaly.progress)}>
                          {anomaly.progress}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Counts table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contagens do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {Object.entries(data.counts).map(([key, value]) => (
                  <div key={key} className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{countLabels[key] || key}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Última atualização: {new Date(data.timestamp).toLocaleString('pt-BR')}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
