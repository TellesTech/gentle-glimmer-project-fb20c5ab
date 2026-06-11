const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UAZAPI_BASE_URL = "https://chatwees.uazapi.com";

async function uaFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = {
    "Content-Type": "application/json",
    token,
    ...(init.headers || {}),
  };
  return fetch(`${UAZAPI_BASE_URL}${path}`, { ...init, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("UAZAPI_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "UAZAPI_TOKEN não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;

    // POST → configura/atualiza o webhook
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const webhookUrl: string = body.webhookUrl || expectedWebhookUrl;

      const res = await uaFetch("/webhook", token, {
        method: "POST",
        body: JSON.stringify({
          url: webhookUrl,
          enabled: true,
          events: ["messages", "messages_update", "connection"],
          excludeEvents: ["wasSentByApi", "isGroupYes"],
        }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("UAZAPI webhook config response:", JSON.stringify(data));

      return new Response(JSON.stringify({ action: "webhook_configured", webhookUrl, result: data }), {
        status: res.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "qr-code") {
      // UAZAPI: POST /instance/connect retorna QR base64 (campo "qrcode" ou "base64")
      const res = await uaFetch("/instance/connect", token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      console.log("UAZAPI qr-code response:", JSON.stringify(data).slice(0, 200));

      const connected = data?.connected ?? data?.instance?.status === "connected" ?? data?.status === "connected";
      const qrRaw: string =
        data?.qrcode || data?.qrCode || data?.base64 || data?.instance?.qrcode || data?.value || data?.image || "";
      // Strip data:image/png;base64, prefix if present for unified rendering on the client
      const image = qrRaw.startsWith("data:") ? qrRaw.split(",")[1] : qrRaw;

      return new Response(JSON.stringify({ connected, value: image, image, raw: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-groups") {
      // UAZAPI: GET /group/list (sem paginação simples; alguns servers usam POST /chats with filters)
      let groups: { id: string; name: string }[] = [];
      const res = await uaFetch("/group/list", token, { method: "GET" });
      if (res.ok) {
        const data = await res.json().catch(() => ([]));
        const arr = Array.isArray(data) ? data : data?.groups || data?.data || [];
        groups = arr.map((g: any) => ({
          id: String(g.id || g.jid || g.chatid || g.groupId || "")
            .replace(/@g\.us$/i, "")
            .replace(/-group$/i, ""),
          name: g.subject || g.name || g.title || "Sem nome",
        })).filter((g: any) => g.id);
      } else {
        console.warn("UAZAPI list-groups failed:", res.status, await res.text());
      }
      return new Response(JSON.stringify({ groups }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET default → status da instância + config atual do webhook
    const statusRes = await uaFetch("/instance/status", token, { method: "GET" });
    const statusData = await statusRes.json().catch(() => ({}));

    const webhookRes = await uaFetch("/webhook", token, { method: "GET" });
    const webhookData = await webhookRes.json().catch(() => ({}));

    const connected = !!(
      statusData?.connected ||
      statusData?.instance?.status === "connected" ||
      statusData?.status === "connected"
    );

    const tokenLength = token.length;
    const tokenLooksLikeUrl = /^https?:\/\//i.test(token);
    const credentialsValid = !!token && !tokenLooksLikeUrl && tokenLength >= 20;

    return new Response(
      JSON.stringify({
        status: statusData,
        webhookConfig: webhookData,
        connected,
        smartPhoneConnected: connected,
        diagnostics: {
          credentialsValid,
          tokenLooksLikeUrl,
          tokenLength,
          expectedTokenLength: "~36 (UUID)",
          tokenLooksLikeInstanceId: false,
          tokenLengthInvalid: !credentialsValid,
          instanceIdLength: 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});