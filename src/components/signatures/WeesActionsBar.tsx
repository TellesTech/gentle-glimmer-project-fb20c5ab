import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, Eye, EyeOff, ExternalLink, Loader2, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getReportPdfBlob } from '@/lib/clientReportDownload';
import { triggerDownloadFromBlob } from '@/lib/downloadUtils';

interface WeesActionsBarProps {
  reportId: string;
  rdoLabel?: string;
  isClientPreview: boolean;
  onTogglePreview: () => void;
}

export function buildClientReportUrl(reportId: string) {
  return `${window.location.origin}/client/reports/${reportId}`;
}

export function WeesActionsBar({ reportId, rdoLabel, isClientPreview, onTogglePreview }: WeesActionsBarProps) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const handlePdf = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await getReportPdfBlob(reportId);
      triggerDownloadFromBlob(blob, filename);
      toast.success('PDF gerado com sucesso');
    } catch {
      toast.error('Não foi possível gerar o PDF deste RDO');
    } finally {
      setDownloading(false);
    }
  };

  const reminderText = `Olá! O RDO ${rdoLabel || ''} está disponível no Portal Wees e aguarda sua assinatura eletrônica.

Acesse: ${buildClientReportUrl(reportId)}

Atenciosamente,
*Equipe WEES* 🏗️`;

  if (isClientPreview) {
    return (
      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Você está vendo esta página como o cliente vê.
          </p>
          <Button size="sm" variant="outline" onClick={onTogglePreview} className="gap-2">
            <EyeOff className="w-4 h-4" />
            Voltar à visão WEES
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Ações WEES
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onTogglePreview} className="gap-2">
            <Eye className="w-4 h-4" />
            Ver como cliente
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/reports/${reportId}`)} className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Abrir na área WEES
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy(buildClientReportUrl(reportId), 'Link de assinatura copiado')}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            Copiar link
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy(reminderText, 'Mensagem de cobrança copiada — cole no WhatsApp do cliente')}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            Cobrar assinatura
          </Button>
          <Button size="sm" variant="outline" onClick={handlePdf} disabled={downloading} className="gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
