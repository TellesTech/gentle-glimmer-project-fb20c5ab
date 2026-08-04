import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createServiceClient, ensureAccessRecord, verifySigner } from "../_shared/signature-auth.ts";

const ItemSchema = z.object({ reportId: z.string().uuid(), documentHash: z.string().max(255).optional().nullable(), documentVersion: z.string().max(100).optional().nullable() }).strict();
const BodySchema = z.object({
  items: z.array(ItemSchema).min(1).max(100), signatureData: z.string().min(20).max(3_000_000),
  geolocation: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().nonnegative().optional() }).optional().nullable(),
}).strict();
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonResponse({ error: "Dados da assinatura em lote inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    const service = createServiceClient();
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const results: Array<{ reportId: string; ok: boolean; signatureId?: string; error?: string }> = [];

    for (const item of parsed.data.items) {
      try {
        const signer = await verifySigner(req, service, item.reportId, null);
        const accessId = await ensureAccessRecord(service, item.reportId, signer);
        let duplicateQuery = service.from("report_signatures").select("id").eq("report_id", item.reportId);
        if (signer.userId) duplicateQuery = duplicateQuery.eq("signer_user_id", signer.userId);
        else if (signer.email) duplicateQuery = duplicateQuery.ilike("signer_email", signer.email);
        else duplicateQuery = duplicateQuery.eq("access_id", accessId);
        const { data: duplicate } = await duplicateQuery.maybeSingle();
        if (duplicate) { results.push({ reportId: item.reportId, ok: false, error: "Este RDO já foi assinado por você" }); continue; }

        const { data: signature, error: signatureError } = await service.from("report_signatures").insert({
          report_id: item.reportId, access_id: accessId, signature_data: parsed.data.signatureData,
          signer_name: signer.name, signer_role: signer.role, signer_email: signer.email, signer_user_id: signer.userId,
          document_hash: item.documentHash || null, document_version: item.documentVersion || null, geolocation: parsed.data.geolocation || null,
          ip_address: ipAddress, user_agent: userAgent, legal_basis: "MP 2.200-2/2001",
        }).select("id").single();
        if (signatureError || !signature) {
          console.error("Bulk signature insert failed:", item.reportId, signatureError);
          results.push({ reportId: item.reportId, ok: false, error: "Não foi possível salvar a assinatura" }); continue;
        }
        const { error: auditError } = await service.from("signature_audit_log").insert({
          signature_id: signature.id, action: "created_bulk", actor_id: signer.userId, actor_email: signer.email,
          ip_address: ipAddress, user_agent: userAgent,
          details: { signer_kind: signer.kind, document_hash: item.documentHash || null, document_version: item.documentVersion || null, geolocation: parsed.data.geolocation || null, legal_basis: "MP 2.200-2/2001" },
        });
        if (auditError) console.error("Bulk signature saved but audit failed:", auditError);
        results.push({ reportId: item.reportId, ok: true, signatureId: signature.id });
      } catch (error) {
        results.push({ reportId: item.reportId, ok: false, error: error instanceof Error ? error.message : "Erro ao processar o RDO" });
      }
    }
    const successCount = results.filter((result) => result.ok).length;
    return jsonResponse({ success: successCount > 0, successCount, results }, successCount > 0 ? 200 : 422);
  } catch (error) {
    console.error("Unexpected submit-bulk-signatures error:", error);
    return jsonResponse({ error: "Erro interno ao processar assinaturas" }, 500);
  }
});