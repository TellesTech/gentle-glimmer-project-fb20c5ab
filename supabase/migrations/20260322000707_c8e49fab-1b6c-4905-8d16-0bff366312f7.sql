ALTER TABLE public.service_report_photos
  ADD COLUMN IF NOT EXISTS width_percent integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS custom_height integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS object_fit text DEFAULT 'contain';