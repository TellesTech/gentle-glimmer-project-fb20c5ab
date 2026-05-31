import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLogoBase64 } from './logoBase64';
import { supabase } from '@/integrations/supabase/client';

// Types for export data
export interface UserExportData {
  name: string;
  email: string;
  role: string;
  company_name?: string;
  created_at: string;
}

export interface ReportExportData {
  date: string;
  project_name: string;
  creator_name: string;
  status: string;
  shift: string;
  location?: string;
}

export interface CompanyExportData {
  name: string;
  cnpj?: string;
  city?: string;
  state?: string;
  sites_count: number;
  projects_count: number;
}

export interface SystemStats {
  totalUsers: number;
  totalReports: number;
  totalCompanies: number;
  totalSites: number;
  totalProjects: number;
  totalTeams: number;
  usersByRole: { role: string; count: number }[];
  reportsByStatus: { status: string; count: number }[];
}

// Save file to cloud storage
export async function saveToCloudStorage(
  content: Blob,
  filename: string
): Promise<{ url: string; path: string }> {
  const path = `exports/${Date.now()}_${filename}`;
  
  const { error } = await supabase.storage
    .from('admin-exports')
    .upload(path, content);
  
  if (error) throw error;
  
  const { data: urlData } = await supabase.storage
    .from('admin-exports')
    .createSignedUrl(path, 3600 * 24 * 7); // 7 days
  
  return { url: urlData?.signedUrl || '', path };
}

