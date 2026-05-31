import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')!;

const PENDING_DAYS_THRESHOLD = 3;
const NOTIFICATION_COOLDOWN_HOURS = 24;

// SMTP Configuration for Zoho
const SMTP_HOST = 'smtppro.zoho.com';
const SMTP_PORT = 465;
const SMTP_USER = Deno.env.get('SMTP_USER') || 'sistema@ropefy.com.br';
const SMTP_FROM = `Sistema WEES <${SMTP_USER}>`;

interface PendingDocument {
  id: string;
  document_id: string;
  document_name: string;
  created_at: string;
  days_pending: number;
  signers: {
    id: string;
    name: string;
    email: string;
    status: string;
    sign_link: string | null;
    signer_type: string;
  }[];
  report: {
    id: string;
    date: string;
    project: {
      id: string;
      name: string;
      site: {
        id: string;
        name: string;
        company: {
          id: string;
          name: string;
        };
      };
    };
  };
}

interface GroupedByCompany {
  company: { id: string; name: string };
  sites: Map<string, {
    site: { id: string; name: string };
    projects: Map<string, {
      project: { id: string; name: string };
      documents: PendingDocument[];
    }>;
  }>;
  totalDocs: number;
}

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = await Deno.connectTls({
      hostname: SMTP_HOST,
      port: SMTP_PORT,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(4096);
      let response = '';
      let attempts = 0;
      
      while (attempts < 10) {
        const n = await conn.read(buffer);
        if (n === null) break;
        
        response += decoder.decode(buffer.subarray(0, n));
        
        const lines = response.split('\r\n').filter(l => l.length > 0);
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          if (lastLine.length >= 4 && lastLine[3] === ' ') {
            break;
          }
        }
        attempts++;
      }
      
      return response;
    }

    async function sendCommand(command: string): Promise<string> {
      await conn.write(encoder.encode(command + '\r\n'));
      return await readResponse();
    }

    // Initial greeting
    await readResponse();

    // EHLO
    await sendCommand(`EHLO ${SMTP_HOST}`);

    // AUTH LOGIN
    await sendCommand('AUTH LOGIN');
    await sendCommand(encodeBase64(SMTP_USER));
    await sendCommand(encodeBase64(SMTP_PASSWORD));

    // MAIL FROM
    await sendCommand(`MAIL FROM:<${SMTP_USER}>`);

    // RCPT TO
    await sendCommand(`RCPT TO:<${to}>`);

    // DATA
    await sendCommand('DATA');

    // Email content
    const emailContent = [
      `From: ${SMTP_FROM}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${encodeBase64(subject)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64(htmlContent),
      '.',
    ].join('\r\n');

    await sendCommand(emailContent);

    // QUIT
    await sendCommand('QUIT');
    conn.close();

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('SMTP Error:', error);
    return { success: false, error: errorMessage };
  }
}

function generateAdminEmailHtml(
  adminName: string,
  groupedDocs: Map<string, GroupedByCompany>,
  totalPending: number,
  appUrl: string
): string {
  let companyHtml = '';
  
  groupedDocs.forEach((companyGroup) => {
    companyHtml += `
      <div style="margin-bottom: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 16px;">
          🏢 ${companyGroup.company.name}
        </h3>
    `;
    
    companyGroup.sites.forEach((siteGroup) => {
      companyHtml += `
        <div style="margin-left: 16px; margin-bottom: 12px;">
          <h4 style="margin: 0 0 8px 0; color: #4a4a4a; font-size: 14px;">
            📍 ${siteGroup.site.name}
          </h4>
      `;
      
      siteGroup.projects.forEach((projectGroup) => {
        companyHtml += `
          <div style="margin-left: 16px; margin-bottom: 8px;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #2563eb;">
              📋 ${projectGroup.project.name}
            </p>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
        `;
        
        projectGroup.documents.forEach((doc) => {
          const pendingSigners = doc.signers.filter(s => s.status === 'pending');
          companyHtml += `
            <li style="margin-bottom: 4px;">
              RDO ${new Date(doc.report.date).toLocaleDateString('pt-BR')} 
              - <strong style="color: #dc2626;">${doc.days_pending} dias pendente</strong>
              (${pendingSigners.length} assinatura${pendingSigners.length > 1 ? 's' : ''} pendente${pendingSigners.length > 1 ? 's' : ''})
            </li>
          `;
        });
        
        companyHtml += '</ul></div>';
      });
      
      companyHtml += '</div>';
    });
    
    companyHtml += '</div>';
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://knubzymetllizsgeoikh.supabase.co/storage/v1/object/public/company-photos/logo-wees.png" alt="WEES" style="height: 40px;">
      </div>
      
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <h1 style="margin: 0 0 8px 0; color: #92400e; font-size: 24px;">
          ⚠️ Documentos Pendentes
        </h1>
        <p style="margin: 0; color: #a16207; font-size: 16px;">
          <strong>${totalPending}</strong> documento${totalPending > 1 ? 's' : ''} aguardando assinatura há mais de ${PENDING_DAYS_THRESHOLD} dias
        </p>
      </div>
      
      <p style="margin-bottom: 16px;">Olá <strong>${adminName}</strong>,</p>
      
      <p style="margin-bottom: 24px;">
        Segue o resumo dos documentos que estão pendentes de assinatura há mais de ${PENDING_DAYS_THRESHOLD} dias:
      </p>
      
      ${companyHtml}
      
      <div style="text-align: center; margin-top: 32px;">
        <a href="${appUrl}/admin/signatures" 
           style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">
          Ver Todas as Assinaturas
        </a>
      </div>
      
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;">
      
      <p style="color: #888; font-size: 12px; text-align: center;">
        Este é um email automático enviado pelo Sistema RDO.<br>
        © ${new Date().getFullYear()} WEES Soluções - Todos os direitos reservados
      </p>
    </body>
    </html>
  `;
}

