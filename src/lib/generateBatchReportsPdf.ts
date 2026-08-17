import JSZip from 'jszip';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/loose-client';
import { PdfOptions } from './generateReportPdf';
import { getReportPdfBlob } from './clientReportDownload';

export type BatchExportFormat = 'combined' | 'zip';
export type BatchExportDestination = 'download' | 'cloud' | 'both';

export interface BatchExportProgress {
  current: number;
  total: number;
  currentReportName: string;
}

export async function exportReportsBatch(
  reportIds: string[],
  formatType: BatchExportFormat,
  onProgress?: (progress: BatchExportProgress) => void,
  pdfOptions?: PdfOptions
): Promise<{ blob: Blob; filename: string; mimeType: string; failed: number }> {
  const total = reportIds.length;
  const zip = new JSZip();
  let failed = 0;

  for (let i = 0; i < reportIds.length; i++) {
    const reportId = reportIds[i];
    try {
      // Mesma origem de PDF do download individual: reaproveita o PDF assinado
      // atualizado ou regera com todas as assinaturas (WEES + Cliente).
      const { blob, filename } = await getReportPdfBlob(reportId, { pdfOptions });

      onProgress?.({ current: i + 1, total, currentReportName: filename });

      zip.file(filename, blob);
    } catch (err) {
      failed++;
      console.error('[batch-export] falha ao gerar PDF do relatório', reportId, err);
      onProgress?.({ current: i + 1, total, currentReportName: 'Falha em um relatório' });
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const prefix = formatType === 'combined' ? 'relatorios_combinados' : 'relatorios';
  const filename = `${prefix}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.zip`;

  return { blob: zipBlob, filename, mimeType: 'application/zip', failed };
}

export async function uploadBatchExportToCloud(blob: Blob, filename: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('admin-exports')
      .upload(`batch/${filename}`, blob, {
        contentType: blob.type,
        upsert: true
      });

    if (error) {
      console.error('Erro ao fazer upload:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('admin-exports')
      .getPublicUrl(`batch/${filename}`);

    return urlData?.publicUrl || null;
  } catch (error) {
    console.error('Erro ao fazer upload para cloud:', error);
    return null;
  }
}
