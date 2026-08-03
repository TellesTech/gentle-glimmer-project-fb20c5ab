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

const strongPassword = (p: string) =>
  typeof p === "string" &&
  p.length >= 8 &&
  /[a-z]/.test(p) &&
  /[A-Z]/.test(p) &&
  /[0-9]/.test(p);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Autenticação do solicitante
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // 2) Autorização: apenas admin / super_admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: any) => ["admin", "super_admin"].includes(r.role));
    if (!allowed) return json({ error: "Sem permissão para criar administradores de cliente" }, 403);

    // 3) Validação de entrada
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");
    const phone = body.phone ? String(body.phone).trim() : null;
    const companyId: string | null = body.companyId || null;
    const siteId: string | null = body.siteId || null;
    const canApprove = body.canApprove !== false;
    const sendEmail = body.sendEmail !== false;

    const errors: Record<string, string> = {};
    if (name.length < 3) errors.name = "Informe o nome do cliente (mín. 3 caracteres)";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "E-mail inválido";
    if (!strongPassword(password))
      errors.password = "Senha deve ter 8+ caracteres, com maiúscula, minúscula e número";
    if (password !== confirmPassword) errors.confirmPassword = "As senhas não conferem";
    if (!companyId) errors.companyId = "Selecione a unidade/empresa";
    if (Object.keys(errors).length) return json({ error: "Dados inválidos", fields: errors }, 400);

    // 4) Evitar duplicidade
    const { data: existingProfile } = await admin
      .from("client_profiles")
      .select("id, user_id")
      .eq("email", email)
      .maybeSingle();
    if (existingProfile?.user_id)
      return json({ error: "Já existe um acesso de cliente para este e-mail" }, 409);

    // 5) Criar usuário de autenticação
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, is_client: true, is_client_admin: true },
    });
    if (createErr || !created?.user) {
      console.error("createUser error", createErr);
      return json({ error: createErr?.message || "Falha ao criar usuário" }, 400);
    }
    const userId = created.user.id;

    // 6) Perfil de cliente
    let clientId = existingProfile?.id as string | undefined;
    if (clientId) {
      await admin
        .from("client_profiles")
        .update({ user_id: userId, name, phone, company_id: companyId, is_active: true, can_approve: canApprove, role: "Administrador" })
        .eq("id", clientId);
    } else {
      const { data: profile, error: profErr } = await admin
        .from("client_profiles")
        .insert({ user_id: userId, email, name, phone, company_id: companyId, is_active: true, can_approve: canApprove, role: "Administrador" })
        .select("id")
        .single();
      if (profErr || !profile) {
        await admin.auth.admin.deleteUser(userId);
        console.error("profile error", profErr);
        return json({ error: profErr?.message || "Falha ao criar perfil do cliente" }, 400);
      }
      clientId = profile.id;
    }

    // 7) Papel de administrador do cliente + vínculos
    await admin.from("client_user_roles").insert({ client_id: clientId, role: "admin" });
    await admin.from("client_companies").insert({ client_id: clientId, company_id: companyId });
    if (siteId) await admin.from("client_sites").insert({ client_id: clientId, site_id: siteId });

    // 8) E-mail com dados de acesso (best effort)
    let emailSent = false;
    if (sendEmail) {
      try {
        const origin = req.headers.get("origin") || "";
        const { error: mailErr } = await admin.functions.invoke("send-welcome-email", {
          body: { email, name, password, loginUrl: `${origin}/login` },
        });
        emailSent = !mailErr;
        if (mailErr) console.error("welcome email error", mailErr);
      } catch (e) {
        console.error("welcome email exception", e);
      }
    }

    return json({ success: true, clientId, userId, emailSent });
  } catch (e) {
    console.error("create-client-admin error", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
