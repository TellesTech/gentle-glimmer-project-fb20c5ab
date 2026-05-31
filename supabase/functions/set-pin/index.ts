import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash PIN using Web Crypto API (compatible with Edge Runtime)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinData = encoder.encode(pin);
  
  // Combine salt and pin
  const combined = new Uint8Array(salt.length + pinData.length);
  combined.set(salt);
  combined.set(pinData, salt.length);
  
  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Encode salt and hash as base64 for storage
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  return `${saltBase64}:${hashBase64}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin, contactId } = await req.json();

    // Validate PIN format (4 digits)
    if (!pin || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN deve ter exatamente 4 dígitos numéricos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the PIN using Web Crypto API
    const pinHash = await hashPin(pin);

    // Create admin client to update the correct table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (contactId) {
      // Save directly to company_contacts table
      const { error: updateError } = await supabaseAdmin
        .from('company_contacts')
        .update({ pin_hash: pinHash })
        .eq('id', contactId);

      if (updateError) {
        console.error('Update error (company_contacts):', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao salvar PIN' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('PIN set successfully for contact:', contactId);
    } else {
      // Original behavior: save to profiles table for authenticated user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        console.error('User error:', userError);
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ pin_hash: pinHash })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error (profiles):', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao salvar PIN' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('PIN set successfully for user:', user.id);
    }

    return new Response(
      JSON.stringify({ success: true, pin_hash: pinHash, message: 'PIN configurado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in set-pin:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});