// Get CSV as Blob
export function getUsersCSVBlob(users: UserExportData[]): Blob {
  const headers = ['Nome', 'Email', 'Função', 'Fábrica', 'Data Cadastro'];
  const rows = users.map(user => [
    user.name || '',
    user.email || '',
    ROLE_LABELS[user.role] || user.role,
    user.company_name || '-',
    user.created_at ? formatDate(user.created_at) : '-',
  ]);
  const csv = generateCSV(headers, rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export function getReportsCSVBlob(reports: ReportExportData[]): Blob {
  const headers = ['Data', 'Atividade', 'Criador', 'Status', 'Turno', 'Local'];
  const rows = reports.map(report => [
    report.date ? formatDate(report.date) : '-',
    report.project_name || '-',
    report.creator_name || '-',
    STATUS_LABELS[report.status] || report.status,
    SHIFT_LABELS[report.shift] || report.shift,
    report.location || '-',
  ]);
  const csv = generateCSV(headers, rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export function getCompaniesCSVBlob(companies: CompanyExportData[]): Blob {
  const headers = ['Nome', 'CNPJ', 'Cidade', 'Estado', 'Unidades', 'Atividades'];
  const rows = companies.map(company => [
    company.name || '',
    company.cnpj || '-',
    company.city || '-',
    company.state || '-',
    company.sites_count.toString(),
    company.projects_count.toString(),
  ]);
  const csv = generateCSV(headers, rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// Get PDF as Blob
export async function getStatisticsPDFBlob(stats: SystemStats): Promise<Blob> {
  const doc = await generateStatisticsPDFDoc(stats);
  return doc.output('blob');
}

// Generate PDF document (shared logic)
async function generateStatisticsPDFDoc(stats: SystemStats): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;
  
  const primaryColor: [number, number, number] = [155, 28, 28];
  const textColor: [number, number, number] = [50, 50, 50];
  const lightGray: [number, number, number] = [240, 240, 240];
  
  const logo = await getLogoBase64();
  if (logo) {
    doc.addImage(logo, 'PNG', margin, yPos, 40, 15);
  }
  
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text('Estatísticas do Sistema', pageWidth / 2, yPos + 10, { align: 'center' });
  
  yPos += 30;
  
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  const generatedAt = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${generatedAt}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 20;
  
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('Resumo Geral', margin, yPos);
  yPos += 10;
  
  const statItems = [
    { label: 'Total de Usuários', value: stats.totalUsers },
    { label: 'Total de Relatórios', value: stats.totalReports },
    { label: 'Total de Fábricas', value: stats.totalCompanies },
    { label: 'Total de Unidades', value: stats.totalSites },
    { label: 'Total de Atividades', value: stats.totalProjects },
    { label: 'Total de Equipes', value: stats.totalTeams },
  ];
  
  const cardWidth = (pageWidth - 2 * margin - 10) / 2;
  const cardHeight = 25;
  
  statItems.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (cardWidth + 10);
    const y = yPos + row * (cardHeight + 5);
    
    doc.setFillColor(...lightGray);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text(item.label, x + 5, y + 10);
    
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text(item.value.toString(), x + 5, y + 20);
  });
  
  yPos += 3 * (cardHeight + 5) + 15;
  
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('Usuários por Função', margin, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  stats.usersByRole.forEach(item => {
    const label = ROLE_LABELS[item.role] || item.role;
    doc.text(`• ${label}: ${item.count}`, margin + 5, yPos);
    yPos += 6;
  });
  
  yPos += 10;
  
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('Relatórios por Status', margin, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  stats.reportsByStatus.forEach(item => {
    const label = STATUS_LABELS[item.status] || item.status;
    doc.text(`• ${label}: ${item.count}`, margin + 5, yPos);
    yPos += 6;
  });
  
  // Watermark
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setFontSize(60);
    doc.setTextColor(...primaryColor);
      doc.text('Sistema RDO', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Gerado pelo Sistema RDO', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  return doc;
}

export { getDateSuffix };

// Label mappings
const ROLE_LABELS: Record<string, string> = {
   admin: 'Administrador',
   collaborator: 'Operacional',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

// Helper to generate CSV with UTF-8 BOM for Excel compatibility
function generateCSV(headers: string[], rows: string[][]): string {
  const BOM = '\uFEFF';
  const escapeCell = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };
  
  const headerLine = headers.map(escapeCell).join(',');
  const dataLines = rows.map(row => row.map(escapeCell).join(','));
  
  return BOM + [headerLine, ...dataLines].join('\n');
}

// Helper to download a file
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Format date for display
function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// Get today's date for filename
function getDateSuffix(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// Export users to CSV
export function exportUsersToCSV(users: UserExportData[]) {
  const headers = ['Nome', 'Email', 'Função', 'Fábrica', 'Data Cadastro'];
  const rows = users.map(user => [
    user.name || '',
    user.email || '',
    ROLE_LABELS[user.role] || user.role,
    user.company_name || '-',
    user.created_at ? formatDate(user.created_at) : '-',
  ]);
  
  const csv = generateCSV(headers, rows);
  downloadFile(csv, `Usuarios_${getDateSuffix()}.csv`, 'text/csv;charset=utf-8');
}

// Export reports to CSV
export function exportReportsToCSV(reports: ReportExportData[]) {
  const headers = ['Data', 'Atividade', 'Criador', 'Status', 'Turno', 'Local'];
  const rows = reports.map(report => [
    report.date ? formatDate(report.date) : '-',
    report.project_name || '-',
    report.creator_name || '-',
    STATUS_LABELS[report.status] || report.status,
    SHIFT_LABELS[report.shift] || report.shift,
    report.location || '-',
  ]);
  
  const csv = generateCSV(headers, rows);
  downloadFile(csv, `Relatorios_${getDateSuffix()}.csv`, 'text/csv;charset=utf-8');
}

// Export companies to CSV
export function exportCompaniesToCSV(companies: CompanyExportData[]) {
  const headers = ['Nome', 'CNPJ', 'Cidade', 'Estado', 'Unidades', 'Atividades'];
  const rows = companies.map(company => [
    company.name || '',
    company.cnpj || '-',
    company.city || '-',
    company.state || '-',
    company.sites_count.toString(),
    company.projects_count.toString(),
  ]);
  
  const csv = generateCSV(headers, rows);
  downloadFile(csv, `Fabricas_${getDateSuffix()}.csv`, 'text/csv;charset=utf-8');
}

// Export system statistics to PDF
export async function exportStatisticsToPDF(stats: SystemStats) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;
  
  // Colors - WEES burgundy theme
  const primaryColor: [number, number, number] = [155, 28, 28];
  const textColor: [number, number, number] = [50, 50, 50];
  const lightGray: [number, number, number] = [240, 240, 240];
  
  // Add logo
  const logo = await getLogoBase64();
  if (logo) {
    doc.addImage(logo, 'PNG', margin, yPos, 40, 15);
  }
  
  // Title
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text('Estatísticas do Sistema', pageWidth / 2, yPos + 10, { align: 'center' });
  
  yPos += 30;
  
  // Generation date
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  const generatedAt = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${generatedAt}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 20;
  
  // Statistics cards section
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('Resumo Geral', margin, yPos);
  yPos += 10;
  
  // Draw stats grid (2x3)
  const statItems = [
    { label: 'Total de Usuários', value: stats.totalUsers },
    { label: 'Total de Relatórios', value: stats.totalReports },
    { label: 'Total de Fábricas', value: stats.totalCompanies },
    { label: 'Total de Unidades', value: stats.totalSites },
    { label: 'Total de Atividades', value: stats.totalProjects },
    { label: 'Total de Equipes', value: stats.totalTeams },
  ];
  
  const cardWidth = (pageWidth - 2 * margin - 10) / 2;
  const cardHeight = 25;
  
  statItems.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (cardWidth + 10);
    const y = yPos + row * (cardHeight + 5);
    
    // Card background
    doc.setFillColor(...lightGray);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
    
    // Card content
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text(item.label, x + 5, y + 10);
    
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text(item.value.toString(), x + 5, y + 20);
  });
  
  yPos += 3 * (cardHeight + 5) + 15;
  
  // Users by Role section
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('Usuários por Função', margin, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  stats.usersByRole.forEach(item => {
    const label = ROLE_LABELS[item.role] || item.role;
    doc.text(`• ${label}: ${item.count}`, margin + 5, yPos);
    yPos += 6;
  });
  
  yPos += 10;
  
  // Reports by Status section
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('Relatórios por Status', margin, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  stats.reportsByStatus.forEach(item => {
    const label = STATUS_LABELS[item.status] || item.status;
    doc.text(`• ${label}: ${item.count}`, margin + 5, yPos);
    yPos += 6;
  });
  
  // Add watermark to all pages
  const addWatermark = () => {
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      doc.setFontSize(60);
      doc.setTextColor(...primaryColor);
      doc.text('Sistema RDO', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
      });
      doc.restoreGraphicsState();
    }
  };
  
  addWatermark();
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Gerado pelo Sistema RDO', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Save the PDF
  doc.save(`Estatisticas_${getDateSuffix()}.pdf`);
}
