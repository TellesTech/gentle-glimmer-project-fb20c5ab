ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

UPDATE public.reports r
SET source = 'whatsapp_ai'
WHERE r.source <> 'whatsapp_ai'
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_rdo_logs l WHERE l.report_id = r.id
  );