import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLogoBase64 } from './logoBase64';
import { supabase } from '@/integrations/supabase/loose-client';
import { format } from 'date-fns';

interface AuditError {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  workerName: string;
  date: string;
  activity: string;
}

interface AuditPdfOptions {
  projectName: string;
  startDate: string;
  endDate: string;
}

const SEVERITY_LABELS: Record<string, string> = { high: 'Alto', medium: 'Médio', low: 'Baixo' };
const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  high: [220, 38, 38],
  medium: [234, 88, 12],
  low: [202, 138, 4],
};
const SEVERITY_BG: Record<string, [number, number, number]> = {
  high: [254, 226, 226],
  medium: [255, 237, 213],
  low: [254, 249, 195],
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

export async function generateAuditPdf(errors: AuditError[], options: AuditPdfOptions) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();

  // Fetch branding
  let primaryColor: [number, number, number] = [128, 0, 32]; // fallback bordeaux
  let systemName = 'WEES Engenharia';
  try {
    const { data } = await supabase.rpc('get_public_branding');
    const s = data?.[0];
    if (s?.primary_color) {
      const match = s.primary_color.match(/^#[0-9a-fA-F]{6}$/);
      if (match) primaryColor = hexToRgb(s.primary_color);
    }
    if (s?.system_name) systemName = s.system_name;
  } catch { /* use defaults */ }

  // Logo
  let logoBase64: string | null = null;
  try { logoBase64 = await getLogoBase64(); } catch { /* skip */ }

  // ── Header ──
  const headerH = 28;
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageW, headerH, 'F');

  let logoEndX = 14;
  if (logoBase64) {
    try {
      const img = new Image();
      img.src = logoBase64;
      const maxH = 16;
      const maxW = 40;
      const ratio = img.width / img.height;
      let w = maxH * ratio;
      let h = maxH;
      if (w > maxW) { w = maxW; h = w / ratio; }
      doc.addImage(logoBase64, 'PNG', 10, (headerH - h) / 2, w, h);
      logoEndX = 10 + w + 4;
    } catch { /* skip logo */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE AUDITORIA — HOMEM-HORA', logoEndX, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${options.projectName}  |  ${options.startDate} a ${options.endDate}`, logoEndX, 19);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, logoEndX, 24);

  let y = headerH + 8;

  // ── Summary ──
  const counts = { high: 0, medium: 0, low: 0 };
  for (const e of errors) counts[e.severity]++;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Resumo: ${errors.length} erro${errors.length !== 1 ? 's' : ''} detectado${errors.length !== 1 ? 's' : ''}`, 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  for (const sev of ['high', 'medium', 'low'] as const) {
    if (counts[sev] === 0) continue;
    doc.setFillColor(...SEVERITY_COLORS[sev]);
    doc.roundedRect(14, y - 3.5, 4, 4, 1, 1, 'F');
    doc.text(`${SEVERITY_LABELS[sev]}: ${counts[sev]}`, 20, y);
    y += 5;
  }
  y += 4;

  // ── Group by type ──
  const grouped: Record<string, AuditError[]> = {};
  for (const e of errors) (grouped[e.type] ||= []).push(e);

  for (const [type, errs] of Object.entries(grouped)) {
    // Check page space
    if (y > 260) { doc.addPage(); y = 14; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`${type} (${errs.length})`, 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Data', 'Colaborador', 'Atividade', 'Descrição', 'Sev.']],
      body: errs.map(e => [e.date, e.workerName, e.activity, e.message, SEVERITY_LABELS[e.severity]]),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        4: { cellWidth: 14, halign: 'center' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const sev = errs[data.row.index]?.severity;
          if (sev) {
            data.cell.styles.fillColor = SEVERITY_BG[sev];
            if (data.column.index === 4) {
              data.cell.styles.textColor = SEVERITY_COLORS[sev];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;
  }

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    doc.text(`${systemName} — Auditoria HH`, 14, pageH - 6);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 6, { align: 'right' });
  }

  return doc;
}
