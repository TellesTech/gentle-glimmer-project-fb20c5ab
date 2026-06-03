ALTER TABLE public.report_signatures
  ADD COLUMN IF NOT EXISTS legal_basis text,
  ADD COLUMN IF NOT EXISTS signer_email text;