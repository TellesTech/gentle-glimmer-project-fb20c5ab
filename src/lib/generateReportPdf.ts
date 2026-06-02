import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatRdoNumber } from './formatters';
import type { Report, Company, Site, Project } from '@/types';
import { getLogoBase64 } from './logoBase64';
import { supabase } from '@/integrations/supabase/client';

// === LABELS (com acentos - jsPDF suporta UTF-8) ===
const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

const DEVIATION_TYPE_LABELS: Record<string, string> = {
  delay: 'Atraso',
  equipment: 'Equipamento',
  safety: 'Segurança',
  other: 'Outro',
  weather: 'Clima',
  materials: 'Materiais',
  labor: 'Mão de Obra',
  stoppage: 'Paralisação',
  contractor: 'Contratada',
  supplier: 'Fornecedor',
  project_design: 'Projeto',
  planning: 'Planejamento',
  execution: 'Execução',
};

const IMPACT_LABELS: Record<string, string> = {
  low: 'BAIXO',
  medium: 'MÉDIO',
  high: 'ALTO',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'RASCUNHO',
  completed: 'CONCLUÍDO',
  sent: 'ENVIADO',
  signed: 'ASSINADO',
  finalized: 'FINALIZADO',
};

// === PALETA DE CORES (Bordeaux/Preto) ===
interface RGB {
  r: number;
  g: number;
  b: number;
}

const COLORS: Record<string, RGB> = {
  // Cor principal - Bordeaux (vermelho escuro)
  primaryDefault: { r: 153, g: 25, b: 25 },
  // Cor de destaque - Preto (substitui amarelo)
  accentDark: { r: 30, g: 30, b: 30 },
  darkGray: { r: 45, g: 45, b: 45 },
  mediumGray: { r: 128, g: 128, b: 128 },
  lightGray: { r: 240, g: 240, b: 240 },
  white: { r: 255, g: 255, b: 255 },
  text: { r: 33, g: 33, b: 33 },
  textMuted: { r: 100, g: 100, b: 100 },
  border: { r: 200, g: 200, b: 200 },
};

// === HELPER: Carregar imagem como Base64 ===
async function loadImageAsBase64(storedUrl: string): Promise<string | null> {
  try {
    let finalUrl = storedUrl;
    
    // Check if it's a public URL (contains /object/public/)
    const isPublicUrl = storedUrl.includes('/object/public/');
    
    // Determine which bucket to use based on URL
    const isSystemSettings = storedUrl.includes('system-settings');
    const isCompanyPhotos = storedUrl.includes('company-photos');
    const isLegacyReportPhotos = storedUrl.includes('/report-photos/');
    const bucketName = isSystemSettings
      ? 'system-settings'
      : (isCompanyPhotos ? 'company-photos' : (isLegacyReportPhotos ? 'report-photos' : 'service-report-photos'));
    
    if (!storedUrl.startsWith('http')) {
      // It's a path, create signed URL
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storedUrl, 3600);
      
      if (error || !data?.signedUrl) return null;
      finalUrl = data.signedUrl;
    } else if (isPublicUrl) {
      // Public URLs can be used directly
      finalUrl = storedUrl;
    } else if (storedUrl.includes(bucketName)) {
      // It's a private URL, extract path and create signed URL
      const pathMatch = storedUrl.match(new RegExp(`${bucketName}/([^?]+)`));
      if (pathMatch) {
        const path = decodeURIComponent(pathMatch[1]);
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) finalUrl = data.signedUrl;
      }
    }
    
    const response = await fetch(finalUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Função de preparação de texto - mantém acentos (jsPDF suporta UTF-8)
const prepareText = (str: string): string => {
  if (!str) return '';
  return str;
};

// === HELPER: Obter dimensoes da imagem ===
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      resolve({ width: 1, height: 1 }); // fallback 1:1
    };
    img.src = base64;
  });
}

// === HELPER: Ajustar imagem ao box mantendo proporcao ===
function fitImageToBox(
  imgWidth: number,
  imgHeight: number,
  boxWidth: number,
  boxHeight: number
): { width: number; height: number; offsetX: number; offsetY: number } {
  const imgRatio = imgWidth / imgHeight;
  const boxRatio = boxWidth / boxHeight;

  let finalWidth: number;
  let finalHeight: number;

  if (imgRatio > boxRatio) {
    // Imagem mais larga - ajustar pela largura
    finalWidth = boxWidth;
    finalHeight = boxWidth / imgRatio;
  } else {
    // Imagem mais alta - ajustar pela altura
    finalHeight = boxHeight;
    finalWidth = boxHeight * imgRatio;
  }

  // Centralizar no box
  const offsetX = (boxWidth - finalWidth) / 2;
  const offsetY = (boxHeight - finalHeight) / 2;

  return { width: finalWidth, height: finalHeight, offsetX, offsetY };
}

// Define interface for signatures
interface Signature {
  id: string;
  signerName: string;
  signerRole?: string;
  signatureData: string;
  signedAt: string;
  ipAddress?: string;
}

// Interface for tenant colors
export interface TenantColors {
  primary_color?: string | null;
  accent_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  pdf_logo_url?: string | null;
}

// Interface for PDF generation options
export interface PdfOptions {
  includeSignatureFields?: boolean;
  signatureFieldLabels?: string[];
}

// Helper: Convert hex to RGB
function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  return COLORS.primaryDefault; // fallback
}

