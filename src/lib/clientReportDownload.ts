import { parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/loose-client';
import { generateReportPdfAsBlob, type PdfOptions } from '@/lib/generateReportPdf';

const REPORT_SELECT = `
  *,
  project:projects(*, site:sites(*, company:companies(*))),
  team:teams(*),
  creator:profiles!created_by(id, name, avatar_url),
  activities:report_activities(*),
  deviations:report_deviations(*),
  attendance:report_attendance(*),
  photos:report_photos(*),
  signatures:report_signatures(*)
`;

export function buildRdoFileName(rdoNumber?: number | null, date?: string | null) {
  const num = (rdoNumber ?? 0).toString().padStart(3, '0');
  const d = date ? date.slice(0, 10) : 'sem-data';
  return `RDO-${num}-${d}.pdf`;
}

/**
 * Generates (or fetches) the PDF of a report as a Blob.
 * Prefers the stored signed PDF when available.
 */
export interface GetReportPdfOptions {
  /** Opções extras do gerador (ex.: campos em branco para assinatura). */
  pdfOptions?: PdfOptions;
  /** Ignora o PDF armazenado e sempre gera um novo. */
  forceRegenerate?: boolean;
}

export async function getReportPdfBlob(
  reportId: string,
  options?: GetReportPdfOptions,
): Promise<{ blob: Blob; filename: string }> {
  const { data: report, error } = await supabase
    .from('reports')
    .select(REPORT_SELECT)
    .eq('id', reportId)
    .maybeSingle();

  if (error || !report) throw new Error('Relatório não encontrado');

  const filename = buildRdoFileName((report as any).rdo_number, (report as any).date);

  // 1) Signed PDF already stored — usar apenas se estiver atualizado
  // (não pode ser mais antigo que a última assinatura registrada)
  const signedUrl = (report as any).signed_pdf_url;
  const signatureRows: any[] = (report as any).signatures || [];
  const lastSignatureAt = signatureRows.reduce((acc: number, s: any) => {
    const t = s?.signed_at ? new Date(s.signed_at).getTime() : 0;
    return t > acc ? t : acc;
  }, 0);

  const mustRegenerate = Boolean(options?.forceRegenerate || options?.pdfOptions?.includeSignatureFields);

  if (signedUrl && !mustRegenerate) {
    try {
      const resp = await fetch(signedUrl);
      if (resp.ok) {
        const lastModifiedHeader = resp.headers.get('last-modified');
        const fileTime = lastModifiedHeader ? new Date(lastModifiedHeader).getTime() : 0;
        const isStale = !fileTime || (lastSignatureAt > 0 && fileTime < lastSignatureAt);
        if (!isStale) {
          const blob = await resp.blob();
          if (blob.size > 0) return { blob, filename };
        } else {
          console.info('[clientReportDownload] PDF armazenado desatualizado, regerando com todas as assinaturas');
        }
      }
    } catch (err) {
      console.warn('[clientReportDownload] falha ao baixar PDF assinado, gerando novo', err);
    }
  }

  // 2) Generate on the fly
  const project = (report as any).project;
  const site = project?.site;
  const company = site?.company;
  if (!project || !site || !company) throw new Error('Dados do relatório incompletos');

  const { data: systemSettings } = await supabase
    .from('system_settings')
    .select('primary_color, accent_color, logo_url, pdf_logo_url')
    .limit(1)
    .maybeSingle();

  const r: any = report;

  const reportForPdf: any = {
    id: r.id,
    date: parseISO(r.date),
    shift: r.shift,
    activityLocation: r.location || '',
    startTime: r.start_time || '',
    endTime: r.end_time || '',
    status: r.status,
    comments: r.comments || '',
    ai_summary: r.ai_summary || '',
    routine: r.routine || '',
    projectId: project.id,
    projectName: project.name,
    teamId: r.team_id || '',
    teamName: r.team?.name || '',
    createdById: r.created_by || '',
    createdByName: r.creator?.name || '',
    maintenanceOrderTitle: r.maintenance_order_title || '',
    maintenanceOrderNumber: r.maintenance_order_number || '',
    ambulancePoint: r.ambulance_point || '',
    meetingPoint: r.meeting_point || '',
    radioFrequencyWees: r.radio_frequency_wees || '',
    radioFrequencyOperation: r.radio_frequency_operation || '',
    arrivalTimeAtLiberator: r.arrival_time_at_liberator || '',
    documentReleaseTime: r.document_release_time || '',
    blockRevalidationTime: r.blockage_revalidation_time || '',
    activities: (r.activities || []).map((a: any, index: number) => ({
      id: a.id,
      reportId: r.id,
      description: a.description,
      completed: a.completed,
      order: index,
    })),
    deviations: (r.deviations || []).map((d: any) => ({
      id: d.id,
      reportId: r.id,
      type: d.type,
      description: d.description,
      impact: d.impact,
      correctiveAction: d.action_taken,
      resolved: false,
    })),
    attendance: (r.attendance || []).map((a: any) => ({
      id: a.id,
      reportId: r.id,
      userId: a.user_id || '',
      userName: a.user_name,
      present: a.present,
      arrivalTime: a.arrival_time,
      departureTime: a.departure_time,
      functionRole: a.function_role,
    })),
    photos: (r.photos || []).map((p: any) => ({
      id: p.id,
      reportId: r.id,
      url: p.url,
      description: p.description,
      uploadedAt: new Date(p.created_at || Date.now()),
    })),
    signatures: (r.signatures || []).map((s: any) => ({
      id: s.id,
      reportId: r.id,
      signerName: s.signer_name,
      signerRole: s.signer_role,
      signatureData: s.signature_data,
      signedAt: new Date(s.signed_at),
      ipAddress: s.ip_address,
    })),
    createdAt: new Date(r.created_at || Date.now()),
    updatedAt: new Date(r.updated_at || Date.now()),
  };

  const companyForPdf: any = {
    id: company.id,
    name: company.name,
    cnpj: company.cnpj || '',
    logo: company.logo_url || undefined,
    address: company.address || undefined,
    phone: company.phone || undefined,
    email: company.email || undefined,
    active: true,
    createdAt: new Date(company.created_at || Date.now()),
  };

  const siteForPdf: any = {
    id: site.id,
    companyId: site.company_id,
    name: site.name,
    city: site.city || '',
    state: site.state || '',
    address: site.address || undefined,
    active: true,
    createdAt: new Date(site.created_at || Date.now()),
  };

  const projectForPdf: any = {
    id: project.id,
    companyId: project.company_id,
    siteId: project.site_id,
    name: project.name,
    code: project.code || '',
    location: '',
    startDate: new Date(project.start_date || Date.now()),
    expectedEndDate: project.end_date ? new Date(project.end_date) : undefined,
    status: project.status || 'in_progress',
    supervisorId: '',
    active: true,
  };

  const tenantColors = systemSettings
    ? {
        primary_color: (systemSettings as any).primary_color,
        accent_color: (systemSettings as any).accent_color,
        logo_url: (systemSettings as any).logo_url,
        pdf_logo_url: (systemSettings as any).pdf_logo_url,
      }
    : undefined;

  const blob = await generateReportPdfAsBlob(
    reportForPdf,
    companyForPdf,
    siteForPdf,
    projectForPdf,
    reportForPdf.signatures,
    tenantColors,
  );

  return { blob, filename };
}
