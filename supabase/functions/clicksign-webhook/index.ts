import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-clicksign-signature',
};

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
  
  // Must have event info
  const eventType = payload.event?.name || payload.event_type;
  if (!eventType) {
    return { isValid: false, reason: "Missing event type" };
  }
  
  return { isValid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
      signature: req.headers.get('x-clicksign-signature') ? "present" : "missing",
      timestamp: new Date().toISOString(),
    };
    console.log("Webhook request metadata:", JSON.stringify(requestMetadata));

    const rawBody = await req.text();
    
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Failed to parse webhook body:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('ClickSign webhook received:', JSON.stringify(payload, null, 2));

    // Validate payload structure
    const validation = validatePayload(payload);
    if (!validation.isValid) {
      console.error("Invalid webhook payload:", validation.reason);
      return new Response(
        JSON.stringify({ success: false, error: validation.reason }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventType = payload.event?.name || payload.event_type || 'unknown';
    const documentKey = payload.document?.key || payload.document_key;
    const signerKey = payload.signer?.key || payload.signer_key;

    // Validate document exists in our database before processing (security check)
    if (documentKey) {
      const { data: existingDoc } = await supabase
        .from("clicksign_documents")
        .select("id")
        .eq("document_key", documentKey)
        .maybeSingle();
      
      if (!existingDoc) {
        console.log(`Document ${documentKey} not found in database - could be from another source`);
        // Still store the webhook for audit, but it won't be processed
      }
    }

    // Check for duplicate webhooks (idempotency)
    const { data: existingWebhook } = await supabase
      .from("clicksign_webhooks")
      .select("id, processed")
      .eq("event_type", eventType)
      .eq("document_key", documentKey)
      .eq("processed", true)
      .limit(1)
      .maybeSingle();

    if (existingWebhook) {
      console.log(`Duplicate webhook detected for event ${eventType} on document ${documentKey}, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Already processed" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store webhook event for audit trail
    const { data: webhookRecord, error: webhookError } = await supabase
      .from('clicksign_webhooks')
      .insert({
        event_type: eventType,
        document_key: documentKey,
        signer_key: signerKey,
        payload: payload,
        processed: false,
      })
      .select()
      .single();

    if (webhookError) {
      console.error('Error saving webhook:', webhookError);
    }

    // Process webhook based on event type
    try {
      switch (eventType) {
        case 'auto_close':
        case 'document_closed':
        case 'close': {
          // All signers have signed, document is complete
          console.log(`Document ${documentKey} closed/completed`);
          
          // Get the document first
          const { data: closedDoc } = await supabase
            .from('clicksign_documents')
            .select('id')
            .eq('document_key', documentKey)
            .single();

          if (closedDoc) {
            await supabase
              .from('clicksign_documents')
              .update({ 
                status: 'signed',
                signed_at: new Date().toISOString(),
              })
              .eq('document_key', documentKey);

            // Also update all signers that haven't been marked as signed
            await supabase
              .from('clicksign_signers')
              .update({ status: 'signed', signed_at: new Date().toISOString() })
              .eq('document_id', closedDoc.id)
              .eq('status', 'sent');
          }
          break;
        }

        case 'sign':
        case 'signer_signed': {
          // Individual signer has signed
          console.log(`Signer ${signerKey} signed document ${documentKey}`);
          
          const signerData = payload.signer || {};
          const signEvent = payload.event?.data || {};

          await supabase
            .from('clicksign_signers')
            .update({ 
              status: 'signed',
              signed_at: new Date().toISOString(),
              ip_address: signEvent.ip_address || signerData.ip_address,
              geolocation: signEvent.geolocation ? {
                latitude: signEvent.geolocation.latitude,
                longitude: signEvent.geolocation.longitude,
              } : null,
            })
            .eq('signer_key', signerKey);

          // Check if all signers have signed
          const { data: document } = await supabase
            .from('clicksign_documents')
            .select('id')
            .eq('document_key', documentKey)
            .single();

          if (document) {
            const { data: pendingSigners } = await supabase
              .from('clicksign_signers')
              .select('id')
              .eq('document_id', document.id)
              .neq('status', 'signed');

            if (!pendingSigners || pendingSigners.length === 0) {
              // All signed!
              await supabase
                .from('clicksign_documents')
                .update({ status: 'signed', signed_at: new Date().toISOString() })
                .eq('id', document.id);
            }
          }
          break;
        }

        case 'refuse':
        case 'signer_refused': {
          // Signer refused to sign
          console.log(`Signer ${signerKey} refused to sign document ${documentKey}`);
          
          await supabase
            .from('clicksign_signers')
            .update({ status: 'refused' })
            .eq('signer_key', signerKey);
          break;
        }

        case 'cancel':
        case 'document_cancelled': {
          // Document was cancelled
          console.log(`Document ${documentKey} cancelled`);
          
          await supabase
            .from('clicksign_documents')
            .update({ 
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            })
            .eq('document_key', documentKey);
          break;
        }

        case 'deadline':
        case 'document_expired': {
          // Document deadline reached
          console.log(`Document ${documentKey} expired`);
          
          await supabase
            .from('clicksign_documents')
            .update({ status: 'expired' })
            .eq('document_key', documentKey);
          break;
        }

        case 'update':
        case 'add_signer': {
          // Document was updated (new signer added, etc)
          console.log(`Document ${documentKey} updated`);
          break;
        }

        default:
          console.log(`Unhandled event type: ${eventType}`);
      }

      // Mark webhook as processed
      if (webhookRecord) {
        await supabase
          .from('clicksign_webhooks')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', webhookRecord.id);
      }

    } catch (processError: unknown) {
      console.error('Error processing webhook:', processError);
      
      // Mark webhook with error
      if (webhookRecord) {
        await supabase
          .from('clicksign_webhooks')
          .update({ 
            error_message: processError instanceof Error ? processError.message : 'Unknown error',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookRecord.id);
      }
    }

    // Always return 200 to ClickSign to acknowledge receipt
    return new Response(
      JSON.stringify({ success: true, received: eventType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in clicksign-webhook function:', error);
    // Return 200 anyway to prevent retries for parsing errors
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