function generateSignerReminderHtml(
  signerName: string,
  documentName: string,
  daysPending: number,
  projectName: string,
  siteName: string,
  reportDate: string,
  signLink: string | null
): string {
  const formattedDate = new Date(reportDate).toLocaleDateString('pt-BR');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://knubzymetllizsgeoikh.supabase.co/storage/v1/object/public/company-photos/logo-wees.png" alt="WEES" style="height: 40px;">
      </div>
      
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <h1 style="margin: 0 0 8px 0; color: #92400e; font-size: 24px;">
          🔔 Lembrete de Assinatura
        </h1>
        <p style="margin: 0; color: #a16207; font-size: 16px;">
          Documento aguardando há <strong>${daysPending} dias</strong>
        </p>
      </div>
      
      <p style="margin-bottom: 16px;">Olá <strong>${signerName}</strong>,</p>
      
      <p style="margin-bottom: 24px;">
        O documento abaixo está aguardando sua assinatura há <strong>${daysPending} dias</strong>. 
        Por favor, assine o quanto antes para dar continuidade ao processo.
      </p>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 120px;">📄 Documento:</td>
            <td style="padding: 8px 0; font-weight: 600;">${documentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">📋 Projeto:</td>
            <td style="padding: 8px 0;">${projectName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">📍 Unidade:</td>
            <td style="padding: 8px 0;">${siteName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">📅 Data RDO:</td>
            <td style="padding: 8px 0;">${formattedDate}</td>
          </tr>
        </table>
      </div>
      
      ${signLink ? `
        <div style="text-align: center; margin-top: 32px;">
          <a href="${signLink}" 
             style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ✍️ Assinar Documento
          </a>
        </div>
      ` : `
        <p style="text-align: center; color: #666; font-style: italic;">
          Você receberá um email da Autentique com o link para assinatura.
        </p>
      `}
      
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;">
      
      <p style="color: #888; font-size: 12px; text-align: center;">
        Este é um email automático enviado pelo Sistema RDO.<br>
        © ${new Date().getFullYear()} WEES Soluções - Todos os direitos reservados
      </p>
    </body>
    </html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('🔔 Starting pending signatures notification check...');
    
    // Calculate threshold date (3 days ago)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - PENDING_DAYS_THRESHOLD);
    
    // Fetch pending documents older than threshold
    const { data: pendingDocs, error: docsError } = await supabase
      .from('autentique_documents')
      .select(`
        id,
        document_id,
        document_name,
        created_at,
        signers:autentique_signers(id, name, email, status, sign_link, signer_type),
        report:reports(
          id,
          date,
          project:projects(
            id,
            name,
            site:sites(
              id,
              name,
              company:companies(id, name)
            )
          )
        )
      `)
      .eq('status', 'pending')
      .is('archived_at', null)
      .is('cancelled_at', null)
      .lt('created_at', thresholdDate.toISOString())
      .order('created_at', { ascending: true });

    if (docsError) {
      console.error('Error fetching pending documents:', docsError);
      throw docsError;
    }

    if (!pendingDocs || pendingDocs.length === 0) {
      console.log('✅ No pending documents older than 3 days');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending documents to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${pendingDocs.length} pending documents`);

    // Calculate days pending and filter valid documents
    const documentsWithDays: PendingDocument[] = pendingDocs
      .filter(doc => {
        const report = doc.report as unknown as PendingDocument['report'];
        return report?.project?.site?.company;
      })
      .map(doc => {
        const createdDate = new Date(doc.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const report = doc.report as unknown as PendingDocument['report'];
        const signers = (doc.signers || []) as unknown as PendingDocument['signers'];
        
        return {
          id: doc.id,
          document_id: doc.document_id,
          document_name: doc.document_name,
          created_at: doc.created_at,
          days_pending: diffDays,
          signers,
          report,
        } as PendingDocument;
      });

    // Group documents by company > site > project
    const groupedByCompany = new Map<string, GroupedByCompany>();
    
    documentsWithDays.forEach(doc => {
      const company = doc.report.project.site.company;
      const site = doc.report.project.site;
      const project = doc.report.project;

      if (!groupedByCompany.has(company.id)) {
        groupedByCompany.set(company.id, {
          company,
          sites: new Map(),
          totalDocs: 0,
        });
      }

      const companyGroup = groupedByCompany.get(company.id)!;
      companyGroup.totalDocs++;

      if (!companyGroup.sites.has(site.id)) {
        companyGroup.sites.set(site.id, {
          site,
          projects: new Map(),
        });
      }

      const siteGroup = companyGroup.sites.get(site.id)!;

      if (!siteGroup.projects.has(project.id)) {
        siteGroup.projects.set(project.id, {
          project,
          documents: [],
        });
      }

      siteGroup.projects.get(project.id)!.documents.push(doc);
    });

    // Fetch admins to notify
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email
      `)
      .not('email', 'is', null);

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      throw adminsError;
    }

    // Get admin user IDs with admin roles
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'director', 'super_admin']);

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
    const adminProfiles = admins?.filter(a => adminUserIds.has(a.id)) || [];

    console.log(`👥 Found ${adminProfiles.length} admins to notify`);

    // Check cooldown for admin notifications
    const cooldownThreshold = new Date();
    cooldownThreshold.setHours(cooldownThreshold.getHours() - NOTIFICATION_COOLDOWN_HOURS);

    const { data: recentAdminNotifications } = await supabase
      .from('signature_notifications')
      .select('recipient_email')
      .eq('notification_type', 'admin_summary')
      .gte('sent_at', cooldownThreshold.toISOString());

    const recentlyNotifiedAdmins = new Set(recentAdminNotifications?.map(n => n.recipient_email) || []);

    // Get app URL from system settings or use default
    const { data: settings } = await supabase
      .from('system_settings')
      .select('app_url')
      .single();

    const appUrl = settings?.app_url || 'https://wees.com.br';

    // Send admin summary emails
    const notificationPromises: Promise<void>[] = [];
    const notificationRecords: { document_id: string | null; signer_id: string | null; notification_type: string; recipient_email: string }[] = [];

    for (const admin of adminProfiles) {
      if (!admin.email || recentlyNotifiedAdmins.has(admin.email)) {
        console.log(`⏭️ Skipping admin ${admin.name} (cooldown or no email)`);
        continue;
      }

      notificationPromises.push(
        (async () => {
          const result = await sendEmailViaSMTP(
            admin.email,
            `⚠️ ${documentsWithDays.length} documento(s) pendente(s) há mais de ${PENDING_DAYS_THRESHOLD} dias`,
            generateAdminEmailHtml(admin.name, groupedByCompany, documentsWithDays.length, appUrl)
          );
          
          if (result.success) {
            console.log(`✅ Admin notification sent to ${admin.email}`);
            notificationRecords.push({
              document_id: null,
              signer_id: null,
              notification_type: 'admin_summary',
              recipient_email: admin.email,
            });
          } else {
            console.error(`❌ Failed to send to ${admin.email}:`, result.error);
          }
        })()
      );
    }

    // Send signer reminders
    for (const doc of documentsWithDays) {
      const pendingSigners = doc.signers.filter(s => s.status === 'pending');
      
      for (const signer of pendingSigners) {
        // Check cooldown for this specific signer/document combo
        const { data: recentSignerNotification } = await supabase
          .from('signature_notifications')
          .select('id')
          .eq('signer_id', signer.id)
          .eq('document_id', doc.id)
          .gte('sent_at', cooldownThreshold.toISOString())
          .limit(1);

        if (recentSignerNotification && recentSignerNotification.length > 0) {
          console.log(`⏭️ Skipping signer ${signer.name} for doc ${doc.document_name} (cooldown)`);
          continue;
        }

        notificationPromises.push(
          (async () => {
            const result = await sendEmailViaSMTP(
              signer.email,
              `🔔 Lembrete: Documento aguardando assinatura há ${doc.days_pending} dias`,
              generateSignerReminderHtml(
                signer.name,
                doc.document_name || `RDO ${new Date(doc.report.date).toLocaleDateString('pt-BR')}`,
                doc.days_pending,
                doc.report.project.name,
                doc.report.project.site.name,
                doc.report.date,
                signer.sign_link
              )
            );
            
            if (result.success) {
              console.log(`✅ Signer reminder sent to ${signer.email}`);
              notificationRecords.push({
                document_id: doc.id,
                signer_id: signer.id,
                notification_type: 'signer_reminder',
                recipient_email: signer.email,
              });
            } else {
              console.error(`❌ Failed to send reminder to ${signer.email}:`, result.error);
            }
          })()
        );
      }
    }

    // Wait for all notifications to be sent
    await Promise.all(notificationPromises);

    // Record all successful notifications
    if (notificationRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('signature_notifications')
        .insert(notificationRecords);

      if (insertError) {
        console.error('Error recording notifications:', insertError);
      } else {
        console.log(`📝 Recorded ${notificationRecords.length} notifications`);
      }
    }

    console.log('🎉 Notification process completed');

    return new Response(
      JSON.stringify({
        success: true,
        pendingDocuments: documentsWithDays.length,
        notificationsSent: notificationRecords.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in pending-signatures-notification:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
