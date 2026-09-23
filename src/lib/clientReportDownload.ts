import { parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/loose-client';
import { generateReportPdfAsBlob, type PdfOptions } from '@/lib/generateReportPdf';

const REPORT_BASE_SELECT = `
  *,
  project:projects(*, site:sites(*, company:companies(*))),
  team:teams(*),
  creator:profiles!created_by(id, name, avatar_url)
`;

const CHILD_TABLES = [
  ['activities', 'report_activities'],
  ['deviations', 'report_deviations'],
  ['attendance', 'report_attendance'],
  ['photos', 'report_photos'],
  ['signatures', 'report_signatures'],
] as const;

function describeError(err: any) {
  if (!err) return 'erro desconhecido';
  const parts = [err.message, err.details, err.hint, err.code].filter(Boolean);
  return parts.length ? parts.join(' | ') : String(err);
}

async function fetchReportBase(reportId: string) {
  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { data, error } = await supabase
      .from('reports')
      .select(REPORT_BASE_SELECT)
      .eq('id', reportId)
      .maybeSingle();
    if (!error && data) return { report: data as any, error: null as any };
    lastError = error;
    if (!error && !data) return { report: null, error: null as any };
    console.warn(`[pdf] tentativa ${attempt} falhou ao buscar o RDO:`, describeError(error));
    if (attempt === 1) await new Promise((r) => setTimeout(r, 800));
  }
  return { report: null, error: lastError };
}

async function fetchReportChildren(reportId: string) {
  const results = await Promise.allSettled(
    CHILD_TABLES.map(([, table]) =>
      supabase.from(table).select('*').eq('report_id', reportId),
    ),
  );
  const out: Record<string, any[]> = {};
  results.forEach((res, i) => {
    const [key, table] = CHILD_TABLES[i];
    if (res.status === 'fulfilled' && !res.value.error) {
      out[key] = res.value.data || [];
    } else {
      out[key] = [];
      const reason = res.status === 'fulfilled' ? describeError(res.value.error) : describeError(res.reason);
      console.warn(`[pdf] não foi possível carregar ${table}: ${reason}`);
    }
  });
  return out;
}

async function fetchReportFromPortal(reportId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('get-client-report', {
      body: { reportId },
    });
    if (error) {
      console.warn('[pdf] portal não retornou o RDO:', describeError(error));
      return null;
    }
    return (data as any)?.report || (data as any) || null;
  } catch (err) {
    console.warn('[pdf] falha ao consultar o portal:', describeError(err));
    return null;
  }
}

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
  const { report: baseReport, error } = await fetchReportBase(reportId);

  let report: any = baseReport;

  if (!report) {
    // Último recurso: buscar pelo portal (acesso total no servidor)
    const portalReport = await fetchReportFromPortal(reportId);
    if (portalReport?.id) {
      report = portalReport;
    } else if (error) {
      throw new Error(`Não foi possível carregar este RDO: ${describeError(error)}`);
    } else {
      throw new Error('Relatório não encontrado');
    }
  }

  if (!Array.isArray(report.signatures)) {
    const children = await fetchReportChildren(reportId);
    report = { ...report, ...children };
  }

  const filename = buildRdoFileName((report as any).rdo_number, (report as any).date);

  // 1) Signed PDF already stored — usar apenas se estiver atualizado
  // (não pode ser mais antigo que a última assinatura registrada)
  const signedUrl = (report as any).signed_pdf_url;
  const signatureRows: any[] = (report as any).signatures || [];
  const lastSignatureAt = signatureRows.reduce((acc: number, s: any) => {
    const t = s?.signed_at ? new Date(s.signed_at).getTime() : 0;
    return t > acc ? t : acc;
  }, 0);

  const mustRegenerate = Boolean(
    options?.forceRegenerate ||
      options?.pdfOptions?.includeSignatureFields ||
      options?.pdfOptions?.omitSignatures,
  );

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

  // Rede de segurança: se as fotos não vieram junto (permissão/embed),
  // busca em consulta separada e, em último caso, pela função do portal.
  if (!Array.isArray(r.photos) || r.photos.length === 0) {
    const { data: directPhotos } = await supabase
      .from('report_photos')
      .select('*')
      .eq('report_id', reportId);
    if (directPhotos && directPhotos.length > 0) {
      r.photos = directPhotos;
      console.info(`[pdf-foto] fotos recuperadas em consulta direta: ${directPhotos.length}`);
    } else {
      try {
        const { data: portalData } = await supabase.functions.invoke('get-client-report', {
          body: { reportId },
        });
        const portalPhotos = (portalData as any)?.report?.photos || (portalData as any)?.photos;
        if (Array.isArray(portalPhotos) && portalPhotos.length > 0) {
          r.photos = portalPhotos;
          console.info(`[pdf-foto] fotos recuperadas pelo portal: ${portalPhotos.length}`);
        }
      } catch (err) {
        console.warn('[pdf-foto] não foi possível recuperar as fotos pelo portal', err);
      }
    }
  }


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
    options?.pdfOptions,
  );

  return { blob, filename };
}
