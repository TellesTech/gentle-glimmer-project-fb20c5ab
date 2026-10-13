import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUazapiConfig, getUazapiToken } from "../_shared/uazapiConfig.ts";
import { recordWhatsAppConnection } from "../_shared/whatsappAlert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let UAZAPI_BASE_URL = "https://chatwees.uazapi.com";

async function uaFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = { "Content-Type": "application/json", token, ...(init.headers || {}) };
  return fetch(`${UAZAPI_BASE_URL}${path}`, { ...init, headers });
}

async function sendUazapiText(token: string, phone: string, message: string) {
  // Envio de mensagens ao WhatsApp está desativado por decisão do produto.
  console.log("[sendUazapiText] suprimido (bot silencioso):", { phone, preview: message?.slice(0, 80) });
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    UAZAPI_BASE_URL = (await getUazapiConfig()).baseUrl;
    const tokenInfo = await getUazapiToken();
    const token = tokenInfo.token;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token UAZAPI não configurado (UAZAPI_INSTANCE_TOKEN/UAZAPI_TOKEN)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;

    let logStatus = "ok";
    const logDetails: Record<string, unknown> = {};

    // 1) Conferir status da instância; se caiu, tentar reconectar e avisar se não voltar
    const isConnected = (d: any) =>
      d?.status?.connected === true || d?.connected === true || d?.instance?.status === "connected";
    try {
      const statusRes = await uaFetch("/instance/status", token, { method: "GET" });
      const statusData = await statusRes.json().catch(() => ({}));
      logDetails.instanceStatus = statusData?.status ?? statusData;
      let connected = isConnected(statusData);

      if (!connected) {
        console.log("UAZAPI instance disconnected; attempting auto-reconnect");
        for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
          const connectRes = await uaFetch("/instance/connect", token, { method: "POST", body: JSON.stringify({}) });
          const r = await connectRes.json().catch(() => ({}));
          logDetails[`reconnect${attempt}`] = { connected: r?.connected, status: r?.instance?.status };
          await new Promise((res) => setTimeout(res, 5000));
          const again = await uaFetch("/instance/status", token, { method: "GET" });
          connected = isConnected(await again.json().catch(() => ({})));
        }
        logStatus = connected ? "reconnected" : "still_disconnected";
      }
      logDetails.connected = connected;
      await recordWhatsAppConnection(
        supabase,
        connected,
        statusData?.instance?.lastDisconnectReason || null,
        { alertNow: !connected },
      );
    } catch (err) {
      console.error("Error checking instance status:", err);
      logDetails.instanceStatusError = err instanceof Error ? err.message : String(err);
    }

    // 2) Conferir e re-configurar webhook se necessário
    const webhookRes = await uaFetch("/webhook", token, { method: "GET" });
    const webhookData = await webhookRes.json().catch(() => ({}));
    logDetails.webhookData = webhookData;

    const hooks = Array.isArray(webhookData) ? webhookData : (webhookData ? [webhookData] : []);
    const ours = hooks.find(
      (h: any) => (h?.url || "") === expectedWebhookUrl && h?.enabled,
    );
    const needsFix = !ours;

    if (needsFix) {
      console.log("UAZAPI webhook needs fix; reconfiguring");
      const fixRes = await uaFetch("/webhook", token, {
        method: "POST",
        body: JSON.stringify({
          url: expectedWebhookUrl,
          enabled: true,
          events: ["messages", "messages_update", "connection"],
          excludeEvents: ["wasSentByApi", "isGroupYes"],
        }),
      });
      logDetails.fixResult = await fixRes.json().catch(() => ({}));
      logStatus = logStatus === "ok" ? "webhook_fixed" : `${logStatus}+webhook_fixed`;
    }

    // 2) Expirar pending_photo > 2h e enviar feedback ao grupo
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: expiredEntries, error: expireError } = await supabase
      .from("whatsapp_rdo_logs")
      .update({ status: "expired" })
      .eq("status", "pending_photo")
      .lt("created_at", twoHoursAgo)
      .select("id, group_id");

    if (expireError) {
      console.error("Error expiring pending_photo:", expireError.message);
    } else {
      const expiredCount = expiredEntries?.length || 0;
      logDetails.expiredPendingPhotos = expiredCount;
    }

    return new Response(JSON.stringify({ status: logStatus, ...logDetails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});