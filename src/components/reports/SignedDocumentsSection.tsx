import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileSignature, Search, Download, ExternalLink, 
  Loader2, MapPin, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { uploadBatchExportToCloud } from '@/lib/generateBatchReportsPdf';
import { triggerDownloadFromBlob } from '@/lib/downloadUtils';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface SignedReport {
  id: string;
  rdo_number: number | null;
  date: string;
  shift: string;
  location: string | null;
  signed_pdf_url: string | null;
  updated_at: string | null;
  project: {
    name: string;
    site: {
      name: string;
      company: {
        name: string;
      } | null;
    } | null;
  } | null;
}

const shiftLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

interface SignedDocumentsSectionProps {
  onClose: () => void;
  adminProjectIds?: string[];
}

export function SignedDocumentsSection({ onClose, adminProjectIds }: SignedDocumentsSectionProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: signedReports = [], isLoading } = useQuery({
    queryKey: ['signed-reports-cabinet', adminProjectIds],
    queryFn: async () => {
      let query = supabase
        .from('reports')
        .select(`
          id, rdo_number, date, shift, location, signed_pdf_url, updated_at,
          project:projects(
            name,
            site:sites(name, company:companies(name))
          )
        `)
        .eq('status', 'signed')
        .is('archived_at', null)
        .not('signed_pdf_url', 'is', null)
        .order('updated_at', { ascending: false });

      if (adminProjectIds && adminProjectIds.length > 0) {
        query = query.in('project_id', adminProjectIds);
      } else if (adminProjectIds && adminProjectIds.length === 0) {
        return [] as SignedReport[];
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SignedReport[];
    },
  });

  const filteredReports = useMemo(() => {
    if (!searchTerm) return signedReports;
    const term = searchTerm.toLowerCase();
    return signedReports.filter((r) => {
      const projectName = r.project?.name?.toLowerCase() || '';
      const siteName = r.project?.site?.name?.toLowerCase() || '';
      const companyName = r.project?.site?.company?.name?.toLowerCase() || '';
      const location = r.location?.toLowerCase() || '';
      return (
        projectName.includes(term) ||
        siteName.includes(term) ||
        companyName.includes(term) ||
        location.includes(term)
      );
    });
  }, [signedReports, searchTerm]);

  const buildFileName = (r: SignedReport) =>
    `RDO_${(r.rdo_number ?? 0).toString().padStart(3, '0')}_${format(parseISO(r.date), 'yyyy-MM-dd')}.pdf`;

  const handleDownloadAll = async () => {
    if (filteredReports.length === 0) return;
    const downloadWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');
    if (!downloadWindow) toast.error('Permita pop-ups para iniciar o download');

    setIsDownloadingAll(true);
    const zip = new JSZip();
    let successCount = 0;

    try {
      for (const r of filteredReports) {
        if (!r.signed_pdf_url) continue;
        try {
          const res = await fetch(r.signed_pdf_url);
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          zip.file(buildFileName(r), new Uint8Array(buf));
          successCount++;
        } catch (err) {
          console.error('Error fetching signed PDF:', err);
        }
      }

      if (successCount === 0) {
        toast.error('Não foi possível baixar nenhum documento');
        return;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const fileName = `RDOs_Assinados_${format(new Date(), 'yyyy-MM-dd')}.zip`;
      triggerDownloadFromBlob(blob, fileName, { preOpenedWindow: downloadWindow });
      uploadBatchExportToCloud(blob, fileName).catch((err) =>
        console.warn('[download] uploadBatchExportToCloud failed:', err)
      );
      toast.success(`${successCount} documento(s) baixado(s) com sucesso!`);
    } catch (error) {
      console.error('Error creating ZIP:', error);
      toast.error('Erro ao criar arquivo ZIP');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleDownloadSingle = async (r: SignedReport) => {
    if (!r.signed_pdf_url) {
      toast.error('PDF assinado não disponível');
      return;
    }
    setDownloadingId(r.id);
    try {
      const res = await fetch(r.signed_pdf_url);
      if (!res.ok) throw new Error('Falha ao baixar');
      const blob = await res.blob();
      triggerDownloadFromBlob(blob, buildFileName(r));
    } catch (err) {
      console.error(err);
      window.open(r.signed_pdf_url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileSignature className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">RDOs Assinados</CardTitle>
              <p className="text-sm text-muted-foreground">
                {signedReports.length} relatório(s) assinado(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || filteredReports.length === 0}
              className="gap-2"
            >
              {isDownloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar Todos ({filteredReports.length})
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por atividade, unidade, fábrica..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileSignature className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">
              {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum documento assinado'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Tente ajustar sua busca' : 'Documentos assinados aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fábrica / RDO</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead className="hidden md:table-cell">Unidade</TableHead>
                  <TableHead className="hidden lg:table-cell">Turno</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {r.project?.site?.company?.name || '-'}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          RDO Nº {(r.rdo_number ?? 1).toString().padStart(3, '0')} - {format(parseISO(r.date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.project?.name || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {r.project?.site?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {r.shift && (
                        <Badge variant="outline" className="text-xs">
                          {shiftLabels[r.shift] || r.shift}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {format(parseISO(r.date), 'dd/MM/yy', { locale: ptBR })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadSingle(r)}
                          disabled={downloadingId === r.id}
                          title="Baixar PDF"
                        >
                          {downloadingId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/reports/${r.id}`)}
                          title="Ver Relatório"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
