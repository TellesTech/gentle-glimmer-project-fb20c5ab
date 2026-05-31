
-- Add legal compliance columns to report_signatures
ALTER TABLE public.report_signatures 
  ADD COLUMN IF NOT EXISTS signer_email text,
  ADD COLUMN IF NOT EXISTS signer_user_id uuid,
  ADD COLUMN IF NOT EXISTS document_hash text,
  ADD COLUMN IF NOT EXISTS document_version text,
  ADD COLUMN IF NOT EXISTS geolocation text,
  ADD COLUMN IF NOT EXISTS legal_basis text DEFAULT 'MP 2.200-2/2001';

-- Create signature_audit_log table
CREATE TABLE IF NOT EXISTS public.signature_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id uuid REFERENCES public.report_signatures(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  actor_email text,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can insert audit logs
CREATE POLICY "Users can insert audit logs" ON public.signature_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: authenticated users can view audit logs
CREATE POLICY "Users can view audit logs" ON public.signature_audit_log
  FOR SELECT TO authenticated USING (true);
