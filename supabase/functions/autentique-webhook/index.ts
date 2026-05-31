import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

// In-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

// Validate webhook payload structure
function validatePayload(payload: any): { isValid: boolean; reason?: string } {
  if (!payload || typeof payload !== "object") {
    return { isValid: false, reason: "Payload is not an object" };
  }
  
  // Extract event type - must have some form of event identifier
  const eventType = payload.event || payload.type;
  if (!eventType) {
    return { isValid: false, reason: "Missing event type" };
  }
  
  return { isValid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    console.warn("Rate limit exceeded for IP:", clientIp);
    return new Response(
      JSON.stringify({ success: false, error: "Too many requests" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Log request metadata for audit
  const requestMetadata = {
    userAgent: req.headers.get("user-agent"),
    contentType: req.headers.get("content-type"),
    timestamp: new Date().toISOString(),
  };
  console.log("Webhook request metadata:", JSON.stringify(requestMetadata));

  try {
    const payload = await req.json();
    console.log("Autentique webhook received:", JSON.stringify(payload));

    // Validate payload structure
    const validation = validatePayload(payload);
    if (!validation.isValid) {
      console.error("Invalid webhook payload:", validation.reason);
      return new Response(
        JSON.stringify({ success: false, error: validation.reason }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract event info from Autentique webhook
    // Autentique sends events like: document.signed, document.rejected, etc.
    const eventType = payload.event || payload.type || "unknown";
    const documentId = payload.document?.id || payload.data?.document?.id;
    const signerId = payload.signature?.public_id || payload.data?.signature?.public_id;

    // Validate document exists in our database before processing (security check)
    if (documentId) {
      const { data: existingDoc } = await supabase
        .from("autentique_documents")
        .select("id")
        .eq("document_id", documentId)
        .maybeSingle();
      
      if (!existingDoc) {
        console.log(`Document ${documentId} not found in database - could be from another source`);
        // Still store the webhook for audit, but mark as unprocessable
      }
    }

    // Check for duplicate webhooks (idempotency)
    const payloadHash = JSON.stringify({ eventType, documentId, signerId });
    const { data: existingWebhook } = await supabase
      .from("autentique_webhooks")
      .select("id, processed")
      .eq("event_type", eventType)
      .eq("document_id", documentId)
      .eq("processed", true)
      .limit(1)
      .maybeSingle();

    if (existingWebhook) {
      console.log(`Duplicate webhook detected for event ${eventType} on document ${documentId}, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store webhook in database
    const { data: webhookData, error: webhookError } = await supabase
      .from("autentique_webhooks")
      .insert({
        event_type: eventType,
        document_id: documentId,
        signer_id: signerId,
        payload: payload,
        processed: false,
      })
      .select()
      .single();

    if (webhookError) {
      console.error("Error storing webhook:", webhookError);
    }

    // Process the webhook
    try {
      await processWebhook(supabase, eventType, payload, documentId, signerId);

      // Mark as processed
      if (webhookData) {
        await supabase
          .from("autentique_webhooks")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", webhookData.id);
      }
    } catch (processError: unknown) {
      console.error("Error processing webhook:", processError);
      const errorMessage = processError instanceof Error ? processError.message : "Erro desconhecido";
      
      if (webhookData) {
        await supabase
          .from("autentique_webhooks")
          .update({ error_message: errorMessage })
          .eq("id", webhookData.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fetch signed document URL from Autentique API using GraphQL variables
async function fetchSignedDocumentUrl(documentId: string): Promise<string | null> {
  const AUTENTIQUE_API_TOKEN = Deno.env.get("AUTENTIQUE_API_TOKEN");
  if (!AUTENTIQUE_API_TOKEN) {
    console.error("AUTENTIQUE_API_TOKEN not configured");
    return null;
  }

  try {
    // Use GraphQL variables to prevent injection
    const query = `
      query GetSignedDocument($id: UUID!) {
        document(id: $id) {
          files {
            signed
          }
        }
      }
    `;

    const response = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AUTENTIQUE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { id: documentId } }),
    });

    const result = await response.json();
    console.log("Fetched signed document URL:", JSON.stringify(result));

    if (result.data?.document?.files?.signed) {
      return result.data.document.files.signed;
    }
  } catch (error) {
    console.error("Error fetching signed document URL:", error);
  }

  return null;
}

async function processWebhook(
  supabase: any,
  eventType: string,
  payload: any,
  documentId: string | undefined,
  signerId: string | undefined
) {
  if (!documentId) {
    console.log("No document ID in webhook, skipping processing");
    return;
  }

  // Find the document in our database
  const { data: doc } = await supabase
    .from("autentique_documents")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();

  if (!doc) {
    console.log(`Document ${documentId} not found in database`);
    return;
  }

  // Handle different event types
  switch (eventType) {
    case "document.signed":
    case "signature.signed":
    case "auto_close":
      // A signer has signed
      if (signerId) {
        const signatureData = payload.signature || payload.data?.signature;
        await supabase
          .from("autentique_signers")
          .update({
            status: "signed",
            signed_at: signatureData?.signed?.created_at || new Date().toISOString(),
            ip_address: signatureData?.signed?.ip_address,
          })
          .eq("signer_id", signerId);
      }

      // Check if all signers have signed (only if we have signers)
      const { data: signers } = await supabase
        .from("autentique_signers")
        .select("status")
        .eq("document_id", doc.id);

      // Only mark as signed if there are signers and all have signed
      const allSigned = signers && signers.length > 0 && signers.every((s: any) => s.status === "signed");
      if (allSigned) {
        console.log("All signers have signed, fetching signed document URL...");
        
        // Fetch the signed document URL from Autentique API
        const signedFileUrl = await fetchSignedDocumentUrl(documentId);
        console.log("Signed file URL:", signedFileUrl);

        // Update document with signed status and URL
        const updateData: any = { 
          status: "signed", 
          signed_at: new Date().toISOString() 
        };
        
        if (signedFileUrl) {
          updateData.signed_file_url = signedFileUrl;
        }

        await supabase
          .from("autentique_documents")
          .update(updateData)
          .eq("id", doc.id);

        // Update the report status to 'signed'
        console.log(`Updating report ${doc.report_id} status to 'signed'`);
        await supabase
          .from("reports")
          .update({ status: "signed" })
          .eq("id", doc.report_id);

        // Also add to report_signatures for the main system
        const { data: signersData } = await supabase
          .from("autentique_signers")
          .select("*")
          .eq("document_id", doc.id);

        for (const signer of signersData || []) {
          // Check if signature already exists by signer_name to avoid duplicates
          // across different documents for the same report
          const { data: existing } = await supabase
            .from("report_signatures")
            .select("id")
            .eq("report_id", doc.report_id)
            .eq("signer_name", signer.name)
            .maybeSingle();

          if (!existing) {
            console.log(`Inserting signature for ${signer.name} on report ${doc.report_id}`);
            await supabase
              .from("report_signatures")
              .insert({
                report_id: doc.report_id,
                signer_name: signer.name,
                signer_role: "Cliente",
                signature_data: `autentique:${signer.signer_id}`,
                ip_address: signer.ip_address,
                signed_at: signer.signed_at,
              });
          } else {
            console.log(`Signature already exists for ${signer.name} on report ${doc.report_id}, skipping`);
          }
        }
      }
      break;

    case "document.rejected":
    case "signature.rejected":
      // Signer rejected
      if (signerId) {
        await supabase
          .from("autentique_signers")
          .update({
            status: "rejected",
          })
          .eq("signer_id", signerId);

        await supabase
          .from("autentique_documents")
          .update({ status: "rejected" })
          .eq("id", doc.id);
      }
      break;

    case "document.cancelled":
    case "document.deleted":
      await supabase
        .from("autentique_documents")
        .update({ 
          status: "cancelled", 
          cancelled_at: new Date().toISOString() 
        })
        .eq("id", doc.id);
      break;

    case "signature.viewed":
      // Signer viewed the document
      if (signerId) {
        await supabase
          .from("autentique_signers")
          .update({ status: "viewed" })
          .eq("signer_id", signerId)
          .eq("status", "pending"); // Only update if still pending
      }
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
}
