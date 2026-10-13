// Registra mudanças de conexão do WhatsApp e avisa os super admins (sino + e-mail),
// sem repetir o aviso para a mesma queda.
import { sendEmailViaSMTP } from "./smtp.ts";

const APP_URL = "https://rdo.wees.com.br";

export async function recordWhatsAppConnection(
  supabase: any,
  connected: boolean,
  reason?: string | null,
  opts: { alertNow?: boolean } = {},
) {
  const { data: row } = await supabase
    .from("whatsapp_integration_settings")
    .select("id, connection_status, disconnect_alerted_at, instance_name")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return;

  const newStatus = connected ? "connected" : "disconnected";
  const changed = row.connection_status !== newStatus;
  const patch: Record<string, unknown> = { connection_status: newStatus };
  if (changed) patch.connection_changed_at = new Date().toISOString();
  if (!connected && reason) patch.last_disconnect_reason = reason;

  let alertType: "down" | "up" | null = null;
  if (!connected && opts.alertNow && !row.disconnect_alerted_at) {
    alertType = "down";
    patch.disconnect_alerted_at = new Date().toISOString();
  }
  if (connected && row.disconnect_alerted_at) {
    alertType = "up";
    patch.disconnect_alerted_at = null;
  }

  await supabase.from("whatsapp_integration_settings").update(patch).eq("id", row.id);
  if (!alertType) return;

  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
  const ids: string[] = (admins || []).map((a: any) => a.user_id);
  if (!ids.length) return;

  const title = alertType === "down" ? "WhatsApp desconectado" : "WhatsApp reconectado";
  const message =
    alertType === "down"
      ? `Os RDOs enviados pelo WhatsApp não estão entrando no sistema. Leia o QR Code em Configurações > WhatsApp.${reason ? ` Motivo: ${reason}.` : ""}`
      : "O WhatsApp voltou a funcionar e os RDOs voltaram a entrar no sistema.";
  const link = "/settings?tab=whatsapp";

  await supabase.from("notifications").insert(
    ids.map((user_id) => ({ user_id, title, message, type: alertType === "down" ? "error" : "success", link, read: false })),
  );

  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  if (!smtpPassword) return;
  const { data: profiles } = await supabase.from("profiles").select("email").in("id", ids);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px">
    <h2 style="color:${alertType === "down" ? "#b91c1c" : "#15803d"}">${title}</h2>
    <p>${message}</p>
    <p><a href="${APP_URL}${link}">Abrir configurações do WhatsApp</a></p></div>`;
  for (const p of profiles || []) {
    if (!p?.email) continue;
    try {
      await sendEmailViaSMTP("smtppro.zoho.com", 465, "noreply@wees.com.br", smtpPassword,
        "WEES Soluções <noreply@wees.com.br>", p.email, `${title} - Sistema RDO`, html);
    } catch (e) {
      console.error("Falha ao enviar e-mail de aviso do WhatsApp:", p.email, e);
    }
  }
}
