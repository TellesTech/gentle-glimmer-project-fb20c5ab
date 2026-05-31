
-- 1) Add signed_pdf_url column to store the PDF (with WEES signature embedded) generated at send time
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT NULL;

-- 2) Create dedicated public storage bucket for signed report PDFs (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-pdfs', 'report-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies for the bucket (drop-then-create for idempotency)
DROP POLICY IF EXISTS "report-pdfs read public" ON storage.objects;
CREATE POLICY "report-pdfs read public"
ON storage.objects
FOR SELECT
USING (bucket_id = 'report-pdfs');

DROP POLICY IF EXISTS "report-pdfs upload authenticated" ON storage.objects;
CREATE POLICY "report-pdfs upload authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-pdfs');

DROP POLICY IF EXISTS "report-pdfs update authenticated" ON storage.objects;
CREATE POLICY "report-pdfs update authenticated"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'report-pdfs');

DROP POLICY IF EXISTS "report-pdfs delete admins" ON storage.objects;
CREATE POLICY "report-pdfs delete admins"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-pdfs'
  AND (public.has_role(auth.uid(), 'admin'::user_role) OR public.has_role(auth.uid(), 'super_admin'::user_role))
);

-- 4) Trigger: when a client signature is inserted, auto-approve matching approvers
--    and, when all approvers are approved, mark the report status as 'signed'.
CREATE OR REPLACE FUNCTION public.auto_approve_on_client_signature()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Skip system / WEES-internal signatures (signer_user_id maps to a profile, not a client)
  -- We only auto-approve approvers whose contact_id matches this signer (via email or signer_user_id).

  -- Approve company contacts whose email matches the signer's email
  IF NEW.signer_email IS NOT NULL THEN
    UPDATE public.report_company_approvers rca
       SET status = 'approved',
           approved_at = COALESCE(NEW.signed_at, now())
      FROM public.company_contacts cc
     WHERE rca.contact_id = cc.id
       AND rca.report_id = NEW.report_id
       AND rca.status = 'pending'
       AND LOWER(cc.email) = LOWER(NEW.signer_email);
  END IF;

  -- Also approve company contacts linked via user_id (for authenticated portal users)
  IF NEW.signer_user_id IS NOT NULL THEN
    UPDATE public.report_company_approvers rca
       SET status = 'approved',
           approved_at = COALESCE(NEW.signed_at, now())
      FROM public.company_contacts cc
     WHERE rca.contact_id = cc.id
       AND rca.report_id = NEW.report_id
       AND rca.status = 'pending'
       AND cc.user_id = NEW.signer_user_id;

    -- And client_profiles via user_id
    UPDATE public.report_client_approvers rca
       SET status = 'approved',
           approved_at = COALESCE(NEW.signed_at, now())
      FROM public.client_profiles cp
     WHERE rca.client_id = cp.id
       AND rca.report_id = NEW.report_id
       AND rca.status = 'pending'
       AND cp.user_id = NEW.signer_user_id;
  END IF;

  -- After updates, count remaining pendings across both approver tables
  SELECT
    (SELECT COUNT(*) FROM public.report_company_approvers WHERE report_id = NEW.report_id)
    + (SELECT COUNT(*) FROM public.report_client_approvers WHERE report_id = NEW.report_id)
  INTO v_total_count;

  SELECT
    (SELECT COUNT(*) FROM public.report_company_approvers WHERE report_id = NEW.report_id AND status = 'pending')
    + (SELECT COUNT(*) FROM public.report_client_approvers WHERE report_id = NEW.report_id AND status = 'pending')
  INTO v_pending_count;

  -- If there is at least one approver and all are approved, mark report as signed
  IF v_total_count > 0 AND v_pending_count = 0 THEN
    UPDATE public.reports
       SET status = 'signed'
     WHERE id = NEW.report_id
       AND status IN ('sent', 'completed', 'draft');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_on_client_signature ON public.report_signatures;
CREATE TRIGGER trg_auto_approve_on_client_signature
AFTER INSERT ON public.report_signatures
FOR EACH ROW
EXECUTE FUNCTION public.auto_approve_on_client_signature();
