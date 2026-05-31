ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS cover_photos text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS show_irata_seals boolean NOT NULL DEFAULT true;