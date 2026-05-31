import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      accessToken, 
      reportId,
      signatureData, 
      signerName, 
      signerRole,
      signerEmail,
      signerUserId,
      documentHash,
      documentVersion,
      geolocation,
    } = await req.json();
    
    if ((!accessToken && !reportId) || !signatureData || !signerName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: (accessToken or reportId), signatureData, signerName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Submitting signature. accessToken:', !!accessToken, 'reportId:', !!reportId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let accessData: any = null;

    if (accessToken) {
      // Validate the access token
      const { data, error: accessError } = await supabase
        .from('client_report_access')
        .select('*')
        .eq('access_token', accessToken)
        .single();

      if (accessError || !data) {
        console.error('Access token not found:', accessError);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired access link' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if link has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'This access link has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessData = data;
    } else {
      // Authenticated client flow: find or create access record by reportId + signerEmail
      if (!signerEmail) {
        return new Response(
          JSON.stringify({ error: 'signerEmail is required when using reportId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedEmail = signerEmail.toLowerCase().trim();

      // Try to find existing access record for this report+email
      const { data: existingAccess } = await supabase
        .from('client_report_access')
        .select('*')
        .eq('report_id', reportId)
        .ilike('client_email', normalizedEmail)
        .maybeSingle();

      if (existingAccess) {
        accessData = existingAccess;
      } else {
        // Create a new access record for the authenticated client
        const { data: newAccess, error: createErr } = await supabase
          .from('client_report_access')
          .insert({
            report_id: reportId,
            client_name: signerName,
            client_email: normalizedEmail,
          })
          .select()
          .single();

        if (createErr || !newAccess) {
          console.error('Failed to create access record:', createErr);
          return new Response(
            JSON.stringify({ error: 'Failed to register signature access' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        accessData = newAccess;
      }
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Check if already signed via this access record
    const { data: existingSignature } = await supabase
      .from('report_signatures')
      .select('id')
      .eq('access_id', accessData.id)
      .maybeSingle();

    if (existingSignature) {
      return new Response(
        JSON.stringify({ error: 'This report has already been signed by you' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also check by email to prevent duplicates from authenticated clients
    if (signerEmail) {
      const { data: emailSig } = await supabase
        .from('report_signatures')
        .select('id')
        .eq('report_id', accessData.report_id)
        .ilike('signer_email', signerEmail.toLowerCase().trim())
        .maybeSingle();

      if (emailSig) {
        return new Response(
          JSON.stringify({ error: 'This report has already been signed by you' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insert the signature with legal compliance fields
    const { data: signature, error: signatureError } = await supabase
      .from('report_signatures')
      .insert({
        report_id: accessData.report_id,
        access_id: accessData.id,
        signature_data: signatureData,
        signer_name: signerName,
        signer_role: signerRole || null,
        signer_email: signerEmail || null,
        signer_user_id: signerUserId || null,
        document_hash: documentHash || null,
        document_version: documentVersion || null,
        geolocation: geolocation || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        legal_basis: 'MP 2.200-2/2001',
      })
      .select()
      .single();

    if (signatureError) {
      console.error('Error inserting signature:', signatureError);
      return new Response(
        JSON.stringify({ error: 'Failed to save signature' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert audit log entry
    await supabase.from('signature_audit_log').insert({
      signature_id: signature.id,
      action: 'created',
      actor_id: signerUserId || null,
      actor_email: signerEmail || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: {
        document_hash: documentHash,
        document_version: documentVersion,
        geolocation: geolocation,
        legal_basis: 'MP 2.200-2/2001',
      },
    });

    console.log('Signature saved successfully:', signature.id);

    return new Response(
      JSON.stringify({
        success: true,
        signature: {
          id: signature.id,
          signedAt: signature.signed_at,
          signerName: signature.signer_name,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-signature:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
