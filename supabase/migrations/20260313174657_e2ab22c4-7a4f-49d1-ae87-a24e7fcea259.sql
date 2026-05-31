-- Fix whatsapp_rdo_logs: change from NO ACTION to ON DELETE CASCADE
ALTER TABLE public.whatsapp_rdo_logs
  DROP CONSTRAINT IF EXISTS whatsapp_rdo_logs_report_id_fkey,
  ADD CONSTRAINT whatsapp_rdo_logs_report_id_fkey
    FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;

-- Fix leads.converted_company_id: change from NO ACTION to ON DELETE SET NULL
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_converted_company_id_fkey,
  ADD CONSTRAINT leads_converted_company_id_fkey
    FOREIGN KEY (converted_company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- Fix whatsapp_rdo_logs RLS: remove insecure anon policy
DROP POLICY IF EXISTS "Allow all operations on whatsapp_rdo_logs" ON public.whatsapp_rdo_logs;

-- Create proper policies for whatsapp_rdo_logs
CREATE POLICY "Authenticated users can read whatsapp_rdo_logs"
  ON public.whatsapp_rdo_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete whatsapp_rdo_logs"
  ON public.whatsapp_rdo_logs FOR DELETE TO authenticated USING (true);