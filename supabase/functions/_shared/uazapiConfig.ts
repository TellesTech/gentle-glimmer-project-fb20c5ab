// Resolve a configuração de runtime da integração UAZAPI.
// Ordem de prioridade: banco (whatsapp_integration_settings) -> env -> padrão.

export const DEFAULT_UAZAPI_BASE_URL = "https://chatwees.uazapi.com";

export interface UazapiRuntimeConfig {
  baseUrl: string;
  webhookUrl: string | null;
  webhookEvents: string[];
  instanceName: string | null;
  instanceToken: string | null;
}

function sanitizeBaseUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

let cached: { value: UazapiRuntimeConfig; at: number } | null = null;
const CACHE_MS = 15_000;


export type UazapiTokenSource = "instance_db" | "instance_env" | "admin";

export interface UazapiTokenInfo {
  token: string | null;
  source: UazapiTokenSource | null;
  instanceTokenMasked: string | null;
  adminTokenMasked: string | null;
  instanceName: string | null;
}

function mask(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.length > 6 ? `••••${value.slice(-6)}` : "••••";
}

// Resolve o token UAZAPI na ordem: banco (instância salva) -> env instance -> env admin.
export async function getUazapiToken(config?: UazapiRuntimeConfig): Promise<UazapiTokenInfo> {
  const cfg = config || (await getUazapiConfig());
  const dbToken = (cfg.instanceToken || "").trim();
  const envInstanceToken = (Deno.env.get("UAZAPI_INSTANCE_TOKEN") || "").trim();
  const adminToken = (Deno.env.get("UAZAPI_TOKEN") || "").trim();

  const token = dbToken || envInstanceToken || adminToken || null;
  const source: UazapiTokenSource | null = dbToken ? "instance_db" : envInstanceToken ? "instance_env" : adminToken ? "admin" : null;

  return {
    token,
    source,
    instanceTokenMasked: mask(dbToken) || mask(envInstanceToken),
    adminTokenMasked: mask(adminToken),
    instanceName: cfg.instanceName,
  };
}

export async function getUazapiConfig(): Promise<UazapiRuntimeConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const envBase = sanitizeBaseUrl(Deno.env.get("UAZAPI_BASE_URL"));
  const fallback: UazapiRuntimeConfig = {
    baseUrl: envBase || DEFAULT_UAZAPI_BASE_URL,
    webhookUrl: null,
    webhookEvents: ["messages", "messages_update", "connection"],
    instanceName: null,
    instanceToken: null,
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return fallback;

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_whatsapp_runtime_config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: "{}",
    });
    if (!res.ok) return fallback;

    const rows = await res.json().catch(() => null);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return fallback;

    const value: UazapiRuntimeConfig = {
      baseUrl: sanitizeBaseUrl(row.base_url) || fallback.baseUrl,
      webhookUrl: typeof row.webhook_url === "string" && row.webhook_url.trim() ? row.webhook_url.trim() : null,
      webhookEvents: Array.isArray(row.webhook_events) && row.webhook_events.length
        ? row.webhook_events.map((e: unknown) => String(e))
        : fallback.webhookEvents,
      instanceName: typeof row.instance_name === "string" && row.instance_name.trim() ? row.instance_name.trim() : null,
      instanceToken: typeof row.instance_token === "string" && row.instance_token.trim() ? row.instance_token.trim() : null,
    };
    cached = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn("[uazapiConfig] fallback:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

// Salva nome/token da instância criada via API no banco (service role).
export async function saveInstanceToDb(instanceName: string | null, instanceToken: string | null): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return false;
  try {
    const headers = {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
    };
    const existing = await fetch(`${supabaseUrl}/rest/v1/whatsapp_integration_settings?select=id&order=created_at.asc&limit=1`, { headers });
    const rows = await existing.json().catch(() => []);
    const payload = { instance_name: instanceName, instance_token: instanceToken, updated_at: new Date().toISOString() };
    let res: Response;
    if (Array.isArray(rows) && rows[0]?.id) {
      res = await fetch(`${supabaseUrl}/rest/v1/whatsapp_integration_settings?id=eq.${rows[0].id}`, {
        method: "PATCH", headers, body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${supabaseUrl}/rest/v1/whatsapp_integration_settings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...payload, base_url: DEFAULT_UAZAPI_BASE_URL }),
      });
    }
    cached = null; // invalida cache
    return res.ok;
  } catch (err) {
    console.warn("[uazapiConfig] saveInstanceToDb:", err instanceof Error ? err.message : err);
    return false;
  }
}
