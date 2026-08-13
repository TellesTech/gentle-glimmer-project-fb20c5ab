import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export class SignatureAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface VerifiedSigner {
  userId: string | null;
  name: string;
  email: string | null;
  role: string | null;
  kind: "wees" | "client" | "contact" | "guest";
  accessId: string | null;
  approverTable?: "report_client_approvers" | "report_company_approvers";
  approverId?: string;
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new SignatureAuthError("Configuração do serviço indisponível", 500);
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function getAuthenticatedUserId(req: Request): Promise<{ id: string; email: string | null } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new SignatureAuthError("Configuração de autenticação indisponível", 500);

  const token = authHeader.slice(7).trim();
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getClaims(token);
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") throw new SignatureAuthError("Sessão inválida ou expirada", 401);
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: subject, email };
}

export async function verifySigner(
  req: Request,
  service: SupabaseClient,
  reportId: string,
  accessToken?: string | null,
): Promise<VerifiedSigner> {
  const authenticated = await getAuthenticatedUserId(req);

  if (authenticated) {
    // External portal assignments take precedence over generic roles created at signup.
    // This prevents client/contact accounts with a default "collaborator" role from
    // being misclassified as WEES users.
    const { data: assignedClient } = await service
      .from("client_profiles")
      .select("id,name,email,role,is_active")
      .eq("user_id", authenticated.id)
      .eq("is_active", true)
      .maybeSingle();
    if (assignedClient) {
      const { data: assignment } = await service.from("report_client_approvers").select("id").eq("report_id", reportId).eq("client_id", assignedClient.id).maybeSingle();
      if (assignment) return { userId: authenticated.id, name: assignedClient.name, email: assignedClient.email || authenticated.email, role: assignedClient.role || "Cliente", kind: "client", accessId: null, approverTable: "report_client_approvers", approverId: assignment.id };
    }

    const { data: assignedContact } = await service
      .from("company_contacts")
      .select("id,name,email,role,is_active")
      .eq("user_id", authenticated.id)
      .eq("is_active", true)
      .maybeSingle();
    if (assignedContact) {
      const { data: assignment } = await service.from("report_company_approvers").select("id").eq("report_id", reportId).eq("contact_id", assignedContact.id).maybeSingle();
      if (assignment) return { userId: authenticated.id, name: assignedContact.name, email: assignedContact.email || authenticated.email, role: assignedContact.role || "Cliente", kind: "contact", accessId: null, approverTable: "report_company_approvers", approverId: assignment.id };
    }

    const { data: roleRows } = await service.from("user_roles").select("role").eq("user_id", authenticated.id);
    const internalRoles = (roleRows ?? []).map((row) => row.role).filter((role) => role !== "client");

    if (internalRoles.length > 0) {
      const { data: profile } = await service
        .from("profiles")
        .select("name,email,job_title,company_id,is_active")
        .eq("id", authenticated.id)
        .maybeSingle();
      if (!profile || profile.is_active === false) throw new SignatureAuthError("Usuário WEES inativo ou sem perfil", 403);

      const { data: report } = await service
        .from("reports")
        .select("created_by,team_id,projects(company_id)")
        .eq("id", reportId)
        .maybeSingle();
      if (!report) throw new SignatureAuthError("RDO não encontrado", 404);

      const elevated = internalRoles.some((role) => ["admin", "director", "supervisor", "leader", "super_admin", "master"].includes(role));
      const reportCompanyId = Array.isArray(report.projects) ? report.projects[0]?.company_id : report.projects?.company_id;
      let teamMember = false;
      if (report.team_id) {
        const { data } = await service.from("team_members").select("user_id").eq("team_id", report.team_id).eq("user_id", authenticated.id).maybeSingle();
        teamMember = Boolean(data);
      }
      if (!elevated && report.created_by !== authenticated.id && !teamMember && profile.company_id !== reportCompanyId) {
        throw new SignatureAuthError("Sem permissão para assinar este RDO", 403);
      }

      return {
        userId: authenticated.id,
        name: profile.name || authenticated.email || "Usuário WEES",
        email: profile.email || authenticated.email,
        role: profile.job_title || internalRoles[0] || "Colaborador",
        kind: "wees",
        accessId: null,
      };
    }

    const { data: client } = await service
      .from("client_profiles")
      .select("id,name,email,role,is_active")
      .eq("user_id", authenticated.id)
      .eq("is_active", true)
      .maybeSingle();
    if (client) {
      const { data: assignment } = await service
        .from("report_client_approvers")
        .select("id")
        .eq("report_id", reportId)
        .eq("client_id", client.id)
        .maybeSingle();
      if (!assignment) throw new SignatureAuthError("Você não está indicado para assinar este RDO", 403);
      return { userId: authenticated.id, name: client.name, email: client.email || authenticated.email, role: client.role || "Cliente", kind: "client", accessId: null, approverTable: "report_client_approvers", approverId: assignment.id };
    }

    const { data: contact } = await service
      .from("company_contacts")
      .select("id,name,email,role,is_active")
      .eq("user_id", authenticated.id)
      .eq("is_active", true)
      .maybeSingle();
    if (contact) {
      const { data: assignment } = await service
        .from("report_company_approvers")
        .select("id")
        .eq("report_id", reportId)
        .eq("contact_id", contact.id)
        .maybeSingle();
      if (!assignment) throw new SignatureAuthError("Você não está indicado para assinar este RDO", 403);
      return { userId: authenticated.id, name: contact.name, email: contact.email || authenticated.email, role: contact.role || "Cliente", kind: "contact", accessId: null, approverTable: "report_company_approvers", approverId: assignment.id };
    }

    throw new SignatureAuthError("Usuário sem perfil autorizado para assinatura", 403);
  }

  if (!accessToken) throw new SignatureAuthError("Entre na sua conta ou utilize um link de assinatura válido", 401);
  const { data: access } = await service
    .from("client_report_access")
    .select("id,report_id,client_name,client_email,expires_at")
    .eq("access_token", accessToken)
    .maybeSingle();
  if (!access || access.report_id !== reportId) throw new SignatureAuthError("Link de assinatura inválido", 404);
  if (access.expires_at && new Date(access.expires_at).getTime() < Date.now()) throw new SignatureAuthError("Este link de assinatura expirou", 410);
  return { userId: null, name: access.client_name, email: access.client_email, role: "Cliente", kind: "guest", accessId: access.id };
}

