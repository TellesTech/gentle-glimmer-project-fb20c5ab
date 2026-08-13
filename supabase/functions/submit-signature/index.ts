import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createServiceClient, ensureAccessRecord, finalizeApproval, SignatureAuthError, verifySigner } from "../_shared/signature-auth.ts";

const BodySchema = z.object({
  accessToken: z.string().uuid().optional(),
  reportId: z.string().uuid(),
  signatureData: z.string().min(20).max(3_000_000),
  documentHash: z.string().max(255).optional().nullable(),
  documentVersion: z.string().max(100).optional().nullable(),
  geolocation: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().nonnegative().optional() }).optional().nullable(),
}).strict();

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonResponse({ error: "Dados da assinatura inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    const { accessToken, reportId, signatureData, documentHash, documentVersion, geolocation } = parsed.data;
    const service = createServiceClient();
    const signer = await verifySigner(req, service, reportId, accessToken);
    const accessId = await ensureAccessRecord(service, reportId, signer);

    let duplicateQuery = service.from("report_signatures").select("id").eq("report_id", reportId);
    if (signer.userId) duplicateQuery = duplicateQuery.eq("signer_user_id", signer.userId);
    else if (signer.email) duplicateQuery = duplicateQuery.ilike("signer_email", signer.email);
    else duplicateQuery = duplicateQuery.eq("access_id", accessId);
    const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
    if (duplicateError) throw new SignatureAuthError("Não foi possível verificar assinaturas anteriores", 500);
    if (duplicate) throw new SignatureAuthError("Este RDO já foi assinado por você", 409);

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const { data: signature, error: signatureError } = await service.from("report_signatures").insert({
      report_id: reportId, access_id: accessId, signature_data: signatureData,
      signer_name: signer.name, signer_role: signer.role, signer_email: signer.email, signer_user_id: signer.userId,
      document_hash: documentHash || null, document_version: documentVersion || null, geolocation: geolocation || null,
      ip_address: ipAddress, user_agent: userAgent, legal_basis: "MP 2.200-2/2001",
    }).select("id,signed_at,signer_name").single();
    if (signatureError || !signature) {
      console.error("Error inserting verified signature:", signatureError);
      throw new SignatureAuthError("Não foi possível salvar a assinatura", 500);
    }

    const { error: auditError } = await service.from("signature_audit_log").insert({
      signature_id: signature.id, action: "created", actor_id: signer.userId, actor_email: signer.email,
      ip_address: ipAddress, user_agent: userAgent,
      details: { signer_kind: signer.kind, document_hash: documentHash || null, document_version: documentVersion || null, geolocation: geolocation || null, legal_basis: "MP 2.200-2/2001" },
    });
    if (auditError) console.error("Signature saved but audit log failed:", auditError);
    await finalizeApproval(service, reportId, signer, signature.signed_at || new Date().toISOString());
    console.log("Verified signature saved:", signature.id, signer.kind);
    return jsonResponse({ success: true, signature: { id: signature.id, signedAt: signature.signed_at, signerName: signature.signer_name } });
  } catch (error) {
    if (error instanceof SignatureAuthError) return jsonResponse({ error: error.message }, error.status);
    console.error("Unexpected submit-signature error:", error);
    return jsonResponse({ error: "Erro interno ao processar a assinatura" }, 500);
  }
});