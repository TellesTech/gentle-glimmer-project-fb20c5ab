import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinData = encoder.encode(pin);
  const combined = new Uint8Array(salt.length + pinData.length);
  combined.set(salt);
  combined.set(pinData, salt.length);
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return `${saltBase64}:${hashBase64}`;
}

function generatePassword(name: string): string {
  const cleanName = name.replace(/[^a-zA-Z]/g, '').slice(0, 8) || 'Client';
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${cleanName}@${digits}`;
}

// Throws if email belongs to an internal WEES collaborator (has a row in public.profiles
// linked to user_roles). Prevents linking a client contact to a collaborator's auth user,
// which would let editing the client PIN affect the collaborator login flow.
async function ensureNotInternalCollaborator(supabaseAdmin: any, email: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profile?.id) return;

  const { data: role } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (role) {
    throw new Error(
      'Este e-mail já é usado por um colaborador interno da WEES. Use um e-mail exclusivo do cliente.'
    );
  }
}

async function provisionAuthUser(
  supabaseAdmin: any,
  contactId: string,
  name: string,
  email: string,
  existingUserId: string | null
): Promise<string> {
  if (existingUserId) return existingUserId;

  await ensureNotInternalCollaborator(supabaseAdmin, email);

  const password = generatePassword(name);

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, is_client: true },
  });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === email);
      if (existing) {
        // Re-check: existing auth user may be a collaborator
        await ensureNotInternalCollaborator(supabaseAdmin, email);
        await supabaseAdmin.from('company_contacts').update({ user_id: existing.id }).eq('id', contactId);
        console.log('Linked existing auth user:', existing.id);
        return existing.id;
      }
      throw new Error('User exists but could not be found');
    }
    throw new Error(`Failed to create user: ${authError.message}`);
  }

  await supabaseAdmin.from('company_contacts').update({ user_id: authData.user.id }).eq('id', contactId);
  console.log('Created auth user:', authData.user.id);
  return authData.user.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, siteId, name, email, pin } = await req.json();

    if (!companyId || !name || !email || !pin) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: companyId, name, email, pin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN deve ter exatamente 4 dígitos numéricos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if contact already exists for this company
    const { data: existing } = await supabaseAdmin
      .from('company_contacts')
      .select('id, user_id')
      .eq('company_id', companyId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      // Update existing contact's PIN
      const pinHash = await hashPin(pin);
      await supabaseAdmin
        .from('company_contacts')
        .update({ pin_hash: pinHash, name })
        .eq('id', existing.id);

      // Link to site if provided
      if (siteId) {
        await supabaseAdmin
          .from('contact_sites')
          .upsert({ contact_id: existing.id, site_id: siteId }, { onConflict: 'contact_id,site_id' })
          .select();
      }

      // Provision auth user if not yet linked
      const userId = await provisionAuthUser(supabaseAdmin, existing.id, name, email.toLowerCase(), existing.user_id);

      return new Response(
        JSON.stringify({ success: true, contactId: existing.id, updated: true, userId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new contact
    const pinHash = await hashPin(pin);
    const { data: newContact, error: insertError } = await supabaseAdmin
      .from('company_contacts')
      .insert({
        company_id: companyId,
        name,
        email: email.toLowerCase(),
        pin_hash: pinHash,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao cadastrar contato' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link to site if provided
    if (siteId && newContact) {
      await supabaseAdmin
        .from('contact_sites')
        .insert({ contact_id: newContact.id, site_id: siteId });
    }

    // Provision auth user
    const userId = await provisionAuthUser(supabaseAdmin, newContact.id, name, email.toLowerCase(), null);

    console.log('Contact registered:', newContact.id);
    return new Response(
      JSON.stringify({ success: true, contactId: newContact.id, created: true, userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in register-client-contact:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
