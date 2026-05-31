import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  contactId: string;
  contactName: string;
  contactEmail: string;
  companyName: string;
  companyId?: string;
  pin?: string;
}

function generatePassword(companyName: string): string {
  const cleanName = companyName.replace(/[^a-zA-Z]/g, '');
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${cleanName}@${digits}`;
}


async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  
  // Concatenate salt bytes + pin bytes (same algorithm as set-pin and validate-pin)
  const combined = new Uint8Array(salt.length + pinData.length);
  combined.set(salt);
  combined.set(pinData, salt.length);
  
  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  const hashArray = new Uint8Array(hashBuffer);
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return `${saltBase64}:${hashBase64}`;
}

async function provisionAuthUser(
  supabase: any,
  contactId: string,
  contactName: string,
  contactEmail: string,
  companyName: string,
  existingUserId: string | null
): Promise<{ userId: string; password: string }> {
  const password = generatePassword(companyName);

  if (!existingUserId) {
    console.log(`[Invitation] Creating new user for ${contactEmail}`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: contactEmail,
      password,
      email_confirm: true,
      user_metadata: { name: contactName, is_client: true },
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u: any) => u.email === contactEmail);
        if (existing) {
          await supabase.auth.admin.updateUserById(existing.id, { password });
          await supabase.from("company_contacts").update({ user_id: existing.id }).eq("id", contactId);
          return { userId: existing.id, password };
        }
        throw new Error(`User exists but could not be found`);
      }
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    await supabase.from("company_contacts").update({ user_id: authData.user.id }).eq("id", contactId);
    return { userId: authData.user.id, password };
  }

  // User exists, try to reset password
  const { error: updateError } = await supabase.auth.admin.updateUserById(existingUserId, { password });

  if (updateError) {
    if (updateError.message.includes("User not found")) {
      console.log(`[Invitation] Auth user not found, recreating for ${contactEmail}`);
      const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
        email: contactEmail,
        password,
        email_confirm: true,
        user_metadata: { name: contactName, is_client: true },
      });

      if (createErr) {
        if (createErr.message.includes("already been registered")) {
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existing = existingUsers?.users?.find((u: any) => u.email === contactEmail);
          if (existing) {
            await supabase.auth.admin.updateUserById(existing.id, { password });
            await supabase.from("company_contacts").update({ user_id: existing.id }).eq("id", contactId);
            return { userId: existing.id, password };
          }
          throw new Error(`User registered but not found`);
        }
        throw new Error(`Failed to recreate user: ${createErr.message}`);
      }

      await supabase.from("company_contacts").update({ user_id: newAuth.user.id }).eq("id", contactId);
      return { userId: newAuth.user.id, password };
    }
    throw new Error(`Failed to reset password: ${updateError.message}`);
  }

  return { userId: existingUserId, password };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, contactName, contactEmail, companyName, companyId, pin: providedPin }: InvitationRequest = await req.json();

    console.log(`[Invitation] Processing invitation for ${contactName} (${contactEmail})`);

    if (!contactId || !contactName || !contactEmail || !companyName) {
      throw new Error("Missing required fields: contactId, contactName, contactEmail, companyName");
    }

    // Always use canonical domain — never use request Origin (may be preview)
    const origin = (Deno.env.get("SITE_URL") || "https://rdo.wees.com.br").replace(/\/$/, "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from("company_contacts")
      .select("user_id, pin_hash")
      .eq("id", contactId)
      .single();

    if (contactError) throw new Error(`Failed to fetch contact: ${contactError.message}`);

    // 1. PIN logic: require explicit 4-digit PIN from admin
    if (!providedPin || !/^\d{4}$/.test(providedPin)) {
      return new Response(
        JSON.stringify({ error: "PIN de 4 dígitos é obrigatório para gerar o convite" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const plainPin = providedPin;
    const pinHash = await hashPin(plainPin);
    await supabase.from("company_contacts").update({ pin_hash: pinHash }).eq("id", contactId);
    console.log(`[Invitation] PIN set for ${contactEmail}`);

    // 2. Provision auth user (email/password) in background
    const { password } = await provisionAuthUser(
      supabase, contactId, contactName, contactEmail, companyName, contact.user_id
    );

    // 3. Build login URL — login is PER UNIT (site), not per company.
    let companySlug = '';
    if (companyId) {
      const { data: companyData } = await supabase.from('companies').select('slug').eq('id', companyId).single();
      companySlug = companyData?.slug || companyId;
    }

    let siteSlug = '';
    if (contactId) {
      const { data: contactSiteData } = await supabase
        .from('contact_sites').select('site_id').eq('contact_id', contactId).limit(1).maybeSingle();
      if (contactSiteData?.site_id) {
        const { data: siteData } = await supabase.from('sites').select('slug').eq('id', contactSiteData.site_id).single();
        siteSlug = siteData?.slug || contactSiteData.site_id;
      }
    }

    // Per-unit login is required: if no site is associated, fail explicitly so the
    // admin assigns a unit before sending the invitation.
    if (!siteSlug) {
      return new Response(
        JSON.stringify({
          error: 'Este contato não está associado a uma unidade. Atribua uma unidade antes de gerar o convite (login é por unidade, não por fábrica).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const loginUrl = companySlug
      ? `${origin}/${companySlug}/${siteSlug}`
      : `${origin}/login`;

    // 4. Update invitation tracking
    const { data: countData } = await supabase
      .from("company_contacts").select("invitation_count").eq("id", contactId).single();

    await supabase.from("company_contacts").update({
      invitation_sent_at: new Date().toISOString(),
      invitation_count: (countData?.invitation_count || 0) + 1,
    }).eq("id", contactId);

    console.log(`[Invitation] Successfully generated credentials for ${contactEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          email: contactEmail,
          password,
          loginUrl,
          pin: plainPin,
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error(`[Invitation] Error: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
