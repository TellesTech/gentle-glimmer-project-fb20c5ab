import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Salva (ou remove) a assinatura do cliente autenticado.
 * Procura primeiro em company_contacts (pelo user_id) e depois em
 * client_profiles (pelo e-mail do usuário).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const signatureData: string | null = body?.signatureData ?? null;
    const remove = body?.remove === true;

    if (!remove) {
      if (typeof signatureData !== 'string' || signatureData.length < 20 || signatureData.length > 3_000_000) {
        return new Response(
          JSON.stringify({ error: 'Assinatura inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const value = remove ? null : signatureData;

    const { data: contact } = await admin
      .from('company_contacts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (contact) {
      const { error } = await admin
        .from('company_contacts')
        .update({ signature_data: value, updated_at: new Date().toISOString() })
        .eq('id', contact.id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, source: 'company_contacts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const email = (user.email || '').toLowerCase().trim();
    if (email) {
      const { data: clientProfile } = await admin
        .from('client_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (clientProfile) {
        const { error } = await admin
          .from('client_profiles')
          .update({ signature_data: value, updated_at: new Date().toISOString() })
          .eq('id', clientProfile.id);
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, source: 'client_profiles' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Perfil de cliente não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in save-client-signature:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
