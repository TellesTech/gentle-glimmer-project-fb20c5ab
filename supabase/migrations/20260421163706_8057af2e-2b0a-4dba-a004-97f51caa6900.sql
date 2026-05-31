ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS irata_logo_brasil_url text,
  ADD COLUMN IF NOT EXISTS irata_logo_international_url text;