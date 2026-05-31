ALTER TABLE public.report_activity_steps 
  ADD COLUMN IF NOT EXISTS total_quantity numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT NULL;