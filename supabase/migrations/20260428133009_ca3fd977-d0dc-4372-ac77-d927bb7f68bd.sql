-- Enable Realtime for signature-related tables (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.report_signatures;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.report_client_approvers;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.report_company_approvers;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Ensure REPLICA IDENTITY FULL so realtime payloads include full row data
ALTER TABLE public.report_signatures REPLICA IDENTITY FULL;
ALTER TABLE public.report_client_approvers REPLICA IDENTITY FULL;
ALTER TABLE public.report_company_approvers REPLICA IDENTITY FULL;