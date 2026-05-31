import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// SMTP Config
const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.hostinger.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER") || "sistema@ropefy.com.br";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");

// Cooldown: only send notification once per 24 hours per project
const NOTIFICATION_COOLDOWN_HOURS = 24;

interface CriticalProject {
  project_id: string;
  project_name: string;
  site_name: string;
  company_name: string;
  days_since_last_report: number;
  risk_level: string;
  progress: number;
}

// Base64 encoding for SMTP
function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// Send email via SMTP
async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  if (!SMTP_PASSWORD) {
    console.log("SMTP_PASSWORD not configured, skipping email");
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const conn = await Deno.connectTls({
      hostname: SMTP_HOST,
      port: SMTP_PORT,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const send = async (data: string) => {
      await conn.write(encoder.encode(data + "\r\n"));
    };

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n ?? 0));
    };

    await read(); // greeting
    await send(`EHLO ${SMTP_HOST}`);
    await read();
    await send("AUTH LOGIN");
    await read();
    await send(encodeBase64(SMTP_USER));
    await read();
    await send(encodeBase64(SMTP_PASSWORD));
    await read();
    await send(`MAIL FROM:<${SMTP_USER}>`);
    await read();
    await send(`RCPT TO:<${to}>`);
    await read();
    await send("DATA");
    await read();

    const message = [
      `From: Sistema WEES <${SMTP_USER}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${encodeBase64(subject)}?=`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      encodeBase64(htmlContent),
      ".",
    ].join("\r\n");

    await send(message);
    await read();
    await send("QUIT");
    conn.close();

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("SMTP Error:", error);
    return { success: false, error: errorMessage };
  }
}

// Generate HTML email for critical activities
function generateCriticalActivitiesEmail(
  recipientName: string,
  criticalProjects: CriticalProject[],
  appUrl: string
): string {
  const projectRows = criticalProjects
    .map(
      (p) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${p.project_name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${p.company_name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${p.site_name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="background: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
            ${p.days_since_last_report} dias
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${p.progress}%</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Alerta de Atividades Críticas</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Sistema WEES - Gestão de Projetos</p>
        </div>
        
      <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">Olá, <strong>${recipientName}</strong>,</p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Foram identificadas <strong style="color: #dc2626;">${criticalProjects.length} atividade(s)</strong> em situação crítica, 
            sem registro de RDO há <strong>7 ou mais dias</strong>:
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <thead>
              <tr style="background: #f8f8f8;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Projeto</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Empresa</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Localidade</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Dias sem RDO</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Progresso</th>
              </tr>
            </thead>
            <tbody>
              ${projectRows}
            </tbody>
          </table>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>Recomendação:</strong> Entre em contato com a equipe de campo para verificar a situação 
            e atualizar os registros o mais breve possível.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/projects" 
               style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Ver Projetos no Sistema
            </a>
          </div>
        </div>
        
        <div style="background: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            Este é um email automático do Sistema WEES.<br>
            Você está recebendo porque é administrador ou supervisor do sistema.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting critical activities notification check...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get project predictions
    const { data: predictions, error: predictionsError } = await supabase.rpc(
      "get_project_predictions"
    );

    if (predictionsError) {
      console.error("Error fetching predictions:", predictionsError);
      throw predictionsError;
    }

    // Filter critical activities
    const criticalProjects: CriticalProject[] = (predictions || []).filter(
      (p: any) => p.risk_level === "crítico"
    );

    console.log(`Found ${criticalProjects.length} critical projects`);

    if (criticalProjects.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No critical activities found",
          critical_count: 0,
          notifications_sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get app URL from settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("app_url")
      .limit(1)
      .maybeSingle();

    const appUrl = settings?.app_url || "https://app.wees.com.br";

    // Get admin users to notify
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    const adminUserIds = (adminRoles || []).map((r) => r.user_id);

    if (adminUserIds.length === 0) {
      console.log("No admin users found to notify");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No admin users to notify",
          critical_count: criticalProjects.length,
          notifications_sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin profiles
    const { data: adminProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", adminUserIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Check for recent notifications (cooldown)
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() - NOTIFICATION_COOLDOWN_HOURS);

    const { data: recentNotifications } = await supabase
      .from("ai_alert_notifications")
      .select("user_id, project_id")
      .eq("alert_type", "critical")
      .eq("notification_method", "email")
      .gte("notified_at", cooldownDate.toISOString());

    // Create a set of recently notified user-project pairs
    const recentlyNotified = new Set(
      (recentNotifications || []).map((n) => `${n.user_id}-${n.project_id}`)
    );

    let notificationsSent = 0;

    // Send notifications to each admin
    for (const admin of adminProfiles || []) {
      if (!admin.email) continue;

      // Filter projects that haven't been notified recently for this user
      const projectsToNotify = criticalProjects.filter(
        (p) => !recentlyNotified.has(`${admin.id}-${p.project_id}`)
      );

      if (projectsToNotify.length === 0) {
        console.log(`Skipping ${admin.email} - all projects recently notified`);
        continue;
      }

      // Generate and send email
      const emailHtml = generateCriticalActivitiesEmail(
        admin.name || "Administrador",
        projectsToNotify,
        appUrl
      );

      const emailResult = await sendEmailViaSMTP(
        admin.email,
        `⚠️ Alerta: ${projectsToNotify.length} atividade(s) crítica(s) sem RDO`,
        emailHtml
      );

      if (emailResult.success) {
        console.log(`Email sent to ${admin.email}`);
        notificationsSent++;

        // Record notifications sent
        const notificationRecords = projectsToNotify.map((p) => ({
          user_id: admin.id,
          project_id: p.project_id,
          alert_type: "critical",
          notification_method: "email",
        }));

        await supabase.from("ai_alert_notifications").insert(notificationRecords);
      } else {
        console.error(`Failed to send email to ${admin.email}:`, emailResult.error);
      }
    }

    console.log(`Notification process complete. Sent ${notificationsSent} emails.`);

    return new Response(
      JSON.stringify({
        success: true,
        critical_count: criticalProjects.length,
        notifications_sent: notificationsSent,
        admins_checked: adminProfiles?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in critical-activities-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
