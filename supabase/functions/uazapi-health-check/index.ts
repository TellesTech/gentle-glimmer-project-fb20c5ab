import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UAZAPI_BASE_URL = "https://chatwees.uazapi.com";

async function uaFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = { "Content-Type": "application/json", token, ...(init.headers || {}) };
  return fetch(`${UAZAPI_BASE_URL}${path}`, { ...init, headers });
}

async function sendUazapiText(token: string, phone: string, message: string) {
  const number = phone.includes("@") ? phone.split("@")[0] : phone;
  const res = await uaFetch("/send/text", token, {
    method: "POST",
    body: JSON.stringify({ number, text: message }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("UAZAPI_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!token) {
      return new Response(JSON.stringify({ error: "UAZAPI_TOKEN não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;

    // 1) Conferir e re-configurar webhook se necessário
    let logStatus = "ok";
    const logDetails: Record<string, unknown> = {};

    const webhookRes = await uaFetch("/webhook", token, { method: "GET" });
    const webhookData = await webhookRes.json().catch(() => ({}));
    logDetails.webhookData = webhookData;

    const currentUrl: string = webhookData?.url || webhookData?.webhook?.url || webhookData?.webhookUrl || "";
    const enabled: boolean = webhookData?.enabled ?? webhookData?.webhook?.enabled ?? false;
    const needsFix = !enabled || !currentUrl || !currentUrl.includes("uazapi-webhook");

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
      logStatus = "fixed";
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
      if (expiredCount > 0) {
        const uniqueGroups = new Set(
          (expiredEntries || []).map((e: any) => e.group_id).filter(Boolean) as string[]
        );
        for (const groupId of uniqueGroups) {
          try {
            await sendUazapiText(
              token,
              groupId,
              "📸 Foto recebida sem texto de RDO. Reenvie a foto junto com o texto do relatório para que seja processada corretamente."
            );
          } catch (err) {
            console.error(`Error sending feedback to ${groupId}:`, err);
          }
        }
      }
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