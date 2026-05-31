import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

const formatHHMM = (h: number) => `${Math.floor(h)}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2, '0')}`;

export function WorkforceReportsTab({ records }: { records: WorkforceRecord[] }) {
  // Ranking by activity
  const activityRanking = useMemo(() => {
    const map: Record<string, { total: number; workers: Set<string>; extras: number }> = {};
    records.forEach(r => {
      if (!map[r.activity_name]) map[r.activity_name] = { total: 0, workers: new Set(), extras: 0 };
      map[r.activity_name].total += r.normal_hours + r.overtime_75 + r.overtime_100 + r.compensation_hours;
      map[r.activity_name].extras += r.overtime_75 + r.overtime_100;
      map[r.activity_name].workers.add(r.worker_name.trim().toUpperCase());
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, total: d.total, extras: d.extras, workers: d.workers.size }))
      .sort((a, b) => b.total - a.total);
  }, [records]);

  // Report by role with subtotals
  const roleReport = useMemo(() => {
    const map: Record<string, { workers: Set<string>; hn: number; com: number; h75: number; h100: number; adn: number }> = {};
    records.forEach(r => {
      const fn = getBaseFunction(normalizeFunction(r.function_role) || 'MEIO OFICIAL');
      if (!map[fn]) map[fn] = { workers: new Set(), hn: 0, com: 0, h75: 0, h100: 0, adn: 0 };
      map[fn].workers.add(r.worker_name.trim().toUpperCase());
      map[fn].hn += r.normal_hours;
      map[fn].com += r.compensation_hours;
      map[fn].h75 += r.overtime_75;
      map[fn].h100 += r.overtime_100;
      map[fn].adn += r.night_bonus;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, workers: d.workers.size, hn: d.hn, com: d.com, h75: d.h75, h100: d.h100, adn: d.adn, total: d.hn + d.com + d.h75 + d.h100 }))
      .sort((a, b) => b.total - a.total);
  }, [records]);

  const totalUniqueWorkers = useMemo(() => {
    const globalSet = new Set<string>();
    records.forEach(r => globalSet.add(r.worker_name.trim().toUpperCase()));
    return globalSet.size;
  }, [records]);

  if (records.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">Nenhum dado para relatórios.</div>;
  }

  return (
    <Tabs defaultValue="ranking" className="space-y-4">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="ranking">🏆 Ranking de Atividades</TabsTrigger>
        <TabsTrigger value="roles">📊 Relatório por Função</TabsTrigger>
      </TabsList>

      <TabsContent value="ranking">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              🏆 Ranking de Atividades por Consumo de HH
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <Table className="table-fixed w-full">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold w-8 px-2 py-1.5 text-xs">#</TableHead>
                    <TableHead className="font-bold px-2 py-1.5 text-xs">ATIVIDADE</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">COLAB.</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-20">HH TOTAL</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-20">H. EXTRAS</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">% EXT.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityRanking.map((a, i) => (
                    <TableRow key={a.name}>
                      <TableCell className="font-bold text-muted-foreground px-2 py-1.5 text-xs">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium px-2 py-1.5 truncate">{a.name}</TableCell>
                      <TableCell className="text-xs text-center px-2 py-1.5">{a.workers}</TableCell>
                      <TableCell className="text-xs text-center font-mono font-medium px-2 py-1.5">{formatHHMM(a.total)}</TableCell>
                      <TableCell className="text-xs text-center font-mono text-orange-600 px-2 py-1.5">{formatHHMM(a.extras)}</TableCell>
                      <TableCell className="text-xs text-center px-2 py-1.5">
                        <Badge variant={a.total > 0 && (a.extras / a.total) > 0.2 ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {a.total > 0 ? Math.round((a.extras / a.total) * 100) : 0}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="roles">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📊 Relatório por Função</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <Table className="table-fixed w-full">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold px-2 py-1.5 text-xs">FUNÇÃO</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-14">QTD</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">HN</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">COM</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">75%</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">100%</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">ADN</TableHead>
                    <TableHead className="font-bold text-center px-2 py-1.5 text-xs w-16">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleReport.map(r => (
                    <TableRow key={r.name}>
                      <TableCell className="text-xs font-medium px-2 py-1.5 truncate">{r.name}</TableCell>
                      <TableCell className="text-xs text-center px-2 py-1.5">{r.workers}</TableCell>
                      <TableCell className="text-xs text-center font-mono px-2 py-1.5">{formatHHMM(r.hn)}</TableCell>
                      <TableCell className="text-xs text-center font-mono px-2 py-1.5">{formatHHMM(r.com)}</TableCell>
                      <TableCell className="text-xs text-center font-mono text-orange-600 px-2 py-1.5">{formatHHMM(r.h75)}</TableCell>
                      <TableCell className="text-xs text-center font-mono text-red-600 px-2 py-1.5">{formatHHMM(r.h100)}</TableCell>
                      <TableCell className="text-xs text-center font-mono text-indigo-600 px-2 py-1.5">{formatHHMM(r.adn)}</TableCell>
                      <TableCell className="text-xs text-center font-mono font-bold px-2 py-1.5">{formatHHMM(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 bg-muted/90 backdrop-blur-sm">
                  <TableRow className="font-bold border-t-2">
                    <TableCell className="font-bold px-2 py-1.5 text-xs">TOTAL</TableCell>
                    <TableCell className="text-center font-bold px-2 py-1.5 text-xs">{totalUniqueWorkers}</TableCell>
                    <TableCell className="text-center font-bold font-mono px-2 py-1.5 text-xs">{formatHHMM(roleReport.reduce((s, r) => s + r.hn, 0))}</TableCell>
                    <TableCell className="text-center font-bold font-mono px-2 py-1.5 text-xs">{formatHHMM(roleReport.reduce((s, r) => s + r.com, 0))}</TableCell>
                    <TableCell className="text-center font-bold font-mono text-orange-600 px-2 py-1.5 text-xs">{formatHHMM(roleReport.reduce((s, r) => s + r.h75, 0))}</TableCell>
                    <TableCell className="text-center font-bold font-mono text-red-600 px-2 py-1.5 text-xs">{formatHHMM(roleReport.reduce((s, r) => s + r.h100, 0))}</TableCell>
                    <TableCell className="text-center font-bold font-mono text-indigo-600 px-2 py-1.5 text-xs">{formatHHMM(roleReport.reduce((s, r) => s + r.adn, 0))}</TableCell>
                    <TableCell className="text-center font-bold font-mono px-2 py-1.5 text-xs">{formatHHMM(roleReport.reduce((s, r) => s + r.total, 0))}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
