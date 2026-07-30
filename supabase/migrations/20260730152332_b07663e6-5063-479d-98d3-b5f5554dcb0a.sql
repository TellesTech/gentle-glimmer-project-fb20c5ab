ALTER TABLE public.whatsapp_rdo_logs
  DROP CONSTRAINT IF EXISTS whatsapp_rdo_logs_report_id_fkey;

ALTER TABLE public.whatsapp_rdo_logs
  ADD CONSTRAINT whatsapp_rdo_logs_report_id_fkey
  FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE SET NULL;