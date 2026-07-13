ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS cover_photos jsonb,
  ADD COLUMN IF NOT EXISTS show_irata_seals boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS irata_logo_brasil_url text,
  ADD COLUMN IF NOT EXISTS irata_logo_international_url text;