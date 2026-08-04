import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENERIC = {
  ok: true,
  message: "Se este e-mail estiver cadastrado, enviamos o acesso para a caixa de entrada.",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) + "@9Wz";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const companyId: string | null = body.companyId ?? null;
    const siteId: string | null = body.siteId ?? null;
    const contactId: string | null = body.contactId ?? null;
    const redirectTo: string | null = body.redirectTo ?? null;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk && !contactId) return json({ error: "E-mail inválido" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Locate an active contact for this e-mail (optionally scoped to company/site)
    let query = admin
      .from("company_contacts")
      .select("id, name, email, company_id, user_id, is_active")
      .eq("is_active", true)
      .limit(1);

    if (contactId) {
      query = query.eq("id", contactId);
    } else {
      query = query.ilike("email", email);
      if (companyId) query = query.eq("company_id", companyId);
    }

    const { data: contacts, error: contactError } = await query;
    if (contactError) {
      console.error("[client-magic-link] contact lookup failed", contactError);
      return json({ error: "Erro ao validar cadastro" }, 500);
    }

    const contact = contacts?.[0];
    if (!contact) {
      console.log("[client-magic-link] no active contact for", email);
      return json(GENERIC);
    }

    const contactEmail = String(contact.email ?? email).trim().toLowerCase();

    // 2) Optional site scoping — contact must belong to the requested unit
    if (siteId) {
      const { data: link } = await admin
        .from("contact_sites")
        .select("site_id")
        .eq("contact_id", contact.id)
        .eq("site_id", siteId)
        .maybeSingle();
      if (!link) {
        console.log("[client-magic-link] contact not linked to site", contact.id, siteId);
        return json(GENERIC);
      }
    }

    // 3) Ensure an auth user exists and is linked to the contact
    let userId: string | null = contact.user_id ?? null;
    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: contactEmail,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { name: contact.name, is_client: true },
      });

      if (createError) {
        // User may already exist in auth without being linked to the contact
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = list?.users?.find(
          (u: any) => String(u.email ?? "").toLowerCase() === contactEmail,
        );
        if (!existing) {
          console.error("[client-magic-link] createUser failed", createError);
          return json({ error: "Não foi possível preparar o acesso" }, 500);
        }
        userId = existing.id;
      } else {
        userId = created?.user?.id ?? null;
      }

      if (userId) {
        await admin.from("company_contacts").update({ user_id: userId }).eq("id", contact.id);
      }
    }

    // 4) Send the magic link / OTP e-mail through Supabase Auth
    const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { error: otpError } = await publicClient.auth.signInWithOtp({
      email: contactEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo || undefined,
      },
    });

    if (otpError) {
      console.error("[client-magic-link] signInWithOtp failed", otpError);
      const status = (otpError as any).status === 429 ? 429 : 500;
      return json(
        {
          error:
            status === 429
              ? "Muitas tentativas. Aguarde alguns minutos antes de pedir um novo acesso."
              : "Não foi possível enviar o e-mail de acesso agora.",
        },
        status,
      );
    }

    await admin
      .from("company_contacts")
      .update({ invitation_sent_at: new Date().toISOString() })
      .eq("id", contact.id);

    console.log("[client-magic-link] access e-mail sent to contact", contact.id);
    return json({ ...GENERIC, sent: true });
  } catch (err: any) {
    console.error("[client-magic-link] unexpected error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
