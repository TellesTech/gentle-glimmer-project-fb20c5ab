import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_INSTANCE_TOKEN') || Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!instanceId || !token) {
      return new Response(JSON.stringify({ error: 'ZAPI credentials not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) baseHeaders['Client-Token'] = clientToken;

    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook`;

    // 1. Check current webhook config
    const webhookRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/webhook`,
      { headers: baseHeaders }
    );
    const webhookData = await webhookRes.json();
    console.log('Current webhook config:', JSON.stringify(webhookData));

    const receivedUrl = webhookData?.webhookReceived?.webhookUrl || webhookData?.receivedUrl || '';
    const deliveryUrl = webhookData?.webhookDelivery?.webhookUrl || webhookData?.deliveryUrl || '';

    const needsFix = !receivedUrl || !deliveryUrl
      || receivedUrl === 'NOT_FOUND' || deliveryUrl === 'NOT_FOUND'
      || !receivedUrl.includes('zapi-webhook') || !deliveryUrl.includes('zapi-webhook');

    let logStatus = 'ok';
    let logDetails: Record<string, unknown> = { webhookData };

    if (needsFix) {
      console.log('Webhooks broken — reconfiguring...');

      const [everyRes, recvRes, delRes] = await Promise.all([
        fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/update-every-webhooks`, {
          method: 'PUT', headers: baseHeaders, body: JSON.stringify({ value: expectedWebhookUrl }),
        }),
        fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/update-webhook-received`, {
          method: 'PUT', headers: baseHeaders, body: JSON.stringify({ value: expectedWebhookUrl }),
        }),
        fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/update-webhook-delivery`, {
          method: 'PUT', headers: baseHeaders, body: JSON.stringify({ value: expectedWebhookUrl }),
        }),
      ]);

      const [everyData, recvData, delData] = await Promise.all([
        everyRes.json(), recvRes.json(), delRes.json(),
      ]);

      logStatus = 'fixed';
      logDetails = { previous: webhookData, everyResult: everyData, receivedResult: recvData, deliveryResult: delData };
      console.log('Webhooks reconfigured successfully');
    } else {
      console.log('Webhooks OK — no action needed');
    }

    // 2. Expire stale pending_photo entries (older than 2 hours) and send WhatsApp feedback
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: expiredEntries, error: expireError } = await supabase
      .from('whatsapp_rdo_logs')
      .update({ status: 'expired' })
      .eq('status', 'pending_photo')
      .lt('created_at', twoHoursAgo)
      .select('id, group_id');

    if (expireError) {
      console.error('Error expiring pending_photo:', expireError.message);
    } else {
      const expiredCount = expiredEntries?.length || 0;
      if (expiredCount > 0) {
        console.log(`Expired ${expiredCount} stale pending_photo entries`);
        logDetails.expiredPendingPhotos = expiredCount;
        
        // Send feedback to unique groups that had photos expire
        const uniqueGroups = new Set(expiredEntries?.map((e: any) => e.group_id).filter(Boolean));
        if (uniqueGroups.size > 0 && instanceId && token) {
          console.log(`Sending expiration feedback to ${uniqueGroups.size} groups`);
          const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-message`;
          for (const groupId of uniqueGroups) {
            try {
              const res = await fetch(baseUrl, {
                method: 'POST',
                headers: baseHeaders,
                body: JSON.stringify({
                  phone: groupId,
                  message: '📸 Foto recebida sem texto de RDO. Reenvie a foto junto com o texto do relatório para que seja processada corretamente.',
                }),
              });
              if (!res.ok) {
                console.warn(`Failed to send feedback to ${groupId}: ${res.status}`);
              } else {
                console.log(`Sent expiration feedback to ${groupId}`);
              }
            } catch (err) {
              console.error(`Error sending feedback to ${groupId}:`, err);
            }
          }
        }
      }
    }

    // 3. Log result
    await supabase.from('whatsapp_health_logs').insert({
      status: logStatus,
      details: logDetails,
    });

    return new Response(JSON.stringify({ status: logStatus, needsFix, details: logDetails }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Log error
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabase.from('whatsapp_health_logs').insert({
        status: 'error',
        details: { error: error.message },
      });
    } catch (_) { /* ignore logging errors */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
