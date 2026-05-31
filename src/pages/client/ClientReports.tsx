import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Calendar, Download, ChevronRight, ArrowLeft,
  Loader2, Wrench, Eye,
} from 'lucide-react';

import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { triggerDownloadFromBlob } from '@/lib/downloadUtils';

const shiftLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface SignedReport {
  reportId: string;
  rdoNumber: number | null;
  date: string;
  shift: string | null;
  projectId: string;
  projectName: string;
  signedFileUrl: string | null;
  signedAt: string | null;
  documentName: string | null;
}

export default function ClientReports() {
  const navigate = useNavigate();
  const { user, clientProfile } = useClientAuth();

  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['client-signed-reports', user?.id, clientProfile?.id, clientProfile?._source],
    enabled: !!user?.id && !!clientProfile?.id,
    queryFn: async (): Promise<SignedReport[]> => {
      if (!clientProfile) return [];

      // Restrictive rule: only reports the client was explicitly invited to
      // sign (row in report_company_approvers / report_client_approvers).
      const isContact = clientProfile._source === 'company_contacts';
      const approverIds = new Set<string>();
      if (isContact) {
        const { data: rcoa } = await supabase
          .from('report_company_approvers')
          .select('report_id')
          .eq('contact_id', clientProfile.id);
        (rcoa || []).forEach((r: any) => approverIds.add(r.report_id));
      } else {
        const { data: rca } = await supabase
          .from('report_client_approvers')
          .select('report_id')
          .eq('client_id', clientProfile.id);
        (rca || []).forEach((r: any) => approverIds.add(r.report_id));
      }
      const reportIds = Array.from(approverIds);
      if (!reportIds.length) return [];

      // Fetch reports already signed/finalized within the approver scope
      const { data: docs, error } = await supabase
        .from('reports')
        .select(`
          id, rdo_number, date, shift, project_id, signed_pdf_url, updated_at,
          project:projects(id, name)
        `)
        .in('id', reportIds)
        .in('status', ['signed', 'finalized'])
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading signed reports:', error);
        return [];
      }

      const seen = new Set<string>();
      const result: SignedReport[] = [];
      for (const r of (docs || []) as any[]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        result.push({
          reportId: r.id,
          rdoNumber: r.rdo_number ?? null,
          date: r.date,
          shift: r.shift ?? null,
          projectId: r.project?.id ?? r.project_id,
          projectName: r.project?.name ?? 'Atividade',
          signedFileUrl: r.signed_pdf_url ?? null,
          signedAt: r.updated_at ?? null,
          documentName: null,
        });
      }
      return result;
    },
  });

  // Group: activity -> year -> month -> reports
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        total: number;
        years: Map<number, Map<number, SignedReport[]>>;
      }
    >();

    for (const r of reports) {
      const key = r.projectId;
      if (!map.has(key)) {
        map.set(key, {
          projectId: r.projectId,
          projectName: r.projectName,
          total: 0,
          years: new Map(),
        });
      }
      const activity = map.get(key)!;
      activity.total += 1;

      const d = parseISO(r.date);
      const y = d.getFullYear();
      const m = d.getMonth();

      if (!activity.years.has(y)) activity.years.set(y, new Map());
      const yearMap = activity.years.get(y)!;
      if (!yearMap.has(m)) yearMap.set(m, []);
      yearMap.get(m)!.push(r);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName, 'pt-BR'),
    );
  }, [reports]);

  const totalsByYear = useMemo(() => {
    const t: Record<number, number> = {};
    for (const r of reports) {
      const y = parseISO(r.date).getFullYear();
      t[y] = (t[y] || 0) + 1;
    }
    return t;
  }, [reports]);

  const handleDownloadAll = async (
    activityKey: string,
    activityName: string,
    items: SignedReport[],
  ) => {
    const withUrls = items.filter((i) => i.signedFileUrl);
    if (withUrls.length === 0) {
      toast.error('Nenhum PDF assinado disponível para download');
      return;
    }

    const preWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');
    setDownloadingZip(activityKey);

    try {
      const zip = new JSZip();
      let ok = 0;

      for (const item of withUrls) {
        try {
          const resp = await fetch(item.signedFileUrl!);
          if (!resp.ok) continue;
          const buf = await resp.arrayBuffer();
          const fileName =
            item.documentName ||
            `RDO-${(item.rdoNumber ?? 0).toString().padStart(3, '0')}-${item.date}.pdf`;
          zip.file(fileName, buf);
          ok += 1;
        } catch (err) {
          console.warn('Falha ao baixar item', err);
        }
      }

      if (ok === 0) {
        toast.error('Não foi possível baixar os PDFs');
        if (preWindow) preWindow.close();
        return;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const safe = activityName.replace(/[^\w\-]+/g, '_');
      triggerDownloadFromBlob(
        blob,
        `RDOs_${safe}_${format(new Date(), 'yyyy-MM-dd')}.zip`,
        { preOpenedWindow: preWindow ?? undefined },
      );
      toast.success(`${ok} PDF(s) baixados`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar ZIP');
      if (preWindow) preWindow.close();
    } finally {
      setDownloadingZip(null);
    }
  };

  const currentActivity = selectedActivity
    ? grouped.find((g) => g.projectId === selectedActivity)
    : null;

  // ---- Render helpers ----

  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
      <button
        onClick={() => {
          setSelectedActivity(null);
          setSelectedYear(null);
          setSelectedMonth(null);
        }}
        className="hover:text-foreground transition-colors"
      >
        Meus RDOs
      </button>
      {currentActivity && (
        <>
          <ChevronRight className="h-3 w-3" />
          <button
            onClick={() => {
              setSelectedYear(null);
              setSelectedMonth(null);
            }}
            className="hover:text-foreground transition-colors truncate max-w-[200px]"
          >
            {currentActivity.projectName}
          </button>
        </>
      )}
      {selectedYear !== null && (
        <>
          <ChevronRight className="h-3 w-3" />
          <button
            onClick={() => setSelectedMonth(null)}
            className="hover:text-foreground transition-colors"
          >
            {selectedYear}
          </button>
        </>
      )}
      {selectedMonth !== null && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{monthNames[selectedMonth]}</span>
        </>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (reports.length === 0) {
    return (
      <ClientLayout>
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Meus RDOs</h1>
          <p className="text-muted-foreground">
            Você ainda não possui RDOs assinados. Quando aprovar relatórios, eles aparecerão aqui
            organizados por atividade.
          </p>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {(selectedActivity || selectedYear !== null || selectedMonth !== null) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedMonth !== null) setSelectedMonth(null);
                    else if (selectedYear !== null) setSelectedYear(null);
                    else if (selectedActivity) setSelectedActivity(null);
                  }}
                  className="gap-1 -ml-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Meus RDOs</h1>
            {renderBreadcrumbs()}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <FileText className="h-3 w-3" /> Total: {reports.length}
            </Badge>
            {Object.entries(totalsByYear)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([year, count]) => (
                <Badge key={year} variant="outline">
                  {year}: {count}
                </Badge>
              ))}
          </div>
        </div>

        {/* Level 1: Activities */}
        {!selectedActivity && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.map((activity) => {
              const yearCount = activity.years.size;
              const items: SignedReport[] = [];
              activity.years.forEach((mMap) =>
                mMap.forEach((arr) => items.push(...arr)),
              );
              const hasPdfs = items.some((i) => i.signedFileUrl);
              return (
                <Card
                  key={activity.projectId}
                  className="cursor-pointer hover:border-primary/40 group"
                  onClick={() => setSelectedActivity(activity.projectId)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Wrench className="h-5 w-5 text-primary" />
                      </div>
                      {hasPdfs && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadAll(
                              activity.projectId,
                              activity.projectName,
                              items,
                            );
                          }}
                          disabled={downloadingZip === activity.projectId}
                        >
                          {downloadingZip === activity.projectId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          ZIP
                        </Button>
                      )}
                    </div>
                    <h3 className="font-semibold text-base leading-tight mb-1 line-clamp-2">
                      {activity.projectName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {activity.total} relatório(s) • {yearCount} ano(s)
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Level 2: Years */}
        {selectedActivity && currentActivity && selectedYear === null && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from(currentActivity.years.entries())
              .sort((a, b) => b[0] - a[0])
              .map(([year, mMap]) => {
                const total = Array.from(mMap.values()).reduce(
                  (acc, arr) => acc + arr.length,
                  0,
                );
                return (
                  <Card
                    key={year}
                    className="cursor-pointer hover:border-primary/40"
                    onClick={() => setSelectedYear(year)}
                  >
                    <CardContent className="p-5 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-2xl font-bold">{year}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {mMap.size} mês(es) • {total} RDO(s)
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}

        {/* Level 3: Months */}
        {selectedActivity && currentActivity && selectedYear !== null && selectedMonth === null && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from(currentActivity.years.get(selectedYear)?.entries() ?? [])
              .sort((a, b) => b[0] - a[0])
              .map(([month, items]) => (
                <Card
                  key={month}
                  className="cursor-pointer hover:border-primary/40"
                  onClick={() => setSelectedMonth(month)}
                >
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-base font-semibold">{monthNames[month]}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {items.length} RDO(s)
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* Level 4: RDOs list */}
        {selectedActivity &&
          currentActivity &&
          selectedYear !== null &&
          selectedMonth !== null && (
            <Card>
              <CardContent className="p-0 divide-y">
                {(currentActivity.years.get(selectedYear)?.get(selectedMonth) ?? [])
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((r) => (
                    <div
                      key={r.reportId}
                      className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            RDO Nº {(r.rdoNumber ?? 0).toString().padStart(3, '0')}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {format(parseISO(r.date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {r.shift && (
                            <Badge variant="outline" className="text-xs">
                              {shiftLabels[r.shift] || r.shift}
                            </Badge>
                          )}
                        </div>
                        {r.signedAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Assinado em{' '}
                            {format(new Date(r.signedAt), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => navigate(`/client/reports/${r.reportId}`)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">Ver</span>
                        </Button>
                        {r.signedFileUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() =>
                              window.open(r.signedFileUrl!, '_blank', 'noopener,noreferrer')
                            }
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">PDF</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
      </div>
    </ClientLayout>
  );
}
