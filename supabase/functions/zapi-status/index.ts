import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_INSTANCE_TOKEN') || Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!instanceId || !token) {
      return new Response(JSON.stringify({ error: 'ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) baseHeaders['Client-Token'] = clientToken;

    const mask = (v: string | undefined) => v ? `${v.substring(0, 6)}...${v.substring(v.length - 4)} (len=${v.length})` : 'NONE';
    console.log('DEBUG zapi-status secrets:', JSON.stringify({
      ZAPI_INSTANCE_ID: mask(instanceId),
      ZAPI_INSTANCE_TOKEN: mask(Deno.env.get('ZAPI_INSTANCE_TOKEN')),
      ZAPI_TOKEN_legacy: mask(Deno.env.get('ZAPI_TOKEN')),
      using_token: mask(token),
      ZAPI_CLIENT_TOKEN: mask(clientToken),
    }));

    // POST: configure webhook URL using update-every-webhooks (sets all at once)
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const webhookUrl = body.webhookUrl || `${Deno.env.get('SUPABASE_URL')}/functions/v1/zapi-webhook`;

      // Use update-every-webhooks to set all webhook URLs at once
      const everyRes = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/update-every-webhooks`,
        { method: 'PUT', headers: baseHeaders, body: JSON.stringify({ value: webhookUrl }) }
      );
      const everyData = await everyRes.json();
      console.log('update-every-webhooks response:', JSON.stringify(everyData));

      // Also set received specifically
      const receivedRes = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/update-webhook-received`,
        { method: 'PUT', headers: baseHeaders, body: JSON.stringify({ value: webhookUrl }) }
      );
      const receivedData = await receivedRes.json();
      console.log('update-webhook-received response:', JSON.stringify(receivedData));

      // Set delivery webhook
      const deliveryRes = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/update-webhook-delivery`,
        { method: 'PUT', headers: baseHeaders, body: JSON.stringify({ value: webhookUrl }) }
      );
      const deliveryData = await deliveryRes.json();
      console.log('update-webhook-delivery response:', JSON.stringify(deliveryData));

      return new Response(JSON.stringify({
        action: 'webhook_configured',
        webhookUrl,
        updateEveryResult: everyData,
        updateReceivedResult: receivedData,
        updateDeliveryResult: deliveryData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET: check instance status + webhook config, optionally list groups
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'qr-code') {
      const qrRes = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`,
        { headers: baseHeaders }
      );
      const qrData = await qrRes.json();
      console.log('qr-code response status:', qrRes.status);
      return new Response(JSON.stringify(qrData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-groups') {
      const allGroups: any[] = [];
      let page = 1;
      const pageSize = 100;
      while (true) {
        const groupsUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/groups?page=${page}&pageSize=${pageSize}`;
        console.log(`Fetching groups page ${page}...`);
        const groupsRes = await fetch(groupsUrl, { headers: baseHeaders });
        const groupsData = await groupsRes.json();
        const pageItems = Array.isArray(groupsData) ? groupsData : [];
        allGroups.push(...pageItems);
        if (pageItems.length < pageSize) break;
        page++;
        if (page > 50) break; // safety limit
      }
      console.log(`Total groups fetched: ${allGroups.length}`);
      const groups = allGroups.map((g: any) => ({ id: g.phone || g.id, name: g.subject || g.name || 'Sem nome' }));
      return new Response(JSON.stringify({ groups }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const statusUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
    const statusResponse = await fetch(statusUrl, { headers: baseHeaders });
    const statusData = await statusResponse.json();

    const webhookUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/webhook`;
    const webhookResponse = await fetch(webhookUrl, { headers: baseHeaders });
    const webhookData = await webhookResponse.json();

    // Diagnóstico do formato do token
    const acceptedTokenLengths = [23, 24];
    const tokenLooksLikeInstanceId = !!(token && instanceId && token === instanceId);
    const tokenLooksLikeUrl = !!(token && /^https?:\/\//i.test(token));
    const tokenLengthInvalid = !!(token && !acceptedTokenLengths.includes(token.length));
    const credentialsValid = !tokenLooksLikeInstanceId && !tokenLooksLikeUrl && !tokenLengthInvalid;

    const data = {
      status: statusData,
      webhookConfig: webhookData,
      connected: statusData?.connected,
      smartPhoneConnected: statusData?.smartphoneConnected,
      diagnostics: {
        credentialsValid,
        tokenLooksLikeInstanceId,
        tokenLooksLikeUrl,
        tokenLengthInvalid,
        tokenLength: token?.length || 0,
        expectedTokenLength: acceptedTokenLengths.join(' ou '),
        instanceIdLength: instanceId?.length || 0,
      },
    };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
