ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS meeting_point text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS radio_frequency_wees text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS radio_frequency_operation text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ambulance_point text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS arrival_time_at_liberator text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS document_release_time text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS blockage_revalidation_time text;