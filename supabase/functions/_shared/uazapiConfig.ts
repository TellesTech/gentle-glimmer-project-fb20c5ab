// Resolve a configuração de runtime da integração UAZAPI.
// Ordem de prioridade: banco (whatsapp_integration_settings) -> env -> padrão.

export const DEFAULT_UAZAPI_BASE_URL = "https://chatwees.uazapi.com";

export interface UazapiRuntimeConfig {
  baseUrl: string;
  webhookUrl: string | null;
  webhookEvents: string[];
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

export type UazapiTokenSource = "instance" | "admin";

export interface UazapiTokenInfo {
  token: string | null;
  source: UazapiTokenSource | null;
  instanceTokenMasked: string | null;
  adminTokenMasked: string | null;
}

function mask(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.length > 6 ? `••••${value.slice(-6)}` : "••••";
}

// Resolve o token UAZAPI na ordem: instance token -> admin token.
export function getUazapiToken(): UazapiTokenInfo {
  const instanceToken = (Deno.env.get("UAZAPI_INSTANCE_TOKEN") || "").trim();
  const adminToken = (Deno.env.get("UAZAPI_TOKEN") || "").trim();
  return {
    token: instanceToken || adminToken || null,
    source: instanceToken ? "instance" : adminToken ? "admin" : null,
    instanceTokenMasked: mask(instanceToken),
    adminTokenMasked: mask(adminToken),
  };
}

export async function getUazapiConfig(): Promise<UazapiRuntimeConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const envBase = sanitizeBaseUrl(Deno.env.get("UAZAPI_BASE_URL"));
  const fallback: UazapiRuntimeConfig = {
    baseUrl: envBase || DEFAULT_UAZAPI_BASE_URL,
    webhookUrl: null,
    webhookEvents: ["messages", "messages_update", "connection"],
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
    };
    cached = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn("[uazapiConfig] fallback:", err instanceof Error ? err.message : err);
    return fallback;
  }
}
