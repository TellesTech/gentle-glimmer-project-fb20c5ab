import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLogoBase64 } from './logoBase64';
import weesLogoRed from '@/assets/wees-logo-red.png';

async function getRedLogoBase64(): Promise<string> {
  const res = await fetch(weesLogoRed);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface AIAnalysisMetadata {
  projectName?: string;
  startDate?: string;
  endDate?: string;
}

const COLORS = {
  primary: { r: 153, g: 25, b: 25 },
  dark: { r: 33, g: 33, b: 33 },
  muted: { r: 100, g: 100, b: 100 },
  light: { r: 240, g: 240, b: 240 },
  white: { r: 255, g: 255, b: 255 },
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_H = 18;
const FOOTER_Y = PAGE_HEIGHT - 12;

function addHeader(doc: jsPDF, logoBase64: string, pageNum: number) {
  const y = 10;
  try { doc.addImage(logoBase64, 'PNG', MARGIN, y, 20, 10); } catch { /* */ }
  doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE PRODUTIVIDADE', PAGE_WIDTH / 2, y + 6, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
  doc.text(`Pág: ${pageNum}`, PAGE_WIDTH - MARGIN, y + 6, { align: 'right' });
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 12, PAGE_WIDTH - MARGIN, y + 12);
  return y + HEADER_H;
}

function addFooter(doc: jsPDF) {
  doc.setFontSize(6);
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Documento gerado automaticamente por análise de inteligência artificial — WEES Engenharia.',
    PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' }
  );
}

function newPage(doc: jsPDF, logoBase64: string, pc: { count: number }) {
  addFooter(doc);
  doc.addPage();
  pc.count++;
  return addHeader(doc, logoBase64, pc.count);
}

function checkBreak(doc: jsPDF, y: number, needed: number, logo: string, pc: { count: number }) {
  if (y + needed > FOOTER_Y - 5) return newPage(doc, logo, pc);
  return y;
}

interface ParsedLine {
  type: 'h2' | 'h3' | 'bullet' | 'numbered' | 'paragraph';
  text: string;
}

function parseMarkdown(text: string): ParsedLine[] {
  const lines = text.split('\n');
  const result: ParsedLine[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('## ')) {
      result.push({ type: 'h2', text: trimmed.replace(/^##\s+/, '') });
    } else if (trimmed.startsWith('### ')) {
      result.push({ type: 'h3', text: trimmed.replace(/^###\s+/, '') });
    } else if (trimmed.startsWith('# ')) {
      result.push({ type: 'h2', text: trimmed.replace(/^#\s+/, '') });
    } else if (/^[-*]\s/.test(trimmed)) {
      result.push({ type: 'bullet', text: trimmed.replace(/^[-*]\s+/, '') });
    } else if (/^\d+\.\s/.test(trimmed)) {
      result.push({ type: 'numbered', text: trimmed.replace(/^\d+\.\s+/, '') });
    } else {
      result.push({ type: 'paragraph', text: trimmed });
    }
  }
  return result;
}

function renderTextWithBold(doc: jsPDF, text: string, x: number, y: number, maxW: number) {
  // Split by **bold** markers and render segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  let cx = x;
  for (const part of parts) {
    if (!part) continue;
    const isBold = part.startsWith('**') && part.endsWith('**');
    const clean = isBold ? part.slice(2, -2) : part;
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const w = doc.getTextWidth(clean);
    if (cx + w > x + maxW) {
      // Just print; jsPDF will clip but this handles most cases
      doc.text(clean, cx, y);
      cx += w;
    } else {
      doc.text(clean, cx, y);
      cx += w;
    }
  }
}

export async function generateAIAnalysisPdf(analysisText: string, meta: AIAnalysisMetadata = {}): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const systemLogo = await getLogoBase64();
  const redLogo = await getRedLogoBase64();
  const logo = systemLogo || redLogo;
  const pc = { count: 1 };

  // ===== COVER =====
  doc.setFillColor(COLORS.light.r, COLORS.light.g, COLORS.light.b);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  try { doc.addImage(logo, 'PNG', PAGE_WIDTH / 2 - 15, 50, 30, 15); } catch { /* */ }

  doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE PRODUTIVIDADE', PAGE_WIDTH / 2, 90, { align: 'center' });
  doc.setFontSize(13);
  doc.text('ANÁLISE DE INTELIGÊNCIA ARTIFICIAL', PAGE_WIDTH / 2, 100, { align: 'center' });

  doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.rect(PAGE_WIDTH / 2 - 20, 106, 40, 1, 'F');

  if (meta.projectName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
    doc.text(meta.projectName, PAGE_WIDTH / 2, 125, { align: 'center' });
  }

  if (meta.startDate || meta.endDate) {
    doc.setFontSize(10);
    const period = [meta.startDate, meta.endDate].filter(Boolean).join(' a ');
    doc.text(`Período: ${period}`, PAGE_WIDTH / 2, 140, { align: 'center' });
  }

  doc.setFontSize(8);
  doc.setTextColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(today, PAGE_WIDTH / 2, 270, { align: 'center' });

  // ===== CONTENT =====
  doc.addPage();
  pc.count++;
  let y = addHeader(doc, logo, pc.count);

  const parsed = parseMarkdown(analysisText);

  for (const line of parsed) {
    switch (line.type) {
      case 'h2': {
        y = checkBreak(doc, y, 14, logo, pc);
        y += 4;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
        doc.text(line.text.replace(/\*\*/g, ''), MARGIN, y + 5);
        y += 8;
        doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, y, MARGIN + 60, y);
        y += 4;
        break;
      }
      case 'h3': {
        y = checkBreak(doc, y, 10, logo, pc);
        y += 2;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
        doc.text(line.text.replace(/\*\*/g, ''), MARGIN, y + 4);
        y += 8;
        break;
      }
      case 'bullet':
      case 'numbered': {
        doc.setFontSize(9);
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
        const prefix = line.type === 'bullet' ? '•' : '—';
        const bulletText = `${prefix}  ${line.text.replace(/\*\*/g, '')}`;
        const wrapped = doc.splitTextToSize(bulletText, CONTENT_WIDTH - 6);
        for (const wl of wrapped) {
          y = checkBreak(doc, y, 5, logo, pc);
          doc.setFont('helvetica', 'normal');
          doc.text(wl, MARGIN + 4, y + 4);
          y += 5;
        }
        break;
      }
      case 'paragraph': {
        doc.setFontSize(9);
        doc.setTextColor(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
        const clean = line.text.replace(/\*\*/g, '');
        const pLines = doc.splitTextToSize(clean, CONTENT_WIDTH);
        for (const pl of pLines) {
          y = checkBreak(doc, y, 5, logo, pc);
          doc.setFont('helvetica', 'normal');
          doc.text(pl, MARGIN, y + 4);
          y += 5;
        }
        y += 2;
        break;
      }
    }
  }

  addFooter(doc);
  return doc;
}
