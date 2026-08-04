import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generatePassword(name: string): string {
  const clean = (name || "Cliente").replace(/[^a-zA-Z]/g, "").slice(0, 8) || "Cliente";
  const base = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${base}@${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: any) => ["admin", "super_admin"].includes(r.role));
    if (!allowed) return json({ error: "Sem permissão para redefinir senhas de clientes" }, 403);

    const body = await req.json().catch(() => ({}));
    const contactId = String(body.contactId || "").trim();
    let password = typeof body.password === "string" ? body.password : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId)) {
      return json({ error: "Contato inválido" }, 400);
    }
    if (password && (password.length < 8 || password.length > 72)) {
      return json({ error: "A senha deve ter entre 8 e 72 caracteres" }, 400);
    }

    const { data: contact } = await admin
      .from("company_contacts")
      .select("id, name, email, user_id")
      .eq("id", contactId)
      .maybeSingle();

    if (!contact) return json({ error: "Contato não encontrado" }, 404);

    if (!password) password = generatePassword(contact.name || "Cliente");

    // Never allow resetting the password of an internal WEES collaborator
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", contact.email)
      .maybeSingle();
    if (profile?.id) {
      const { data: internalRole } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (internalRole) {
        return json(
          { error: "Este e-mail pertence a um colaborador interno da WEES. Use um e-mail exclusivo do cliente." },
          409,
        );
      }
    }

    let userId = contact.user_id as string | null;

    if (userId) {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (updErr) return json({ error: `Falha ao definir a senha: ${updErr.message}` }, 500);
      await admin.from("company_contacts").update({ must_change_password: true }).eq("id", contact.id);
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: contact.email,
        password,
        email_confirm: true,
        user_metadata: { name: contact.name, is_client: true },
      });
      if (createErr) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => u.email === contact.email);
        if (!existing) return json({ error: `Falha ao criar acesso: ${createErr.message}` }, 500);
        userId = existing.id;
        const { error: updErr } = await admin.auth.admin.updateUserById(userId!, { password, email_confirm: true });
        if (updErr) return json({ error: `Falha ao definir a senha: ${updErr.message}` }, 500);
      } else {
        userId = created.user.id;
      }
      await admin.from("company_contacts").update({ user_id: userId, must_change_password: true }).eq("id", contact.id);
    }

    return json({ success: true, userId, email: contact.email, password });
  } catch (error) {
    console.error("set-client-password error:", error);
    return json({ error: (error as Error)?.message || "Erro interno do servidor" }, 500);
  }
});