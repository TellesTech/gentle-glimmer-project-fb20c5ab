import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message, stack, path, userId, userAgent, extra, componentStack, timestamp } = body;

    if (!message || !path) {
      return new Response(
        JSON.stringify({ error: 'message and path are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Best-effort insert — never return 500 to avoid cascade on client
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: insertError } = await supabase
        .from('app_client_errors')
        .insert({
          user_id: userId || null,
          path,
          message,
          stack: stack || null,
          user_agent: userAgent || null,
          extra: {
            componentStack: componentStack || null,
            timestamp: timestamp || new Date().toISOString(),
            ...extra,
          },
        });

      if (insertError) {
        console.error('DB insert failed (non-fatal):', insertError.message);
      }
    } catch (dbErr) {
      console.error('DB connection failed (non-fatal):', dbErr);
    }

    // Always return success to the client
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in log-client-error function:', error);
    return new Response(
      JSON.stringify({ success: true, note: 'logged with errors' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