// === FUNCAO INTERNA: Constroi o documento PDF (usado por ambas as funcoes) ===
async function buildReportPdfDoc(
  report: Report,
  company: Company,
  site: Site,
  project: Project,
  signatures?: Signature[],
  tenantColors?: TenantColors,
  pdfOptions?: PdfOptions
): Promise<{ doc: jsPDF; rdoCode: string; rdoFileName: string }> {
  // Use tenant colors if provided, otherwise fallback to defaults
  const primaryColor = tenantColors?.primary_color 
    ? hexToRgb(tenantColors.primary_color) 
    : COLORS.primaryDefault;
  const accentColor = tenantColors?.accent_color 
    ? hexToRgb(tenantColors.accent_color) 
    : COLORS.accentDark;
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 30;
  const footerHeight = 16;
  
  let y = headerHeight + 8;
  
  const reportDate = typeof report.date === 'string' ? parseISO(report.date) : report.date;
  const rdoNumber = formatRdoNumber((report as any).rdoNumber ?? (report as any).rdo_number ?? 1);
  const rdoCode = `${company.name} - RDO No ${rdoNumber} - ${format(reportDate, 'dd/MM/yyyy')}`;
  const rdoFileName = `RDO - ${rdoNumber} - ${company.name} - ${format(reportDate, 'dd-MM-yyyy')}`;
  
  // Load logo: prefer PDF-specific logo > main logo > default fallback
  let logoBase64: string | null = null;
  
  // 1. Try PDF-specific logo first (for header)
  if (tenantColors?.pdf_logo_url) {
    logoBase64 = await loadImageAsBase64(tenantColors.pdf_logo_url);
  }
  
  // 2. Fallback to main logo for header
  if (!logoBase64 && tenantColors?.logo_url) {
    logoBase64 = await loadImageAsBase64(tenantColors.logo_url);
  }
  
  // 3. Final fallback to default logo for header
  if (!logoBase64) {
    logoBase64 = await getLogoBase64();
  }
  
  // Load main logo separately for footer (logo_url takes priority)
  let mainLogoBase64: string | null = null;
  if (tenantColors?.logo_url) {
    mainLogoBase64 = await loadImageAsBase64(tenantColors.logo_url);
  }
  if (!mainLogoBase64) {
    mainLogoBase64 = await getLogoBase64();
  }
  
  // === HELPERS ===
  const setColor = (color: RGB) => doc.setTextColor(color.r, color.g, color.b);
  const setFillColor = (color: RGB) => doc.setFillColor(color.r, color.g, color.b);
  const setDrawColor = (color: RGB) => doc.setDrawColor(color.r, color.g, color.b);
  
  const checkPageBreak = (neededHeight: number): boolean => {
    if (y + neededHeight > pageHeight - footerHeight - 10) {
      doc.addPage();
      y = headerHeight + 8;
      return true;
    }
    return false;
  };
  
  // === HEADER (usando cores do tenant) ===
  const addHeader = async () => {
    setFillColor(primaryColor);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    
    // Configurações do grid
    const col1Width = 45; // Coluna do logo
    const col3Width = 45; // Coluna do status
    const col2Start = margin + col1Width;
    const col3Start = pageWidth - margin - col3Width;
    const dividerY = headerHeight - 8; // Linha horizontal
    
    // Linhas do grid (brancas)
    setDrawColor(COLORS.white);
    doc.setLineWidth(0.3);
    
    // Linha vertical 1 (após logo)
    doc.line(col2Start, 2, col2Start, dividerY);
    
    // Linha vertical 2 (antes do status)
    doc.line(col3Start, 2, col3Start, dividerY);
    
    // Linha horizontal (separando área superior da inferior)
    doc.line(margin, dividerY, pageWidth - margin, dividerY);
    
    // === COLUNA 1: Logo/Empresa ===
    const logoBoxWidth = col1Width - 6;
    const logoBoxHeight = 14;
    const logoX = margin + 3;
    const logoY = 3;
    
    let logoRendered = false;
    
    if (logoBase64) {
      try {
        // Get image dimensions to maintain aspect ratio
        const dims = await getImageDimensions(logoBase64);
        const fitted = fitImageToBox(dims.width, dims.height, logoBoxWidth, logoBoxHeight);
        
        // Render logo centered in column 1
        doc.addImage(
          logoBase64,
          'PNG',
          logoX + fitted.offsetX,
          logoY + fitted.offsetY,
          fitted.width,
          fitted.height
        );
        logoRendered = true;
      } catch (e) {
        console.error('Error rendering logo in PDF:', e);
        logoRendered = false;
      }
    }
    
    // Fallback to text if logo not available or failed
    if (!logoRendered) {
      setColor(COLORS.white);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const companyShortName = prepareText(company.name || 'RDO').substring(0, 12);
      doc.text(companyShortName, margin + col1Width / 2, 10, { align: 'center' });
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('Gestão de Atividades', margin + col1Width / 2, 14, { align: 'center' });
    }
    
    // === COLUNA 2: Título + Código RDO ===
    const col2Center = col2Start + (col3Start - col2Start) / 2;
    
    setColor(COLORS.white);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DIÁRIO DE ATIVIDADE', col2Center, 8, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.text(rdoCode, col2Center, 13, { align: 'center' });
    
    // === COLUNA 3: Status + Data ===
    const col3Center = col3Start + col3Width / 2;
    
    // Badge Status — força "ASSINADO" se houver qualquer assinatura registrada
    // ou status final, alinhando com a regra do portal do cliente.
    const hasSignedSignature = Array.isArray(signatures)
      && signatures.some((s: any) => s && s.signedAt);
    const isEffectivelySigned =
      report.status === 'signed'
      || report.status === 'finalized'
      || hasSignedSignature;
    const statusLabel = isEffectivelySigned
      ? 'ASSINADO'
      : (STATUS_LABELS[report.status] || 'RASCUNHO');
    const badgeWidth = 24;
    const badgeX = col3Center - badgeWidth / 2;
    setFillColor(accentColor);
    doc.roundedRect(badgeX, 4, badgeWidth, 6, 1, 1, 'F');
    setColor(COLORS.white);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel, col3Center, 8, { align: 'center' });
    
    // Data abaixo do badge
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(format(reportDate, 'dd/MM/yyyy'), col3Center, 14, { align: 'center' });
    
    // === LINHA INFERIOR: Info do projeto (largura total) ===
    setColor(COLORS.white);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const projectInfo = `${prepareText(company.name)} | ${prepareText(site.name)} | ${prepareText(project.name)}`;
    doc.text(projectInfo, pageWidth / 2, headerHeight - 3, { align: 'center' });
  };
  
  // === FOOTER INSTITUCIONAL ===
  const addFooter = async (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - footerHeight;
    
    setDrawColor(COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    // === COLUNA ESQUERDA: Info da empresa ===
    doc.setFontSize(7);
    setColor(COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text(prepareText(company.name || 'Empresa'), margin, footerY + 5);
    
    setColor(COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(company.email || '', margin, footerY + 9);
    
    // === COLUNA CENTRO: Logo (usa logo principal, não a do PDF) ===
    if (mainLogoBase64) {
      try {
        const dims = await getImageDimensions(mainLogoBase64);
        const logoMaxWidth = 25;
        const logoMaxHeight = 8;
        const fitted = fitImageToBox(dims.width, dims.height, logoMaxWidth, logoMaxHeight);
        
        const logoXPos = (pageWidth / 2) - (fitted.width / 2);
        const logoYPos = footerY + 2;
        
        doc.addImage(
          mainLogoBase64,
          'PNG',
          logoXPos,
          logoYPos,
          fitted.width,
          fitted.height
        );
      } catch (e) {
        console.error('Error rendering logo in footer:', e);
      }
    }
    
    // === COLUNA DIREITA: Paginação e data ===
    setColor(COLORS.text);
    doc.setFontSize(7);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, footerY + 5, { align: 'right' });
    doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), pageWidth - margin, footerY + 9, { align: 'right' });
    
    // === LINHA INFERIOR: Texto institucional ===
    doc.setFontSize(6);
    setColor(COLORS.textMuted);
    doc.text('Documento gerado automaticamente pelo sistema', pageWidth / 2, footerY + 13, { align: 'center' });
  };
  
  // === TITULO DE SECAO ===
  const drawSectionTitle = (title: string, badge?: string) => {
    checkPageBreak(14);
    
    // Barra usando cor primária do tenant
    setFillColor(primaryColor);
    doc.rect(margin, y, 2, 7, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setColor(primaryColor);
    doc.text(prepareText(title.toUpperCase()), margin + 5, y + 5);
    
    if (badge) {
      const badgeWidth = doc.getTextWidth(badge) + 6;
      const badgeX = pageWidth - margin - badgeWidth;
      setFillColor(COLORS.lightGray);
      doc.roundedRect(badgeX, y + 1, badgeWidth, 5, 1, 1, 'F');
      setColor(COLORS.textMuted);
      doc.setFontSize(6);
      doc.text(badge, badgeX + badgeWidth / 2, y + 4.5, { align: 'center' });
    }
    
    y += 10;
  };
  
  // === LINHA SEPARADORA ===
  const drawSeparator = () => {
    setDrawColor(COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(margin + 3, y, pageWidth - margin - 3, y);
    y += 3;
  };
  
  // === INFORMACOES GERAIS ===
  drawSectionTitle('Informações Gerais');
  
  const infoData = [
    ['Fábrica:', prepareText(company.name), 'Unidade:', prepareText(site.name)],
    ['Atividade:', prepareText(project.name), 'Local:', prepareText(report.activityLocation || 'N/A')],
    ['Data:', format(reportDate, 'dd/MM/yyyy'), 'Turno:', SHIFT_LABELS[report.shift] || report.shift],
    ['Horário:', `${report.startTime || '--:--'} às ${report.endTime || '--:--'}`, 'Contrato:', prepareText(report.contractNumber || 'N/A')],
  ];

  if ((report as any).maintenanceOrderNumber) {
    infoData.push(['Nº OM:', prepareText((report as any).maintenanceOrderNumber), '', '']);
  }
  
  // Calcular altura total do box com responsáveis
  const hasResponsibles = report.technicalResponsibleName || report.supervisorName;
  const baseHeight = infoData.length * 6 + 4;
  const responsiblesHeight = hasResponsibles ? 18 : 0;
  const totalBoxHeight = baseHeight + responsiblesHeight;
  
  setFillColor(COLORS.lightGray);
  doc.roundedRect(margin, y, contentWidth, totalBoxHeight, 2, 2, 'F');
  
  y += 4;
  infoData.forEach((row) => {
    const col1X = margin + 3;
    const col2X = margin + 22;
    const col3X = margin + contentWidth / 2;
    const col4X = margin + contentWidth / 2 + 20;
    
    doc.setFontSize(7);
    setColor(COLORS.textMuted);
    doc.setFont('helvetica', 'bold');
    doc.text(row[0], col1X, y);
    if (row[2]) doc.text(row[2], col3X, y);
    
    setColor(COLORS.text);
    doc.setFont('helvetica', 'normal');
    doc.text(row[1], col2X, y);
    if (row[3]) doc.text(row[3], col4X, y);
    
    y += 6;
  });
  
  // === RESPONSÁVEIS (se existirem) ===
  if (hasResponsibles) {
    y += 2;
    
    // Linha separadora
    setDrawColor(COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(margin + 3, y, margin + contentWidth - 3, y);
    y += 4;
    
    // Responsável Técnico
    if (report.technicalResponsibleName) {
      doc.setFontSize(7);
      setColor(COLORS.textMuted);
      doc.setFont('helvetica', 'bold');
      doc.text('Resp. Técnico:', margin + 3, y);
      setColor(COLORS.text);
      doc.setFont('helvetica', 'normal');
      const techResp = report.technicalResponsibleRole 
        ? `${prepareText(report.technicalResponsibleName)} - ${prepareText(report.technicalResponsibleRole)}`
        : prepareText(report.technicalResponsibleName);
      doc.text(techResp, margin + 28, y);
    }
    
    // Supervisor
    if (report.supervisorName) {
      const supervisorX = report.technicalResponsibleName ? margin + contentWidth / 2 : margin + 3;
      doc.setFontSize(7);
      setColor(COLORS.textMuted);
      doc.setFont('helvetica', 'bold');
      doc.text('Supervisor:', supervisorX, y);
      setColor(COLORS.text);
      doc.setFont('helvetica', 'normal');
      const supervisor = report.supervisorRole 
        ? `${prepareText(report.supervisorName)} - ${prepareText(report.supervisorRole)}`
        : prepareText(report.supervisorName);
      doc.text(supervisor, supervisorX + 20, y);
    }
    
    y += 6;
  }
  
  y += 8;
  
  // === SEGURANÇA E COMUNICAÇÃO ===
  const hasSafetyInfo = report.ambulancePoint || report.meetingPoint || report.radioFrequencyWees || report.radioFrequencyOperation || report.arrivalTimeAtLiberator || report.documentReleaseTime || report.blockRevalidationTime;
  
  if (hasSafetyInfo) {
    drawSectionTitle('Segurança e Comunicação');
    
    const safetyItems = [
      { label: 'Ponto de Ambulância:', value: report.ambulancePoint },
      { label: 'Ponto de Encontro:', value: report.meetingPoint },
      { label: 'Frequência Rádio Empresa:', value: report.radioFrequencyWees },
      { label: 'Frequência Rádio Operação:', value: report.radioFrequencyOperation },
      { label: 'Chegada no Liberador:', value: report.arrivalTimeAtLiberator },
      { label: 'Liberação Documentação:', value: report.documentReleaseTime },
      { label: 'Revalidação Bloqueio:', value: report.blockRevalidationTime },
    ].filter(item => item.value);
    
    safetyItems.forEach((item) => {
      doc.setFontSize(7);
      setColor(COLORS.textMuted);
      doc.setFont('helvetica', 'bold');
      doc.text(item.label, margin + 3, y);
      setColor(COLORS.text);
      doc.setFont('helvetica', 'normal');
      doc.text(prepareText(item.value || ''), margin + 48, y);
      y += 5;
    });
    
    y += 8;
  }
  
  // === EFETIVO E PRODUTIVIDADE ===
  const hasWorkforceInfo = report.plannedWorkforce !== undefined || report.actualWorkforce !== undefined;
  
  if (hasWorkforceInfo) {
    drawSectionTitle('Efetivo e Produtividade');
    
    const planned = report.plannedWorkforce ?? 0;
    const actual = report.actualWorkforce ?? 0;
    const generalPercentage = planned > 0 ? Math.round((actual / planned) * 100) : 0;
    const realPercentage = report.realPercentage ?? generalPercentage;
    const isUnderStaffed = actual < planned;
    
    // Cards de métricas
    const cardWidth = (contentWidth - 12) / 4;
    const cardHeight = 20;
    const cardY = y;
    
    const metrics = [
      { label: 'PROGRAMADO', value: planned.toString(), color: COLORS.mediumGray },
      { label: 'PRESENTE', value: actual.toString(), color: isUnderStaffed ? primaryColor : COLORS.text },
      { label: '% GERAL', value: `${generalPercentage}%`, color: generalPercentage < 80 ? primaryColor : COLORS.text },
      { label: '% REAL', value: `${realPercentage}%`, color: COLORS.text },
    ];
    
    metrics.forEach((metric, index) => {
      const cardX = margin + index * (cardWidth + 4);
      
      // Fundo do card
      setFillColor(COLORS.lightGray);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'F');
      
      // Label
      doc.setFontSize(6);
      setColor(COLORS.textMuted);
      doc.setFont('helvetica', 'bold');
      doc.text(metric.label, cardX + cardWidth / 2, cardY + 6, { align: 'center' });
      
      // Valor
      doc.setFontSize(12);
      setColor(metric.color);
      doc.setFont('helvetica', 'bold');
      doc.text(metric.value, cardX + cardWidth / 2, cardY + 15, { align: 'center' });
    });
    
    y += cardHeight + 4;
    
    // Alerta se efetivo abaixo do programado
    if (isUnderStaffed) {
      setFillColor({ r: 254, g: 249, b: 195 }); // Amarelo claro
      doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
      
      doc.setFontSize(7);
      setColor(primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('⚠ Efetivo abaixo do programado', margin + 4, y + 5);
      
      y += 12;
    }
    
    y += 8;
  }
  
  // === ATIVIDADES EXECUTADAS ===
  if (report.activities && report.activities.length > 0) {
    const completedCount = report.activities.filter(a => a.completed).length;
    
    drawSectionTitle('Atividades Executadas', `${completedCount}/${report.activities.length} concluídas`);
    
    report.activities.forEach((activity, index) => {
      checkPageBreak(10);
      
      const bullet = activity.completed ? '[X]' : '[ ]';
      
      doc.setFontSize(8);
      setColor(activity.completed ? COLORS.text : COLORS.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(bullet, margin + 3, y);
      
      const lines = doc.splitTextToSize(prepareText(activity.description), contentWidth - 18);
      doc.text(lines, margin + 14, y);
      
      y += lines.length * 4 + 2;
      
      if (index < report.activities.length - 1) {
        drawSeparator();
      }
    });
    
    y += 8;
  }

  // === ROTINA ===
  const routineText = (report as any).routine;
  if (routineText) {
    // Preparar texto
    doc.setFontSize(8);
    doc.setFont('Roboto', 'normal');
    const routineLines = doc.splitTextToSize(prepareText(routineText), contentWidth - 12);
    
    // Calcular altura da caixa
    const lineHeightMm = doc.getLineHeight() / doc.internal.scaleFactor;
    const boxHeight = Math.max(routineLines.length * lineHeightMm + 12, 14);
    
    // Verificar page break
    checkPageBreak(12 + 2 + boxHeight + 8);
    
    drawSectionTitle('Rotina');
    
    const boxY = y;
    
    // Desenhar caixa de fundo
    setFillColor(COLORS.lightGray);
    setDrawColor(COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxY, contentWidth, boxHeight, 2, 2, 'FD');
    
    // Renderizar texto
    setColor(COLORS.text);
    doc.setFontSize(8);
    doc.setFont('Roboto', 'normal');
    doc.text(routineLines, margin + 6, boxY + 7);
    
    y = boxY + boxHeight + 8;
  }
  
  // === DESVIOS / SEGURANÇA ===
  if (report.deviations && report.deviations.length > 0) {
    drawSectionTitle('Desvios / Segurança', `${report.deviations.length} desvio${report.deviations.length > 1 ? 's' : ''}`);
    
    report.deviations.forEach((deviation) => {
      const impact = deviation.impact || 'low';
      const isHighImpact = impact === 'high';
      
      // Preparar texto com quebra de linhas
      doc.setFontSize(7);
      const descText = prepareText(deviation.description);
      const descLines = doc.splitTextToSize(descText, contentWidth - 14);
      
      let actionLines: string[] = [];
      if (deviation.correctiveAction) {
        doc.setFontSize(6);
        const actionText = prepareText(deviation.correctiveAction);
        actionLines = doc.splitTextToSize(actionText, contentWidth - 14);
      }
      
      // Calcular altura dinamicamente
      const descHeight = descLines.length * 3.5;
      const actionHeight = actionLines.length > 0 ? (actionLines.length * 3 + 6) : 0;
      const cardHeight = 10 + descHeight + actionHeight;
      
      checkPageBreak(cardHeight + 5);
      
      // Card com borda usando cor primária se alto impacto
      setDrawColor(isHighImpact ? primaryColor : COLORS.border);
      doc.setLineWidth(isHighImpact ? 1 : 0.5);
      setFillColor(COLORS.lightGray);
      doc.roundedRect(margin + 2, y, contentWidth - 4, cardHeight, 2, 2, 'FD');
      
      // Badge impacto
      setFillColor(isHighImpact ? accentColor : COLORS.mediumGray);
      doc.roundedRect(margin + 5, y + 2, 12, 4, 1, 1, 'F');
      setColor(COLORS.white);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      doc.text(IMPACT_LABELS[impact], margin + 11, y + 4.8, { align: 'center' });
      
      // Badge tipo
      const typeLabel = DEVIATION_TYPE_LABELS[deviation.type] || deviation.type;
      setFillColor(COLORS.border);
      doc.roundedRect(margin + 19, y + 2, 16, 4, 1, 1, 'F');
      setColor(COLORS.text);
      doc.text(prepareText(typeLabel.toUpperCase()), margin + 27, y + 4.8, { align: 'center' });
      
      // Descrição (múltiplas linhas)
      setColor(COLORS.text);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(descLines, margin + 5, y + 10);
      
      // Ação corretiva (múltiplas linhas)
      if (deviation.correctiveAction && actionLines.length > 0) {
        const actionY = y + 10 + descHeight + 2;
        doc.setFontSize(6);
        setColor(COLORS.textMuted);
        doc.setFont('helvetica', 'bold');
        doc.text('Ação Corretiva:', margin + 5, actionY);
        setColor(COLORS.text);
        doc.setFont('helvetica', 'normal');
        doc.text(actionLines, margin + 5, actionY + 4);
      }
      
      y += cardHeight + 4;
    });
    
    y += 8;
  }
  
  // === EFETIVO (Tabela com Função e Horário) ===
  if (report.attendance && report.attendance.length > 0) {
    const presentCount = report.attendance.filter(a => a.present).length;
    
    drawSectionTitle('Efetivo', `${presentCount}/${report.attendance.length} presentes`);
    
    // Cabeçalho tabela
    setFillColor(COLORS.darkGray);
    doc.roundedRect(margin, y, contentWidth, 6, 1, 1, 'F');
    setColor(COLORS.white);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    
    // Posições das colunas: Nome | Função | Horário
    const colName = margin + 5;
    const colFunction = margin + contentWidth * 0.38;
    const colTime = margin + contentWidth * 0.68;
    
    doc.text('Nome', colName, y + 4);
    doc.text('Função', colFunction, y + 4);
    doc.text('Horário', colTime, y + 4);
    y += 8;
    
    report.attendance.forEach((person, index) => {
      checkPageBreak(7);
      
      if (index % 2 === 0) {
        setFillColor(COLORS.lightGray);
        doc.rect(margin, y - 1, contentWidth, 6, 'F');
      }
      
      doc.setFontSize(7);
      setColor(COLORS.text);
      doc.setFont('helvetica', 'normal');
      
      // Nome
      const name = prepareText(person.userName).slice(0, 25);
      doc.text(name, colName, y + 3);
      
      // Função
      const functionRole = prepareText((person as any).functionRole || '-').slice(0, 25);
      doc.text(functionRole, colFunction, y + 3);
      
      // Horário formatado (Entrada - Saída)
      let timeStr = '-';
      if (person.present) {
        const arrival = person.arrivalTime || '--:--';
        const departure = person.departureTime || '--:--';
        if (person.arrivalTime || person.departureTime) {
          timeStr = `${arrival} - ${departure}`;
        }
      }
      setColor(COLORS.text);
      doc.text(timeStr, colTime, y + 3);
      
      y += 6;
    });
    
    y += 8;
  }
  
  // === OBSERVAÇÕES (com Resumo unificado) ===
  const aiSummaryText = (report as any).ai_summary || (report as any).aiSummary;
  const hasComments = !!report.comments;
  const hasAiSummary = !!aiSummaryText;
  
  if (hasComments || hasAiSummary) {
    // Preparar textos
    const commentText = hasComments ? prepareText(report.comments!) : '';
    const aiText = hasAiSummary ? prepareText(aiSummaryText) : '';
    
    // Calcular linhas para observações
    doc.setFontSize(8);
    doc.setFont('Roboto', 'normal');
    const commentLines = hasComments ? doc.splitTextToSize(commentText, contentWidth - 12) : [];
    
    // Calcular linhas para resumo (com label "Resumo:")
    doc.setFont('Roboto', 'italic');
    const aiLines = hasAiSummary ? doc.splitTextToSize(aiText, contentWidth - 12) : [];
    
    // Calcular altura total da caixa
    const lineHeightMm = doc.getLineHeight() / doc.internal.scaleFactor;
    let totalLinesHeight = 0;
    
    if (hasComments) {
      totalLinesHeight += commentLines.length * lineHeightMm;
    }
    
    if (hasAiSummary) {
      // Adicionar espaço para "Resumo:" label + linhas do resumo
      if (hasComments) totalLinesHeight += 6; // Espaço entre observações e resumo
      totalLinesHeight += 5; // Altura do label "Resumo:"
      totalLinesHeight += aiLines.length * lineHeightMm;
    }
    
    const boxHeight = Math.max(totalLinesHeight + 12, 14);
    
    // Calcular altura total: título (12) + espaço (2) + caixa + margem (8)
    const totalHeight = 12 + 2 + boxHeight + 8;
    
    // Verificar page break ANTES do título para manter título e conteúdo juntos
    checkPageBreak(totalHeight);
    
    drawSectionTitle('Observações');
    
    const boxY = y;
    
    // Desenhar caixa de fundo
    setFillColor(COLORS.lightGray);
    setDrawColor(COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxY, contentWidth, boxHeight, 2, 2, 'FD');
    
    // Posição inicial do texto
    let textY = boxY + 7;
    
    // Renderizar observações normais
    if (hasComments) {
      setColor(COLORS.text);
      doc.setFontSize(8);
      doc.setFont('Roboto', 'normal');
      doc.text(commentLines, margin + 6, textY);
      textY += commentLines.length * lineHeightMm;
    }
    
    // Renderizar resumo com label
    if (hasAiSummary) {
      if (hasComments) textY += 4; // Espaço extra entre seções
      
      // Label "Resumo:" em negrito
      setColor(primaryColor);
      doc.setFontSize(8);
      doc.setFont('Roboto', 'bold');
      doc.text('Resumo:', margin + 6, textY);
      textY += 4;
      
      // Texto do resumo em itálico
      setColor(COLORS.text);
      doc.setFont('Roboto', 'italic');
      doc.text(aiLines, margin + 6, textY);
    }
    
    y = boxY + boxHeight + 8;
  }
  
  // === HISTÓRICO ===
  drawSectionTitle('Histórico');
  
  const timestamps = [
    { label: 'Criado por', value: report.createdByName, date: report.createdAt },
    report.approvedAt && { label: 'Concluído em', value: '', date: report.approvedAt },
  ].filter(Boolean) as { label: string; value?: string; date: Date }[];
  
  timestamps.forEach((item) => {
    checkPageBreak(6);
    
    doc.setFontSize(7);
    setColor(COLORS.text);
    doc.setFont('helvetica', 'normal');
    
    const dateStr = item.date ? format(new Date(item.date), 'dd/MM/yyyy HH:mm') : '';
    const text = item.value 
      ? `- ${item.label}: ${prepareText(item.value)} em ${dateStr}`
      : `- ${item.label} ${dateStr}`;
    doc.text(text, margin + 3, y);
    
    y += 5;
  });
  
  y += 5;
  
  // === REGISTRO FOTOGRÁFICO ===
  if (report.photos && report.photos.length > 0) {
    const photoWidth = (contentWidth - 8) / 2;
    const photoHeight = 65;
    const titleHeight = 14;
    const firstPhotoRowHeight = photoHeight + 10;
    
    // Verificar se título + primeira foto cabem na página atual
    // Se não couber, forçar quebra de página ANTES do título
    checkPageBreak(titleHeight + firstPhotoRowHeight);
    
    drawSectionTitle('Registro Fotográfico', `${report.photos.length} foto${report.photos.length > 1 ? 's' : ''}`);
    
    const loadedImages: (string | null)[] = await Promise.all(
      report.photos.map((photo) => loadImageAsBase64(photo.url))
    );
    
    for (let i = 0; i < report.photos.length; i++) {
      const col = i % 2;
      
      if (col === 0) {
        checkPageBreak(photoHeight + 10);
      }
      
      const x = margin + col * (photoWidth + 4);
      
      // Borda cinza
      setDrawColor(COLORS.border);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, photoWidth, photoHeight, 2, 2, 'S');
      
      const boxW = photoWidth - 2;
      const boxH = photoHeight - 12;
      
      // Fundo cinza claro para area da foto
      setFillColor(COLORS.lightGray);
      doc.rect(x + 1, y + 1, boxW, boxH, 'F');
      
      if (loadedImages[i]) {
        try {
          const imgDims = await getImageDimensions(loadedImages[i]!);
          const fitted = fitImageToBox(imgDims.width, imgDims.height, boxW, boxH);
          
          // Imagem centralizada com proporcao correta
          doc.addImage(
            loadedImages[i]!,
            'JPEG',
            x + 1 + fitted.offsetX,
            y + 1 + fitted.offsetY,
            fitted.width,
            fitted.height
          );
        } catch {
          setColor(COLORS.textMuted);
          doc.setFontSize(7);
          doc.text('Imagem indisponível', x + photoWidth / 2, y + photoHeight / 2 - 4, { align: 'center' });
        }
      } else {
        setColor(COLORS.textMuted);
        doc.setFontSize(7);
        doc.text('Carregando...', x + photoWidth / 2, y + photoHeight / 2 - 4, { align: 'center' });
      }
      
      // Legenda
      if (report.photos[i].description) {
        setFillColor(COLORS.lightGray);
        doc.rect(x, y + photoHeight - 10, photoWidth, 10, 'F');
        setColor(COLORS.text);
        doc.setFontSize(7);
        const caption = prepareText(report.photos[i].description!).slice(0, 50);
        doc.text(caption, x + 2, y + photoHeight - 3);
      }
      
      if (col === 1 || i === report.photos.length - 1) {
        y += photoHeight + 5;
      }
    }
  }
  
  // === ASSINATURAS DO CLIENTE (apenas manuais, não Autentique) ===
  const manualSignatures = (signatures || []).filter(
    sig => sig.signatureData && !sig.signatureData.startsWith('autentique:')
  );
  
  if (manualSignatures.length > 0) {
    drawSectionTitle('Assinaturas', `${manualSignatures.length} assinatura${manualSignatures.length > 1 ? 's' : ''}`);
    
    for (const sig of manualSignatures) {
      // Calcular altura necessária
      const sigBoxHeight = 35;
      checkPageBreak(sigBoxHeight + 8);
      
      // Box com borda usando cor primária
      setDrawColor(primaryColor);
      setFillColor(COLORS.lightGray);
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, contentWidth, sigBoxHeight, 2, 2, 'FD');
      
      // Área da assinatura (lado esquerdo)
      const sigAreaWidth = 70;
      const sigAreaHeight = sigBoxHeight - 8;
      
      // Fundo branco para assinatura
      setFillColor(COLORS.white);
      doc.rect(margin + 4, y + 4, sigAreaWidth, sigAreaHeight, 'F');
      
      // Tentar renderizar a imagem da assinatura
      if (sig.signatureData && sig.signatureData.startsWith('data:image')) {
        try {
          const imgDims = await getImageDimensions(sig.signatureData);
          const fitted = fitImageToBox(imgDims.width, imgDims.height, sigAreaWidth - 4, sigAreaHeight - 4);
          
          doc.addImage(
            sig.signatureData,
            'PNG',
            margin + 4 + 2 + fitted.offsetX,
            y + 4 + 2 + fitted.offsetY,
            fitted.width,
            fitted.height
          );
        } catch {
          // Se falhar, mostrar texto
          setColor(COLORS.textMuted);
          doc.setFontSize(7);
          doc.text('Assinatura digital', margin + 4 + sigAreaWidth / 2, y + 4 + sigAreaHeight / 2, { align: 'center' });
        }
      }
      
      // Informações do assinante (lado direito)
      const infoX = margin + sigAreaWidth + 12;
      let infoY = y + 8;
      
      setColor(COLORS.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(prepareText(sig.signerName), infoX, infoY);
      
      infoY += 5;
      
      if (sig.signerRole) {
        setColor(COLORS.textMuted);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(prepareText(sig.signerRole), infoX, infoY);
        infoY += 4;
      }
      
      // Data/hora
      if (sig.signedAt) {
        setColor(COLORS.textMuted);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const signedDate = format(new Date(sig.signedAt), 'dd/MM/yyyy HH:mm');
        doc.text(`Assinado em: ${signedDate}`, infoX, infoY);
        infoY += 4;
      }
      
      // IP (parcialmente mascarado)
      if (sig.ipAddress) {
        const maskedIp = sig.ipAddress.replace(/\.\d+\.\d+$/, '.xxx.xxx');
        doc.text(`IP: ${maskedIp}`, infoX, infoY);
      }
      
      y += sigBoxHeight + 5;
    }
    
    y += 5;
  }
  
  // === CAMPOS DE ASSINATURA EM BRANCO (para impressão) ===
  if (pdfOptions?.includeSignatureFields) {
    const labels = pdfOptions.signatureFieldLabels || [
      'Responsável pela Contratada',
      'Responsável pela Contratante'
    ];
    
    drawSectionTitle('Campos para Assinatura', `${labels.length} campo${labels.length > 1 ? 's' : ''}`);
    
    const sigFieldHeight = 45;
    const fieldWidth = (contentWidth - 10) / 2;
    
    // Verificar se cabe na página, senão quebra
    checkPageBreak(sigFieldHeight + 20);
    
    for (let i = 0; i < labels.length; i += 2) {
      const col1Label = labels[i];
      const col2Label = labels[i + 1];
      
      // Campo 1 (esquerda)
      if (col1Label) {
        // Box com borda
        setDrawColor(primaryColor);
        setFillColor(COLORS.white);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, fieldWidth, sigFieldHeight, 2, 2, 'FD');
        
        // Linha de assinatura
        const lineY = y + sigFieldHeight - 15;
        setDrawColor(COLORS.border);
        doc.setLineWidth(0.3);
        doc.line(margin + 5, lineY, margin + fieldWidth - 5, lineY);
        
        // Label abaixo da linha
        setColor(COLORS.textMuted);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(prepareText(col1Label), margin + fieldWidth / 2, lineY + 5, { align: 'center' });
        
        // "Nome:" e "Data:" acima da linha
        setColor(COLORS.text);
        doc.setFontSize(7);
        doc.text('Nome: ______________________________', margin + 5, y + 8);
        doc.text('Data: ____/____/________', margin + 5, y + 14);
      }
      
      // Campo 2 (direita)
      if (col2Label) {
        const x2 = margin + fieldWidth + 10;
        
        // Box com borda
        setDrawColor(primaryColor);
        setFillColor(COLORS.white);
        doc.setLineWidth(0.5);
        doc.roundedRect(x2, y, fieldWidth, sigFieldHeight, 2, 2, 'FD');
        
        // Linha de assinatura
        const lineY = y + sigFieldHeight - 15;
        setDrawColor(COLORS.border);
        doc.setLineWidth(0.3);
        doc.line(x2 + 5, lineY, x2 + fieldWidth - 5, lineY);
        
        // Label abaixo da linha
        setColor(COLORS.textMuted);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(prepareText(col2Label), x2 + fieldWidth / 2, lineY + 5, { align: 'center' });
        
        // "Nome:" e "Data:" acima da linha
        setColor(COLORS.text);
        doc.setFontSize(7);
        doc.text('Nome: ______________________________', x2 + 5, y + 8);
        doc.text('Data: ____/____/________', x2 + 5, y + 14);
      }
      
      y += sigFieldHeight + 8;
      
      // Verificar quebra de página entre linhas de campos
      if (i + 2 < labels.length) {
        checkPageBreak(sigFieldHeight + 8);
      }
    }
    
    y += 5;
  }
  
  // === APLICAR HEADERS E FOOTERS ===
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    await addHeader();
    await addFooter(i, totalPages);
  }
  
  return { doc, rdoCode, rdoFileName };
}

// === FUNCAO PRINCIPAL: Gera PDF e faz download ===
export async function generateReportPdf(
  report: Report,
  company: Company,
  site: Site,
  project: Project,
  signatures?: Signature[],
  tenantColors?: TenantColors,
  pdfOptions?: PdfOptions
): Promise<void> {
  const { doc, rdoFileName } = await buildReportPdfDoc(report, company, site, project, signatures, tenantColors, pdfOptions);
  doc.save(`${rdoFileName}.pdf`);
}

// === FUNCAO PARA GERAR PDF COMO BLOB (para envio ao Autentique) ===
export async function generateReportPdfAsBlob(
  report: Report,
  company: Company,
  site: Site,
  project: Project,
  signatures?: Signature[],
  tenantColors?: TenantColors,
  pdfOptions?: PdfOptions
): Promise<Blob> {
  const { doc } = await buildReportPdfDoc(report, company, site, project, signatures, tenantColors, pdfOptions);
  return doc.output('blob');
}
