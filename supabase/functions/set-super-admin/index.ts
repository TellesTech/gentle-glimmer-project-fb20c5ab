import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { email, secretKey, isFirstUser } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there are any existing super_admins
    const { data: existingSuperAdmins, error: checkError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('role', 'super_admin');

    if (checkError) {
      console.error('Check error:', checkError);
      throw checkError;
    }

    const hasSuperAdmins = existingSuperAdmins && existingSuperAdmins.length > 0;

    // If this is marked as first user setup AND there are no super_admins, allow without secret
    if (isFirstUser && !hasSuperAdmins) {
      console.log('First user setup - allowing without secret key');
    } else if (hasSuperAdmins) {
      // If there are already super_admins, require the secret key
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!secretKey || secretKey !== lovableApiKey) {
        return new Response(JSON.stringify({ 
          error: 'Já existe um super admin. É necessária chave de autorização para criar outro.' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Find user by email in profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ 
        error: 'Usuário não encontrado. Certifique-se de que o usuário já está registrado.' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert role to super_admin (insert if not exists, update if exists)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        { user_id: profile.id, role: 'super_admin' },
        { onConflict: 'user_id' }
      );

    if (roleError) {
      console.error('Role update error:', roleError);
      throw roleError;
    }

    console.log('User promoted to super_admin:', email);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Usuário ${profile.name} (${email}) promovido a super_admin com sucesso!`,
      userId: profile.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Set super admin error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
