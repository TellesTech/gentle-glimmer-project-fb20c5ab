import { getUazapiConfig, getUazapiToken, saveInstanceToDb } from "../_shared/uazapiConfig.ts";

async function syncConnected(connected: boolean) {
  if (!connected) return;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const { recordWhatsAppConnection } = await import("../_shared/whatsappAlert.ts");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await recordWhatsAppConnection(sb, true);
  } catch (e) { console.error("syncConnected", e); }
}
// instanceName incluído no diagnóstico do GET

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let UAZAPI_BASE_URL = "https://weeschat.uazapi.com";

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
    const config = await getUazapiConfig();
    UAZAPI_BASE_URL = config.baseUrl;

    const tokenInfo = await getUazapiToken();
    const token = tokenInfo.token;
    if (!token) {
      return new Response(JSON.stringify({ error: "Token UAZAPI não configurado (UAZAPI_INSTANCE_TOKEN/UAZAPI_TOKEN)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const expectedWebhookUrl = config.webhookUrl || `${supabaseUrl}/functions/v1/uazapi-webhook`;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");


    // POST → configura/atualiza o webhook ou gerencia a instância
    if (req.method === "POST") {
      const reqBody = await req.json().catch(() => ({}));

      if (action === "create-instance") {
        const name = String(reqBody?.name || "").trim();
        if (!name) {
          return new Response(JSON.stringify({ error: "Informe o nome da instância" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const adminToken = (Deno.env.get("UAZAPI_TOKEN") || "").trim();
        if (!adminToken) {
          return new Response(JSON.stringify({ error: "UAZAPI_TOKEN (admin) não configurado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await uaFetch("/instance/init", adminToken, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        console.log("UAZAPI create-instance response:", JSON.stringify(data).slice(0, 300));
        const instanceToken: string = data?.token || data?.instance?.token || data?.hash?.token || "";
        if (!res.ok || !instanceToken) {
          return new Response(JSON.stringify({ error: "UAZAPI não retornou o token da instância", result: data }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const saved = await saveInstanceToDb(name, instanceToken);
        // aplica webhook na nova instância
        await uaFetch("/webhook", instanceToken, {
          method: "POST",
          body: JSON.stringify({
            url: expectedWebhookUrl,
            enabled: true,
            events: config.webhookEvents,
            excludeEvents: ["wasSentByApi", "isGroupYes"],
          }),
        }).catch(() => null);
        return new Response(JSON.stringify({ created: true, saved, instanceName: name, tokenMasked: `••••${instanceToken.slice(-6)}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "test_alert") {
        const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const { data: u } = await sb.auth.getUser(jwt);
        const { data: isSa } = u?.user
          ? await sb.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" })
          : { data: false };
        if (!isSa) return json({ error: "Apenas super admin" }, 403);
        const { normalizePhone, sendWhatsAppText } = await import("../_shared/whatsappSend.ts");
        const { data: s } = await sb.from("whatsapp_integration_settings")
          .select("alert_contacts").order("updated_at", { ascending: false }).limit(1).maybeSingle();
        const contacts: { name: string; phone: string }[] = [];
        const seen = new Set<string>();
        for (const c of Array.isArray(s?.alert_contacts) ? s.alert_contacts : []) {
          const phone = normalizePhone(c?.phone);
          if (phone && !seen.has(phone)) {
            seen.add(phone);
            contacts.push({ name: String(c?.name || "").trim().slice(0, 60), phone });
          }
        }
        if (!contacts.length) return json({ error: "Nenhum contato cadastrado para avisos." }, 400);
        const failed: string[] = [];
        for (const { name, phone } of contacts) {
          const hi = name ? `Olá, ${name}! ` : "";
          const r = await sendWhatsAppText(phone, `${hi}✅ Teste: este número receberá os avisos do WhatsApp do Sistema RDO (WEES).`);
          if (!r.ok) {
            console.error(`test_alert falhou para ${phone} [${r.status}]: ${r.body}`);
            failed.push(phone);
          }
        }
        if (failed.length === contacts.length) {
          return json({ error: "O WhatsApp não enviou a mensagem (verifique se está conectado).", failed }, 502);
        }
        return json({ sent: true, phones: contacts.map((c) => c.phone), failed });
      }

      if (action === "recover") {
        // Reprocessa as mensagens dos grupos vinculados desde uma data (só super admin)
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const { data: u } = await sb.auth.getUser(jwt);
        const { data: isSa } = u?.user
          ? await sb.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" })
          : { data: false };
        if (!isSa) {
          return new Response(JSON.stringify({ error: "Apenas super admin" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const since = new Date(String(reqBody?.since || "2026-10-03T00:00:00-03:00")).getTime();
        if (isNaN(since)) {
          return new Response(JSON.stringify({ error: "Data inválida" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: groups } = await sb.from("whatsapp_group_projects").select("group_id, group_name");
        const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
        const summary: any[] = [];
        for (const g of groups || []) {
          const chatid = `${String(g.group_id).replace(/@g\.us$/i, "")}@g.us`;
          const res = await uaFetch("/message/find", token, {
            method: "POST",
            body: JSON.stringify({ chatid, limit: 1000 }),
          });
          const data = await res.json().catch(() => ({}));
          const list: any[] = Array.isArray(data) ? data : data?.messages || data?.data || [];
          const toMs = (m: any) => {
            const t = Number(m.messageTimestamp || m.timestamp || m.messagetimestamp || 0);
            return t > 1e12 ? t : t * 1000;
          };
          const msgs = list
            .filter((m) => !(m.fromMe ?? m.fromme) && toMs(m) >= since)
            .sort((a, b) => toMs(a) - toMs(b));
          let sent = 0;
          for (const m of msgs) {
            const r = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}` },
              body: JSON.stringify({ EventType: "messages", message: m, recovered: true }),
            }).catch(() => null);
            if (r?.ok) sent++;
          }
          summary.push({ group: g.group_name || g.group_id, ok: res.ok, found: list.length, processed: sent, total: msgs.length });
        }
        return new Response(JSON.stringify({ recovered: true, summary }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "delete-instance") {
        const res = await uaFetch("/instance", token, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        await saveInstanceToDb(null, null);
        return new Response(JSON.stringify({ deleted: res.ok, result: data }), {
          status: res.ok ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "disconnect") {
        const res = await uaFetch("/instance/disconnect", token, {
          method: "POST",
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        console.log("UAZAPI disconnect response:", JSON.stringify(data).slice(0, 200));
        return new Response(
          JSON.stringify({ disconnected: res.ok, result: data }),
          {
            status: res.ok ? 200 : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const webhookUrl: string = reqBody.webhookUrl || expectedWebhookUrl;

      // Recarrega config/token sem cache para usar imediatamente o que acabou de ser salvo no banco
      const freshConfig = await getUazapiConfig(true);
      UAZAPI_BASE_URL = freshConfig.baseUrl;
      const freshToken = (await getUazapiToken(freshConfig)).token || token;
      const freshWebhookUrl: string = reqBody.webhookUrl || freshConfig.webhookUrl || webhookUrl;

      const res = await uaFetch("/webhook", freshToken, {
        method: "POST",
        body: JSON.stringify({
          url: freshWebhookUrl,
          enabled: true,
          events: freshConfig.webhookEvents,
          excludeEvents: ["wasSentByApi", "isGroupYes"],
        }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("UAZAPI webhook config response:", JSON.stringify(data));

      return new Response(JSON.stringify({ action: "webhook_configured", webhookUrl: freshWebhookUrl, result: data }), {
        status: res.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      await syncConnected(!!connected);
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
          id: String(g.JID || g.id || g.jid || g.chatid || g.groupId || "")
            .replace(/@g\.us$/i, "")
            .replace(/-group$/i, ""),
          name: g.Name || g.subject || g.name || g.title || "Sem nome",
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
      statusData?.status?.connected === true ||
      statusData?.connected ||
      statusData?.instance?.status === "connected" ||
      statusData?.status === "connected"
    );

    await syncConnected(connected);
    const tokenLength = token.length;
    const tokenLooksLikeUrl = /^https?:\/\//i.test(token);
    const credentialsValid = !!token && !tokenLooksLikeUrl && tokenLength >= 20;

    return new Response(
      JSON.stringify({
        status: statusData,
        webhookConfig: webhookData,
        connected,
        smartPhoneConnected: connected,
        baseUrl: UAZAPI_BASE_URL,
        expectedWebhookUrl,
        tokenMasked: token.length > 6 ? `••••${token.slice(-6)}` : "••••",
        tokenSource: tokenInfo.source,
        instanceTokenMasked: tokenInfo.instanceTokenMasked,
        adminTokenMasked: tokenInfo.adminTokenMasked,
        instanceName: tokenInfo.instanceName,

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