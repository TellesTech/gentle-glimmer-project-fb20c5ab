import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getUazapiConfig, getUazapiToken } from "../_shared/uazapiConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

let UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL") || "https://chatwees.uazapi.com";

/** Normaliza telefone BR para o formato E.164 sem "+" (ex.: 5585999998888). */
function normalizePhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits.length >= 12 ? digits : null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 11 ? digits : null;
}

function buildMessage(opts: {
  name: string;
  email: string;
  password?: string | null;
  portalUrl: string;
  companyName?: string | null;
}) {
  const { name, email, password, portalUrl, companyName } = opts;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const lines = [
    `Olá, ${firstName}! 👋`,
    "",
    `Seu acesso ao *Portal Wees* ${companyName ? `(${companyName}) ` : ""}foi criado com sucesso.`,
    "",
    "*Dados de acesso*",
    `• Usuário: ${email}`,
  ];
  if (password) lines.push(`• Senha provisória: ${password}`);
  lines.push(
    `• Portal: ${portalUrl}`,
    "",
    password
      ? "Por segurança, altere a senha no primeiro acesso. Não compartilhe estes dados com terceiros."
      : "Use a opção *Esqueci minha senha* no portal para definir sua senha.",
    "",
    "No portal você acompanha e aprova os Relatórios Diários de Obra (RDO).",
    "",
    "Atenciosamente,",
    "Equipe Wees",
  );
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    UAZAPI_BASE_URL = (await getUazapiConfig()).baseUrl;
    const uazToken = (await getUazapiToken()).token || "";

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: any) => ["admin", "super_admin"].includes(r.role));
    if (!allowed) return json({ error: "Sem permissão para enviar credenciais" }, 403);

    if (!uazToken) return json({ error: "WhatsApp não configurado (token UAZAPI ausente)" }, 400);

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const password = body.password ? String(body.password) : null;
    const companyName = body.companyName ? String(body.companyName) : null;
    const companyId: string | null = body.companyId || null;
    const siteId: string | null = body.siteId || null;
    const customContent = body.content ? String(body.content) : null;
    const origin = req.headers.get("origin") || "https://rdo.wees.com.br";
    const portalUrl = String(body.portalUrl || `${origin}/client/login`);
    const phone = normalizePhone(String(body.phone || ""));

    if (name.length < 2) return json({ error: "Nome inválido" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
    if (!phone) return json({ error: "Telefone de WhatsApp inválido" }, 400);
    if (!/^https?:\/\//.test(portalUrl)) return json({ error: "Link do portal inválido" }, 400);

    const text = customContent?.trim()
      ? customContent
      : buildMessage({ name, email, password, portalUrl, companyName });

    const response = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: uazToken },
      body: JSON.stringify({ number: phone, text }),
    });

    const raw = await response.text();

    const logMessage = async (status: string, errorMessage: string | null, providerMessageId: string | null) => {
      const { error: logErr } = await admin.from("client_messages").insert({
        channel: "whatsapp",
        recipient_name: name,
        recipient_email: email,
        recipient_phone: phone,
        company_id: companyId,
        site_id: siteId,
        content: text,
        status,
        error_message: errorMessage,
        provider_message_id: providerMessageId,
        created_by: userData.user.id,
      });
      if (logErr) console.error("client_messages log error", logErr);
    };

    if (!response.ok) {
      console.error(`UAZAPI send failed [${response.status}]: ${raw}`);
      await logMessage("failed", `HTTP ${response.status}: ${raw}`.slice(0, 1000), null);
      return json(
        { error: "Falha ao enviar mensagem no WhatsApp", status: response.status, details: raw },
        response.status,
      );
    }

    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { /* resposta não-JSON */ }

    await logMessage("sent", null, parsed?.id || parsed?.messageid || null);

    console.log(`Credenciais do portal enviadas por WhatsApp para ${phone} (usuário ${email})`);
    return json({ success: true, phone, messageId: parsed?.id || parsed?.messageid || null });
  } catch (e) {
    console.error("send-portal-credentials-whatsapp error", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
