import JSZip from 'jszip';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { formatRdoNumber } from './formatters';
import { generateReportPdfAsBlob, TenantColors, PdfOptions } from './generateReportPdf';

export type BatchExportFormat = 'combined' | 'zip';
export type BatchExportDestination = 'download' | 'cloud' | 'both';

export interface BatchExportProgress {
  current: number;
  total: number;
  currentReportName: string;
}

// Internal types that match what generateReportPdfAsBlob expects
// Using 'any' casting since the function uses flexible access patterns
interface BatchReportData {
  report: any;
  company: any;
  site: any;
  project: any;
  signatures: any[];
}

// Fetch report data with all relations needed for PDF generation
async function fetchReportForPdf(reportId: string): Promise<BatchReportData | null> {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      project:projects(
        *,
        site:sites(*),
        company:companies(*)
      ),
      activities:report_activities(*),
      deviations:report_deviations(*),
      attendance:report_attendance(*),
      photos:report_photos(*),
      signatures:report_signatures(*)
    `)
    .eq('id', reportId)
    .single();

  if (error || !data) {
    console.error('Erro ao buscar relatório:', reportId, error);
    return null;
  }

  const projectData = data.project as any;
  if (!projectData?.site || !projectData?.company) {
    console.error('Relatório sem projeto/site/empresa:', reportId);
    return null;
  }

  // Transform to types expected by generateReportPdfAsBlob
  // Using field names that match what buildReportPdfDoc accesses via (report as any)
  const report = {
    id: data.id,
    date: parseISO(data.date),
    shift: data.shift,
    status: data.status,
    location: data.location,
    startTime: data.start_time,
    endTime: data.end_time,
    weather: data.weather,
    temperature: data.temperature,
    plannedWorkforce: data.planned_workforce,
    actualWorkforce: data.actual_workforce,
    dailyProgress: data.daily_progress,
    supervisorName: data.supervisor_name,
    comments: data.comments,
    aiSummary: data.ai_summary,
    routine: data.routine,
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
    createdBy: data.created_by ?? '',
    projectId: data.project_id,
    teamId: data.team_id,
    rdo_number: data.rdo_number,
    rdoNumber: data.rdo_number,
    contractNumber: data.contract_number,
    maintenanceOrderNumber: data.maintenance_order_number,
    maintenanceOrderTitle: data.maintenance_order_title,
    activities: (data.activities || []).map((a: any) => ({
      id: a.id,
      description: a.description,
      completed: a.completed ?? false,
      notes: a.notes,
      progress: a.progress,
    })),
    deviations: (data.deviations || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      description: d.description,
      impact: d.impact,
      actionTaken: d.action_taken,
    })),
    attendance: (data.attendance || []).map((att: any) => ({
      id: att.id,
      userId: att.user_id,
      userName: att.user_name,
      present: att.present ?? false,
      arrivalTime: att.arrival_time,
      departureTime: att.departure_time,
      functionRole: att.function_role,
      notes: att.notes,
    })),
    photos: (data.photos || []).map((p: any) => ({
      id: p.id,
      url: p.url,
      description: p.description,
    })),
  };

  const company = {
    id: projectData.company.id,
    name: projectData.company.name,
    cnpj: projectData.company.cnpj,
    email: projectData.company.email,
    phone: projectData.company.phone,
    address: projectData.company.address,
    city: projectData.company.city,
    state: projectData.company.state,
    logoUrl: projectData.company.logo_url,
    logo_url: projectData.company.logo_url,
    responsibleName: projectData.company.responsible_name,
    responsibleEmail: projectData.company.responsible_email,
    responsiblePhone: projectData.company.responsible_phone,
    responsibleRole: projectData.company.responsible_role,
  };

  const site = {
    id: projectData.site.id,
    name: projectData.site.name,
    companyId: projectData.site.company_id,
    address: projectData.site.address,
    city: projectData.site.city,
    state: projectData.site.state,
    latitude: projectData.site.latitude,
    longitude: projectData.site.longitude,
  };

  const project = {
    id: projectData.id,
    name: projectData.name,
    code: projectData.code,
    description: projectData.description,
    status: projectData.status,
    startDate: projectData.start_date ? new Date(projectData.start_date) : undefined,
    endDate: projectData.end_date ? new Date(projectData.end_date) : undefined,
    progress: projectData.progress,
    siteId: projectData.site_id,
    companyId: projectData.company_id,
    supervisorName: projectData.supervisor_name,
    clientResponsibleName: projectData.client_responsible_name,
    contractNumber: projectData.contract_number,
  };

  const signatures = (data.signatures || []).map((sig: any) => ({
    id: sig.id,
    signerName: sig.signer_name,
    signerRole: sig.signer_role,
    signatureData: sig.signature_data,
    signedAt: sig.signed_at,
    ipAddress: sig.ip_address,
  }));

  return { report, company, site, project, signatures };
}

// Fetch tenant colors from system_settings
async function fetchTenantColors(): Promise<TenantColors | undefined> {
  const { data } = await supabase
    .from('system_settings')
    .select('primary_color, accent_color, logo_url, pdf_logo_url')
    .limit(1)
    .single();

  if (!data) return undefined;

  return {
    primary_color: data.primary_color,
    accent_color: data.accent_color,
    logo_url: data.logo_url,
    pdf_logo_url: data.pdf_logo_url,
  };
}

export async function exportReportsBatch(
  reportIds: string[],
  formatType: BatchExportFormat,
  onProgress?: (progress: BatchExportProgress) => void,
  pdfOptions?: PdfOptions
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const total = reportIds.length;
  
  // Fetch tenant colors once for all reports
  const tenantColors = await fetchTenantColors();
  
  if (formatType === 'zip') {
    const zip = new JSZip();
    
    for (let i = 0; i < reportIds.length; i++) {
      const reportData = await fetchReportForPdf(reportIds[i]);
      if (!reportData) continue;
      
      const { report, company, site, project, signatures } = reportData;
      
      onProgress?.({
        current: i + 1,
        total,
        currentReportName: `${project.name} - ${format(report.date, 'dd/MM/yyyy', { locale: ptBR })}`
      });
      
      // Use the same function as individual PDF generation
      const pdfBlob = await generateReportPdfAsBlob(
        report,
        company,
        site,
        project,
        signatures,
        tenantColors,
        pdfOptions
      );
      
      const rdoNumber = formatRdoNumber(report.rdo_number ?? 1);
      const fileName = `RDO - ${rdoNumber} - ${company.name} - ${format(report.date, 'dd-MM-yyyy')}.pdf`;
      zip.file(fileName, pdfBlob);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const filename = `relatorios_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.zip`;
    
    return { blob: zipBlob, filename, mimeType: 'application/zip' };
  } else {
    // Combined PDF - generate each PDF as ZIP since true PDF merging requires additional library
    const zip = new JSZip();
    
    for (let i = 0; i < reportIds.length; i++) {
      const reportData = await fetchReportForPdf(reportIds[i]);
      if (!reportData) continue;
      
      const { report, company, site, project, signatures } = reportData;
      
      onProgress?.({
        current: i + 1,
        total,
        currentReportName: `${project.name} - ${format(report.date, 'dd/MM/yyyy', { locale: ptBR })}`
      });
      
      const pdfBlob = await generateReportPdfAsBlob(
        report,
        company,
        site,
        project,
        signatures,
        tenantColors,
        pdfOptions
      );
      
      const rdoNumber = formatRdoNumber(report.rdo_number ?? 1);
      const fileName = `RDO - ${rdoNumber} - ${company.name} - ${format(report.date, 'dd-MM-yyyy')}.pdf`;
      zip.file(fileName, pdfBlob);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const filename = `relatorios_combinados_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.zip`;
    
    return { blob: zipBlob, filename, mimeType: 'application/zip' };
  }
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
