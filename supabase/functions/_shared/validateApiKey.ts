// Shared helper para edge functions consumidas externamente via header `x-api-key`.
// Uso:
//   import { validateApiKey } from "../_shared/validateApiKey.ts";
//   const auth = await validateApiKey(req, ["read:reports"]);
//   if (!auth.ok) return auth.response;
//   // auth.scopes disponível

import { createClient } from "npm:@supabase/supabase-js@2";

export interface ApiKeyAuthOk {
  ok: true;
  id: string;
  scopes: string[];
}
export interface ApiKeyAuthFail {
  ok: false;
  response: Response;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

export async function validateApiKey(
  req: Request,
  requiredScopes: string[] = [],
): Promise<ApiKeyAuthOk | ApiKeyAuthFail> {
  const key = req.headers.get("x-api-key") ?? "";
  if (!key) {
    return { ok: false, response: new Response(JSON.stringify({ error: "missing x-api-key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { data, error } = await admin.rpc("validate_api_key", { _key: key, _ip: ip });
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return { ok: false, response: new Response(JSON.stringify({ error: "invalid api key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const scopes: string[] = row.scopes ?? [];

  if (requiredScopes.length && !requiredScopes.every((s) => scopes.includes(s))) {
    return { ok: false, response: new Response(JSON.stringify({ error: "insufficient scope" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }

  return { ok: true, id: row.id, scopes };
}