export async function ensureAccessRecord(
  service: SupabaseClient,
  reportId: string,
  signer: VerifiedSigner,
): Promise<string> {
  if (signer.accessId) return signer.accessId;
  if (signer.email) {
    const { data: existing } = await service
      .from("client_report_access")
      .select("id")
      .eq("report_id", reportId)
      .ilike("client_email", signer.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id;
  }
  // created_by references profiles(id): only internal WEES users have a profile row.
  const createdBy = signer.kind === "wees" ? signer.userId : null;
  const { data, error } = await service
    .from("client_report_access")
    .insert({ report_id: reportId, client_name: signer.name, client_email: signer.email, created_by: createdBy })
    .select("id")
    .single();
  if (error || !data) {
    console.error("ensureAccessRecord insert failed", JSON.stringify({
      code: (error as { code?: string } | null)?.code ?? null,
      message: error?.message ?? null,
      details: error?.details ?? null,
      hint: error?.hint ?? null,
      reportId,
      signerKind: signer.kind,
      hasEmail: !!signer.email,
    }));
    if (signer.email) {
      const { data: retry } = await service
        .from("client_report_access")
        .select("id")
        .eq("report_id", reportId)
        .ilike("client_email", signer.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (retry) return retry.id;
    }
    throw new SignatureAuthError(
      `Não foi possível registrar o acesso da assinatura${error?.message ? `: ${error.message}` : ""}`,
      500,
    );
  }
  return data.id;
}

/**
 * Closes the approval cycle after a signature is stored:
 * marks the signer's approver row as approved and, once every approver of the
 * report has approved, flips the report to "signed".
 * Never throws: a signature must stay valid even if this bookkeeping fails.
 */
export async function finalizeApproval(
  service: SupabaseClient,
  reportId: string,
  signer: VerifiedSigner,
  signedAt: string = new Date().toISOString(),
): Promise<void> {
  try {
    if (signer.approverTable && signer.approverId) {
      const { error } = await service
        .from(signer.approverTable)
        .update({ status: "approved", approved_at: signedAt })
        .eq("id", signer.approverId);
      if (error) console.error("finalizeApproval: approver update failed", error.message);
    } else if (signer.email) {
      // Guest / link signer: match the approver by e-mail.
      const { data: contact } = await service
        .from("company_contacts")
        .select("id")
        .ilike("email", signer.email)
        .maybeSingle();
      if (contact) {
        await service
          .from("report_company_approvers")
          .update({ status: "approved", approved_at: signedAt })
          .eq("report_id", reportId)
          .eq("contact_id", contact.id)
          .is("approved_at", null);
      }
      const { data: clientProfile } = await service
        .from("client_profiles")
        .select("id")
        .ilike("email", signer.email)
        .maybeSingle();
      if (clientProfile) {
        await service
          .from("report_client_approvers")
          .update({ status: "approved", approved_at: signedAt })
          .eq("report_id", reportId)
          .eq("client_id", clientProfile.id)
          .is("approved_at", null);
      }
    }

    const [{ data: companyApprovers }, { data: clientApprovers }] = await Promise.all([
      service.from("report_company_approvers").select("approved_at").eq("report_id", reportId),
      service.from("report_client_approvers").select("approved_at").eq("report_id", reportId),
    ]);
    const all = [...(companyApprovers ?? []), ...(clientApprovers ?? [])];
    if (all.length === 0 || all.some((row) => !row.approved_at)) return;

    const { data: report } = await service.from("reports").select("status").eq("id", reportId).maybeSingle();
    if (report && report.status !== "signed" && report.status !== "finalized") {
      const { error } = await service
        .from("reports")
        .update({ status: "signed", approved_at: signedAt })
        .eq("id", reportId);
      if (error) console.error("finalizeApproval: report status update failed", error.message);
    }
  } catch (error) {
    console.error("finalizeApproval unexpected error", error);
  }
}