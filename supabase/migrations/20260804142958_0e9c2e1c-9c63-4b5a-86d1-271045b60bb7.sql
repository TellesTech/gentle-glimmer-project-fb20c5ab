ALTER TABLE public.report_signatures
  ADD COLUMN IF NOT EXISTS document_version text,
  ADD COLUMN IF NOT EXISTS geolocation jsonb;

CREATE TABLE public.signature_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id uuid NOT NULL REFERENCES public.report_signatures(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email text,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signature_audit_log TO authenticated;
GRANT ALL ON public.signature_audit_log TO service_role;

ALTER TABLE public.signature_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view signature audit logs"
ON public.signature_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.report_signatures rs
    WHERE rs.id = signature_audit_log.signature_id
      AND (
        rs.signer_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.reports r
          WHERE r.id = rs.report_id
            AND (
              r.created_by = auth.uid()
              OR public.has_role(auth.uid(), 'admin'::public.user_role)
              OR public.has_role(auth.uid(), 'director'::public.user_role)
              OR public.has_role(auth.uid(), 'supervisor'::public.user_role)
              OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
              OR EXISTS (
                SELECT 1
                FROM public.report_client_approvers rca
                JOIN public.client_profiles cp ON cp.id = rca.client_id
                WHERE rca.report_id = r.id AND cp.user_id = auth.uid()
              )
              OR EXISTS (
                SELECT 1
                FROM public.report_company_approvers rcoa
                JOIN public.company_contacts cc ON cc.id = rcoa.contact_id
                WHERE rcoa.report_id = r.id AND cc.user_id = auth.uid()
              )
            )
        )
      )
  )
);

CREATE INDEX idx_signature_audit_log_signature_id
  ON public.signature_audit_log(signature_id);

NOTIFY pgrst, 'reload schema';