// Registra mudanças de conexão do WhatsApp e avisa os super admins (sino + e-mail),
// sem repetir o aviso para a mesma queda.
import { sendEmailViaSMTP } from "./smtp.ts";
import { normalizePhone, sendWhatsAppText } from "./whatsappSend.ts";

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

  // Aviso por WhatsApp para os contatos cadastrados (falha não bloqueia sino/e-mail)
  try {
    const { data: s } = await supabase.from("whatsapp_integration_settings")
      .select("alert_contacts, connection_changed_at, pending_down_alert_at").eq("id", row.id).maybeSingle();
    const contacts: { name: string; phone: string }[] = [];
    const seen = new Set<string>();
    for (const c of Array.isArray(s?.alert_contacts) ? s.alert_contacts : []) {
      const phone = normalizePhone(c?.phone);
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        contacts.push({ name: String(c?.name || "").trim().slice(0, 60), phone });
      }
    }
    if (contacts.length) {
      const fmt = (iso?: string | null) => iso
        ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
      let anyDownFailed = false;
      for (const { name, phone } of contacts) {
        const hi = name ? `Olá, ${name}! ` : "";
        const text = alertType === "down"
          ? `${hi}⚠️ *WhatsApp do Sistema RDO desconectado*\nOs RDOs enviados pelo WhatsApp não estão entrando no sistema. Leia o QR Code em ${APP_URL}/settings?tab=whatsapp${reason ? `\nMotivo: ${reason}` : ""}`
          : `${hi}✅ *WhatsApp do Sistema RDO reconectado*\nEle esteve desconectado${row.disconnect_alerted_at ? ` desde ${fmt(row.disconnect_alerted_at)}` : ""}. Os RDOs voltaram a entrar no sistema.`;
        const r = await sendWhatsAppText(phone, text);
        if (!r.ok) {
          console.error(`Aviso WhatsApp não enviado para ${phone} [${r.status}]: ${r.body}`);
          if (alertType === "down") anyDownFailed = true;
        }
      }
      // Se o aviso de queda não saiu para todos, marca como pendente para enviar ao reconectar
      if (alertType === "down" && anyDownFailed) {
        await supabase.from("whatsapp_integration_settings")
          .update({ pending_down_alert_at: new Date().toISOString() }).eq("id", row.id);
      }
      // Ao reconectar com aviso de queda pendente, avisa cada contato que esteve fora do ar
      if (alertType === "up" && s?.pending_down_alert_at) {
        for (const { name, phone } of contacts) {
          const hi = name ? `Olá, ${name}! ` : "";
          const text = `${hi}⚠️ *Aviso de queda do WhatsApp do Sistema RDO*\nO WhatsApp esteve desconectado desde ${fmt(s.pending_down_alert_at)} e acabou de reconectar. Nesse período, os RDOs enviados pelo WhatsApp não entraram no sistema.`;
          const r = await sendWhatsAppText(phone, text);
          if (!r.ok) console.error(`Aviso pendente não enviado para ${phone} [${r.status}]: ${r.body}`);
        }
        await supabase.from("whatsapp_integration_settings")
          .update({ pending_down_alert_at: null }).eq("id", row.id);
      }
    }
  } catch (e) {
    console.error("Falha no aviso por WhatsApp:", e);
  }

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
